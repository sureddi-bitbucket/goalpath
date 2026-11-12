function edgar(ticker) {
  return `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&ticker=${encodeURIComponent(ticker)}&owner=exclude&count=20`;
}

export const FUNDS = [
  {
    sleeve: "usStock",
    vehicle: "ETF",
    ticker: "VTI",
    name: "Vanguard Total Stock Market ETF",
    holds: "A very broad set of U.S. companies in one fund, from large to small.",
    note: "An example of a total U.S. stock market fund. Confirm the expense ratio and the index in the current prospectus.",
  },
  {
    sleeve: "usStock",
    vehicle: "ETF",
    ticker: "ITOT",
    name: "iShares Core S&P Total U.S. Stock Market ETF",
    holds: "Another broad U.S. stock fund, from a different sponsor.",
    note: "Shown so the category is not tied to one company. Compare cost and holdings in the prospectus.",
  },
  {
    sleeve: "usStock",
    vehicle: "Mutual fund",
    ticker: "SWTSX",
    name: "Schwab Total Stock Market Index Fund",
    holds: "A mutual-fund version of a broad U.S. stock index. Mutual funds can suit an automatic monthly investment.",
    note: "Share classes and minimums differ. Read the summary prospectus before choosing a class.",
  },
  {
    sleeve: "intlStock",
    vehicle: "ETF",
    ticker: "VXUS",
    name: "Vanguard Total International Stock ETF",
    holds: "Companies outside the United States, in both developed and emerging markets.",
    note: "International stocks can fall when U.S. stocks fall. They are a diversifier, not a shock absorber you can count on.",
  },
  {
    sleeve: "intlStock",
    vehicle: "ETF",
    ticker: "IXUS",
    name: "iShares Core MSCI Total International Stock ETF",
    holds: "A second sponsor's broad international stock fund.",
    note: "Compare the index, countries, and expense ratio with VXUS in the two prospectuses.",
  },
  {
    sleeve: "bonds",
    vehicle: "ETF",
    ticker: "BND",
    name: "Vanguard Total Bond Market ETF",
    holds: "Investment-grade U.S. bonds: Treasuries, mortgages, and corporate bonds.",
    note: "Bond funds can lose value when yields rise. The yield on this page is not this fund's future return.",
  },
  {
    sleeve: "bonds",
    vehicle: "ETF",
    ticker: "AGG",
    name: "iShares Core U.S. Aggregate Bond ETF",
    holds: "A broad investment-grade U.S. bond index from another sponsor.",
    note: "Same category as BND. Pick from the prospectus, not from a headline about rates.",
  },
  {
    sleeve: "cash",
    vehicle: "ETF",
    ticker: "SGOV",
    name: "iShares 0-3 Month Treasury Bond ETF",
    holds: "Very short U.S. Treasury bills.",
    note: "A fund of Treasury bills is not an FDIC-insured deposit. The price can move a little. Read the prospectus.",
  },
  {
    sleeve: "cash",
    vehicle: "ETF",
    ticker: "BIL",
    name: "SPDR Bloomberg 1-3 Month T-Bill ETF",
    holds: "Another short Treasury-bill fund.",
    note: "Compare the yield after fees with a Treasury bill you buy yourself, and with an insured savings account.",
  },
];

export function fundsForAllocation(allocation) {
  const byKey = Object.fromEntries(allocation.map((row) => [row.key, row.percent]));
  return FUNDS.filter((fund) => (byKey[fund.sleeve] || 0) > 0).map((fund) => ({
    ...fund,
    filingUrl: edgar(fund.ticker),
  }));
}

export const TARGET_DATE = {
  title: "A target-date fund is the one-fund version of this idea",
  body: "The year in the name is the fund's target year. The fund company moves the mix over time. That path will not match the table on this page exactly, and two funds with the same year can differ. Some funds inside retirement plans are collective investment trusts, which are not filed with the SEC the way a mutual fund is. Read the Investor.gov bulletin, then the prospectus for the exact fund.",
  links: [
    {
      label: "SEC Investor Bulletin on target-date funds",
      url: "https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins/target-date-funds-investor-bulletin",
    },
  ],
};
