import { fundsForAllocation, TARGET_DATE } from "./funds.js";
import { DISCLAIMER } from "./sources.js";

export const BAND_POINTS = 5;
export const EQUITY_PREMIUM = 0.04;
export const US_SHARE_OF_STOCKS = 0.7;
export const FALLBACK_YIELD_PERCENT = 4;

const SLEEVES = [
  { key: "usStock", label: "U.S. stocks", detail: "A broad U.S. stock fund, not a single company." },
  { key: "intlStock", label: "International stocks", detail: "Companies outside the United States, developed and emerging." },
  { key: "bonds", label: "Investment-grade bonds", detail: "A broad bond fund. The price can fall when yields rise." },
  { key: "cash", label: "Cash and short Treasuries", detail: "Treasury bills, a short Treasury fund, or an insured deposit." },
];

const SPEND_EQUITY = [
  [20, 90],
  [15, 85],
  [10, 75],
  [7, 65],
  [5, 55],
  [3, 40],
  [1, 25],
  [0, 15],
];

const ONGOING_EQUITY = [
  [25, 90],
  [15, 80],
  [10, 70],
  [5, 60],
  [0, 50],
];

export function yearsUntil(targetDate, now = new Date()) {
  const target = new Date(`${targetDate}T00:00:00`);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (Number.isNaN(target.getTime())) return null;
  return (target.getTime() - start.getTime()) / 86400000 / 365.25;
}

export function roundTo100(parts) {
  const keys = Object.keys(parts);
  const sum = keys.reduce((total, key) => total + parts[key], 0);
  const rows = keys.map((key) => {
    const scaled = sum === 0 ? 0 : (parts[key] / sum) * 100;
    const floor = Math.floor(scaled + 1e-9);
    return { key, floor, frac: scaled - floor };
  });
  let used = rows.reduce((total, row) => total + row.floor, 0);
  rows.sort((a, b) => b.frac - a.frac || a.key.localeCompare(b.key));
  let index = 0;
  while (used < 100 && index < 20) {
    rows[index % rows.length].floor += 1;
    used += 1;
    index += 1;
  }
  return Object.fromEntries(rows.map((row) => [row.key, row.floor]));
}

function baseEquity(years, goalUse) {
  const table = goalUse === "ongoing" ? ONGOING_EQUITY : SPEND_EQUITY;
  for (const [minimum, equity] of table) {
    if (years >= minimum) return equity;
  }
  return table[table.length - 1][1];
}

function applyRisk(equity, risk, years, goalUse) {
  let next = equity;
  if (risk === "conservative") next *= 0.75;
  if (risk === "growth") {
    const cap = goalUse === "spend" ? 95 : 90;
    next = Math.min(cap, equity * 1.1);
  }
  if (goalUse === "spend" && years < 3) next = Math.min(next, 35);
  if (goalUse === "spend" && years < 1) next = Math.min(next, 20);
  return next;
}

function cashFractionOfRemainder(years, goalUse) {
  if (goalUse === "ongoing") return years >= 10 ? 0 : 0.15;
  if (years >= 5) return 0;
  if (years >= 3) return 0.3;
  if (years >= 1) return 0.55;
  return 0.75;
}

export function allocationFor({ years, risk, goalUse }) {
  const safeYears = Math.max(0, years);
  const equity = applyRisk(baseEquity(safeYears, goalUse), risk, safeYears, goalUse);
  const remainder = 100 - equity;
  const cash = remainder * cashFractionOfRemainder(safeYears, goalUse);
  return roundTo100({
    usStock: equity * US_SHARE_OF_STOCKS,
    intlStock: equity * (1 - US_SHARE_OF_STOCKS),
    bonds: remainder - cash,
    cash,
  });
}

export function futureValue({ current, monthly, annualRate, months }) {
  const rate = annualRate / 12;
  if (months <= 0) return current;
  if (Math.abs(rate) < 1e-12) return current + monthly * months;
  const grown = current * (1 + rate) ** months;
  const contributions = monthly * (((1 + rate) ** months - 1) / rate);
  return grown + contributions;
}

export function monthlyNeeded({ current, target, annualRate, months }) {
  if (months <= 0) return null;
  const rate = annualRate / 12;
  const grown = Math.abs(rate) < 1e-12 ? current : current * (1 + rate) ** months;
  const gap = target - grown;
  if (gap <= 0) return 0;
  if (Math.abs(rate) < 1e-12) return gap / months;
  return (gap * rate) / ((1 + rate) ** months - 1);
}

export function assessDrift(targets, holdings) {
  const keys = SLEEVES.map((sleeve) => sleeve.key);
  const dollars = Object.fromEntries(keys.map((key) => [key, Math.max(0, Number(holdings?.[key]) || 0)]));
  const total = keys.reduce((sum, key) => sum + dollars[key], 0);
  const rows = keys.map((key) => {
    const currentPct = total > 0 ? (dollars[key] / total) * 100 : 0;
    const drift = currentPct - (targets[key] || 0);
    let action = "inside the band";
    if (total <= 0) action = "nothing invested yet";
    else if (drift >= BAND_POINTS) action = "trim";
    else if (drift <= -BAND_POINTS) action = "add";
    return {
      key,
      label: SLEEVES.find((sleeve) => sleeve.key === key).label,
      dollars: Math.round(dollars[key]),
      currentPct: Math.round(currentPct * 10) / 10,
      targetPct: targets[key] || 0,
      drift: Math.round(drift * 10) / 10,
      action,
    };
  });
  return { total: Math.round(total), band: BAND_POINTS, rows };
}

function cleanName(name) {
  const text = String(name || "")
    .replace(/[\u0000-\u001f]/g, "")
    .trim()
    .slice(0, 80);
  return text || "Your goal";
}

export function validateInput(body) {
  const errors = [];
  const goalUse = body?.goalUse === "ongoing" ? "ongoing" : body?.goalUse === "spend" ? "spend" : null;
  const risk = ["conservative", "moderate", "growth"].includes(body?.risk) ? body.risk : null;
  const account = ["taxable", "retirement", "education"].includes(body?.account) ? body.account : null;
  const targetAmount = Number(body?.targetAmount);
  const currentSavings = Number(body?.currentSavings);
  const monthlyContribution = Number(body?.monthlyContribution);
  const targetDate = typeof body?.targetDate === "string" ? body.targetDate : "";

  if (!goalUse) errors.push("Choose whether you will spend the money on a date or draw it over time.");
  if (!risk) errors.push("Choose a risk setting.");
  if (!account) errors.push("Choose an account type.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate) || yearsUntil(targetDate) === null) errors.push("Enter a real target date.");
  if (!Number.isFinite(targetAmount) || targetAmount <= 0 || targetAmount > 1e12) errors.push("Enter a target amount above zero.");
  if (!Number.isFinite(currentSavings) || currentSavings < 0 || currentSavings > 1e12) errors.push("Enter current savings as zero or more.");
  if (!Number.isFinite(monthlyContribution) || monthlyContribution < 0 || monthlyContribution > 1e9) {
    errors.push("Enter a monthly amount as zero or more.");
  }

  return {
    errors,
    value: {
      goalName: cleanName(body?.goalName),
      goalUse,
      risk,
      account,
      targetAmount,
      currentSavings,
      monthlyContribution,
      targetDate,
    },
  };
}

function phaseFor(years, goalUse) {
  if (goalUse === "ongoing") {
    if (years >= 15) {
      return {
        id: "accumulate",
        title: "Accumulate",
        summary: "The date is far enough that the mix leans toward stocks. Stocks can still drop sharply on the way.",
      };
    }
    if (years >= 5) {
      return {
        id: "glide",
        title: "Glide",
        summary: "The mix eases from stocks toward bonds. At an income goal you do not sell everything on the date.",
      };
    }
    return {
      id: "withdraw",
      title: "Draw income",
      summary: "Spending can last decades, so the mix keeps a large stock share and a bond share you can draw from.",
    };
  }
  if (years >= 10) {
    return {
      id: "accumulate",
      title: "Accumulate",
      summary: "A dated purchase is still far away, so the mix can hold more stocks. The date, not a headline, is the reason to change it later.",
    };
  }
  if (years >= 3) {
    return {
      id: "glide",
      title: "Glide",
      summary: "Start moving the mix toward bonds and cash on a schedule, so a stock drop close to the purchase date matters less.",
    };
  }
  return {
    id: "preserve",
    title: "Preserve",
    summary: "The purchase is close. Most of the money belongs in short Treasuries or insured cash, where a market drop is less likely to decide the goal.",
  };
}

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function illustrationRates(percents, context) {
  const liveThree = context?.treasury?.threeMonth;
  const liveTen = context?.treasury?.tenYear;
  const three = (liveThree ?? FALLBACK_YIELD_PERCENT) / 100;
  const ten = (liveTen ?? FALLBACK_YIELD_PERCENT) / 100;
  const stock = ten + EQUITY_PREMIUM;
  const blended = (percents.usStock + percents.intlStock) / 100 * stock + percents.bonds / 100 * ten + percents.cash / 100 * three;
  const yieldNote = liveTen == null
    ? `Treasury yields were unavailable, so both yields use a ${FALLBACK_YIELD_PERCENT}% stand-in. That number is not a forecast.`
    : `Cash uses the ${context.treasury.date} 3-month Treasury yield of ${liveThree ?? "n/a"}%. Bonds use the 10-year yield of ${liveTen}%.`;
  return {
    blended,
    assumptions: [
      yieldNote,
      "Stocks use the 10-year Treasury yield plus 4 percentage points. That 4 point figure is a round historical-style premium used only to draw a range. It is not a forecast, and the historical premium has been far higher and far lower.",
      "A total-bond fund also holds mortgages and corporate bonds, and its price moves when yields change. The Treasury yield is a stand-in, not the fund's expected return.",
      "The lower and higher paths are 2 percentage points below and above the middle path, and the lower path is not taken below zero.",
    ],
  };
}

function buildRules({ value, years, phase }) {
  const monthly = money(value.monthlyContribution);
  const cap = money(value.currentSavings * 0.05);
  const buy = [
    `Add the ${monthly} on a date you pick, such as payday, split in the mix below. The calendar is the signal. A headline is not.`,
    phase.id === "preserve"
      ? "Most new money goes to short Treasuries or insured cash because the spending date is close."
      : "The stock share is there because of the time until the goal. It is not a claim that stocks will rise.",
  ];
  if (value.currentSavings > value.monthlyContribution * 6 && value.currentSavings > 0) {
    buy.push(
      "You already have a lump sum set aside. Some large fund sponsors have published studies in which investing that sum on arrival beat dripping it in over later months, in most historical periods. Dripping it in can still be easier to stick with. Neither result is promised. The destination either way is this mix.",
    );
  }
  buy.push(
    `This plan does not name a stock to buy. If you research one company, keep it at or under 5% of this goal. Five percent of the savings you entered is ${cap}. Read the latest 10-K and 10-Q on EDGAR first.`,
  );
  buy.push("Do not borrow to buy an investment for this goal.");

  const sell = [
    "There is no price at which this plan says to sell.",
    value.goalUse === "spend"
      ? "Sell or shift as the spending date approaches, along this mix, about once a year. Do it because the date moved closer, not because a day in the market felt important."
      : "When income starts, you do not liquidate the account. You spend from the mix and keep checking the band.",
    `Trim a sleeve when it is ${BAND_POINTS} percentage points above its share. Add to a sleeve when it is ${BAND_POINTS} points below. That is the trade.`,
    "For a single company, reduce it when it grows past 5% of this goal, when the goal needs the cash, or when the reasons you wrote down from the latest 10-K no longer describe the business. An 8-K is a prompt to reread the filing, not an automatic sell.",
  ];

  const rebalance = [
    "Look at least once a year, and again when you add a large amount.",
    `Act when any sleeve is ${BAND_POINTS} percentage points or more away from the mix. Inside the band, do nothing.`,
    value.account === "taxable"
      ? "In a taxable account, send new contributions to the light sleeve before you sell something that would create a tax bill. This is not tax advice."
      : value.account === "education"
        ? "Inside an education account, use the funds that account actually offers and match them to this mix. This is not tax advice."
        : "Inside a retirement account, exchanging one fund for another is often simpler. Use the closest fund your plan actually offers.",
    "A target-date fund rebalances inside one holding. Its glide path will not match this page exactly. Match the year, then read that prospectus.",
  ];

  return { buy, sell, rebalance, yearsNoted: Math.round(years * 10) / 10 };
}

function accountNotes(account) {
  if (account === "retirement") {
    return [
      "A workplace plan or an IRA is a tax wrapper. The mix still has to fit the date. Contribution limits change; read the current IRS pages rather than a remembered number.",
      "If the plan menu has an S&P 500 fund, a bond index, and a stable-value or money-market option, those can stand in for U.S. stocks, bonds, and cash. If there is no international fund, leave that sleeve in your notes instead of forcing a ticker.",
    ];
  }
  if (account === "education") {
    return [
      "A 529 plan is one tax wrapper families use for qualified education costs. The investments inside it still need a horizon that matches the tuition date. Rules are on IRS.gov. This page does not decide whether a 529 fits you.",
    ];
  }
  return [
    "In a taxable account, selling to rebalance can create a tax bill. New contributions are the first lever. ETFs are often more tax-friendly than funds that trade a lot, but that depends on the fund. This is not tax advice.",
  ];
}

export function buildPlan(input, { now = new Date(), context = null } = {}) {
  const { errors, value } = validateInput(input);
  if (errors.length) {
    const error = new Error(errors.join(" "));
    error.status = 400;
    error.details = errors;
    throw error;
  }

  const rawYears = yearsUntil(value.targetDate, now);
  const datePassed = rawYears < 0;
  const years = Math.max(0, rawYears);
  const months = Math.round(years * 12);
  const percents = allocationFor({ years, risk: value.risk, goalUse: value.goalUse });
  const phase = phaseFor(years, value.goalUse);
  const { blended, assumptions } = illustrationRates(percents, context);
  const rates = [
    { id: "lower", label: "Lower illustration", annualRate: Math.max(0, blended - 0.02) },
    { id: "middle", label: "Middle illustration", annualRate: Math.max(0, blended) },
    { id: "higher", label: "Higher illustration", annualRate: blended + 0.02 },
  ];
  const inflation = context?.cpi?.yoyPercent;
  const paths = rates.map((path) => {
    const nominal = futureValue({
      current: value.currentSavings,
      monthly: value.monthlyContribution,
      annualRate: path.annualRate,
      months,
    });
    const real = inflation == null || years <= 0 ? null : nominal / (1 + inflation / 100) ** years;
    return {
      ...path,
      annualPercent: Math.round(path.annualRate * 1000) / 10,
      futureValue: Math.round(nominal),
      realFutureValue: real == null ? null : Math.round(real),
      monthlyToTarget: monthlyNeeded({
        current: value.currentSavings,
        target: value.targetAmount,
        annualRate: path.annualRate,
        months,
      }),
    };
  });

  const contributed = value.currentSavings + value.monthlyContribution * months;
  const allocation = SLEEVES.map((sleeve) => ({
    ...sleeve,
    percent: percents[sleeve.key],
    dollarsNow: Math.round((value.currentSavings * percents[sleeve.key]) / 100),
  }));

  return {
    disclaimer: DISCLAIMER,
    goal: value,
    datePassed,
    horizon: {
      years: Math.round(years * 10) / 10,
      months,
      phase,
    },
    allocation,
    singleCompanyCapPercent: 5,
    rules: buildRules({ value, years, phase }),
    illustration: {
      assumptions,
      contributed: Math.round(contributed),
      paths,
      inflation: context?.cpi || null,
      marketErrors: context?.errors || [],
    },
    funds: fundsForAllocation(allocation),
    targetDateFund: TARGET_DATE,
    accountNotes: accountNotes(value.account),
    context: {
      treasury: context?.treasury || null,
      cpi: context?.cpi || null,
    },
  };
}
