const TICKER_URL = "https://www.sec.gov/files/company_tickers.json";
const USER_AGENT = "Goalpath/1.0 (educational planner; personal study; not a broker)";
const FORMS = new Set(["10-K", "10-K/A", "10-Q", "10-Q/A", "8-K", "8-K/A", "20-F", "40-F", "N-CSR", "N-CSRS", "NPORT-P", "485BPOS", "485APOS", "497"]);

let tickerCache = null;
const CACHE_MS = 12 * 60 * 60 * 1000;

async function secJson(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`${response.status} from SEC`);
  return response.json();
}

async function tickerMap(now = Date.now()) {
  if (tickerCache && now - tickerCache.at < CACHE_MS) return tickerCache.map;
  const payload = await secJson(TICKER_URL);
  const map = new Map();
  for (const row of Object.values(payload)) {
    if (row?.ticker) map.set(String(row.ticker).toUpperCase(), row);
  }
  tickerCache = { at: now, map };
  return map;
}

function filingUrl(cik, accession, document) {
  const cikNumber = String(Number(cik));
  const folder = String(accession).replaceAll("-", "");
  return `https://www.sec.gov/Archives/edgar/data/${cikNumber}/${folder}/${document}`;
}

export function pickFilings(recent) {
  if (!recent?.form) return [];
  const rows = [];
  for (let i = 0; i < recent.form.length; i += 1) {
    const form = recent.form[i];
    if (!FORMS.has(form)) continue;
    rows.push({
      form,
      filed: recent.filingDate[i],
      description: recent.primaryDocDescription?.[i] || "",
      document: recent.primaryDocument[i],
      accession: recent.accessionNumber[i],
    });
  }
  const latest = (forms) => rows.find((row) => forms.includes(row.form));
  const chosen = [
    latest(["10-K", "10-K/A", "20-F", "40-F"]),
    latest(["10-Q", "10-Q/A"]),
    latest(["485BPOS", "485APOS"]),
    latest(["N-CSR", "N-CSRS"]),
    latest(["NPORT-P"]),
    ...rows.filter((row) => row.form === "8-K" || row.form === "8-K/A").slice(0, 3),
  ].filter(Boolean);
  const seen = new Set();
  return chosen.filter((row) => {
    const id = `${row.accession}:${row.document}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export async function lookupCompany(rawTicker) {
  const ticker = String(rawTicker || "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z][A-Z0-9.\-]{0,7}$/.test(ticker)) {
    const error = new Error("Enter a ticker symbol, such as AAPL.");
    error.status = 400;
    throw error;
  }
  const map = await tickerMap();
  const company = map.get(ticker);
  if (!company) {
    const error = new Error(`SEC's ticker list has no company for ${ticker}. Fund tickers are often absent from that list; use the EDGAR search link.`);
    error.status = 404;
    throw error;
  }
  const cikPadded = String(company.cik_str).padStart(10, "0");
  const submissions = await secJson(`https://data.sec.gov/submissions/CIK${cikPadded}.json`);
  const filings = pickFilings(submissions.filings?.recent).map((row) => ({
    ...row,
    url: filingUrl(company.cik_str, row.accession, row.document),
  }));
  return {
    ticker,
    name: submissions.name || company.title,
    cik: String(company.cik_str),
    filings,
    searchUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${encodeURIComponent(cikPadded)}&owner=exclude&count=40`,
    checklist: [
      "Business: what the company actually sells, in Item 1 of the latest 10-K.",
      "Risks: Item 1A. Read them as things that can go wrong, not as boilerplate to skip.",
      "Financial statements and the notes, including debt and how the company makes cash.",
      "Any 8-K from the last few months, then decide if it changes the reason you would own it.",
      "Size: one company stays at or under 5% of this goal. The plan does not rate the stock.",
    ],
  };
}
