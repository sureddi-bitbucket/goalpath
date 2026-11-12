function treasuryUrl(year) {
  return `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${year}/all?type=daily_treasury_yield_curve&page&_format=csv`;
}
const BLS_URL = "https://api.bls.gov/publicAPI/v1/timeseries/data/";
const USER_AGENT = "Goalpath/1.0 (educational planner; personal study; not a broker)";

let cache = null;
const CACHE_MS = 6 * 60 * 60 * 1000;

export function splitCsvLine(line) {
  const out = [];
  let current = "";
  let quoted = false;
  for (const char of line) {
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      out.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  out.push(current.trim());
  return out;
}

export function parseTreasuryCsv(text) {
  if (!text || !text.includes("10 Yr")) return null;
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const header = splitCsvLine(lines[0]);
  const dateIndex = header.findIndex((name) => name.toLowerCase() === "date");
  const threeIndex = header.findIndex((name) => name === "3 Mo");
  const tenIndex = header.findIndex((name) => name === "10 Yr");
  if (dateIndex < 0 || tenIndex < 0) return null;

  for (let i = 1; i < lines.length; i += 1) {
    const cols = splitCsvLine(lines[i]);
    const tenYear = Number(cols[tenIndex]);
    const threeMonth = threeIndex >= 0 ? Number(cols[threeIndex]) : NaN;
    if (!cols[dateIndex] || !Number.isFinite(tenYear)) continue;
    return {
      date: cols[dateIndex],
      threeMonth: Number.isFinite(threeMonth) ? threeMonth : null,
      tenYear,
    };
  }
  return null;
}

function numericCpi(row) {
  return Boolean(row && row.value && row.value !== "-" && Number.isFinite(Number(row.value)));
}

export function inflationFromBls(payload) {
  const series = payload?.Results?.series?.[0]?.data;
  if (!Array.isArray(series)) return null;
  const published = series.find((row) => numericCpi(row));
  if (!published) return null;

  for (const row of series) {
    if (!numericCpi(row)) continue;
    const prior = series.find(
      (item) => item.year === String(Number(row.year) - 1) && item.period === row.period && numericCpi(item),
    );
    if (!prior) continue;
    const latestIndex = Number(row.value);
    const priorIndex = Number(prior.value);
    const skipped = row.period !== published.period || row.year !== published.year;
    return {
      index: latestIndex,
      period: `${row.periodName} ${row.year}`,
      seriesId: "CUUR0000SA0",
      yoyPercent: Math.round((latestIndex / priorIndex - 1) * 1000) / 10,
      priorPeriod: `${prior.periodName} ${prior.year}`,
      note: skipped
        ? `${published.periodName} ${published.year} is the newest index, but that month has no published reading from the year before, so the change uses ${row.periodName} ${row.year}.`
        : "",
    };
  }

  return {
    index: Number(published.value),
    period: `${published.periodName} ${published.year}`,
    seriesId: "CUUR0000SA0",
    yoyPercent: null,
    note: "",
  };
}

async function fetchText(url, options = {}, attempt = 0) {
  const response = await fetch(url, {
    ...options,
    headers: { "User-Agent": USER_AGENT, Accept: "text/csv,application/json", ...(options.headers || {}) },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    if (attempt < 2 && response.status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
      return fetchText(url, options, attempt + 1);
    }
    throw new Error(`${response.status} from ${url}`);
  }
  return response.text();
}

export async function getMarketContext(now = Date.now()) {
  if (cache && now < cache.until) return cache.value;

  const errors = [];
  let treasury = null;
  let cpi = null;

  const year = new Date(now).getFullYear();
  let treasuryError = null;
  for (const candidate of [year, year - 1]) {
    try {
      const parsed = parseTreasuryCsv(await fetchText(treasuryUrl(candidate)));
      if (parsed) {
        treasury = parsed;
        treasuryError = null;
        break;
      }
      treasuryError = new Error("The Treasury file did not contain a yield curve.");
    } catch (error) {
      treasuryError = error;
    }
  }
  if (!treasury && treasuryError) errors.push(`Treasury yields were not available (${treasuryError.message}).`);

  try {
    const text = await fetchText(`${BLS_URL}CUUR0000SA0`);
    cpi = inflationFromBls(JSON.parse(text));
    if (!cpi) errors.push("The BLS response did not include a CPI reading.");
  } catch (error) {
    errors.push(`CPI was not available (${error.message}).`);
  }

  const value = {
    treasury,
    cpi,
    errors,
    fetchedAt: new Date(now).toISOString(),
  };
  const fresh = treasury && cpi?.yoyPercent != null;
  cache = { until: now + (fresh ? CACHE_MS : 2 * 60 * 1000), value };
  return value;
}

export function clearMarketCache() {
  cache = null;
}
