export const SOURCES = [
  {
    id: "sec",
    name: "SEC EDGAR and Investor.gov",
    kind: "Regulator",
    role: "Public companies and registered funds must file here. A 10-K is the annual report, a 10-Q is the quarterly report, and an 8-K is how a company reports a material event. Fund prospectuses and portfolio reports are filed here too.",
    usedFor: "The filing desk, the official link on every fund example, and the rule that a headline is not a trade.",
    links: [
      { label: "EDGAR company search", url: "https://www.sec.gov/edgar/searchedgar/companysearch" },
      { label: "Asset allocation", url: "https://www.investor.gov/introduction-investing/getting-started/asset-allocation" },
      { label: "Mutual funds", url: "https://www.investor.gov/introduction-investing/investing-basics/investment-products/mutual-funds-and-exchange-traded-funds-etfs/mutual-funds" },
      { label: "ETFs", url: "https://www.investor.gov/introduction-investing/investing-basics/investment-products/mutual-funds-and-exchange-traded-2" },
      {
        label: "Mutual funds and ETFs bulletin",
        url: "https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/characteristics-mutual-funds-exchange-traded-funds",
      },
      {
        label: "Target-date funds bulletin",
        url: "https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins/target-date-funds-investor-bulletin",
      },
    ],
  },
  {
    id: "treasury",
    name: "U.S. Treasury daily yield curve",
    kind: "Official statistic",
    role: "The Treasury publishes yields on its own bills, notes, and bonds each business day. Goalpath reads the 3-month and 10-year yields from that table.",
    usedFor: "A live interest-rate context, and the illustration rate for the cash and bond sleeves. A yield is not a forecast of a fund's return.",
    links: [
      {
        label: "Daily Treasury par yield curve",
        url: "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve",
      },
    ],
  },
  {
    id: "bls",
    name: "Bureau of Labor Statistics CPI",
    kind: "Official statistic",
    role: "The Consumer Price Index for All Urban Consumers (CPI-U), U.S. city average, not seasonally adjusted. Series CUUR0000SA0.",
    usedFor: "The latest year-over-year inflation reading, so a long goal can be restated in today's prices. Last year's inflation is not next year's inflation.",
    links: [
      { label: "CPI home", url: "https://www.bls.gov/cpi/" },
      { label: "Series CUUR0000SA0", url: "https://data.bls.gov/timeseries/CUUR0000SA0" },
    ],
  },
  {
    id: "fdic",
    name: "FDIC deposit insurance",
    kind: "Regulator",
    role: "Bank deposits can be insured up to the FDIC limit. Shares of a stock, mutual fund, or ETF are not bank deposits and are not FDIC insured, even when a bank's brokerage holds them.",
    usedFor: "The cash note on near-term goals: compare Treasury bills, Treasury funds, and insured deposits as different tools.",
    links: [{ label: "Understanding deposit insurance", url: "https://www.fdic.gov/resources/deposit-insurance" }],
  },
  {
    id: "irs",
    name: "Internal Revenue Service",
    kind: "Official",
    role: "Account type changes the tax treatment. Contribution limits change, and they are easy to get wrong from memory.",
    usedFor: "Pointers only, for workplace plans, IRAs, and 529 education savings. Goalpath does not calculate your tax.",
    links: [
      { label: "Retirement plans", url: "https://www.irs.gov/retirement-plans" },
      { label: "Topic 313, 529 plans", url: "https://www.irs.gov/taxtopics/tc313" },
    ],
  },
  {
    id: "fred",
    name: "FRED, Federal Reserve Bank of St. Louis",
    kind: "Cross-check",
    role: "FRED republishes series such as the 10-year Treasury yield (DGS10) and CPI (CPIAUCSL). Goalpath does not need a FRED key because it reads the Treasury and the BLS directly. FRED is the place to cross-check a figure.",
    usedFor: "A second look when you want to see the history of a series, not a live feed inside this app.",
    links: [
      { label: "10-year Treasury on FRED", url: "https://fred.stlouisfed.org/series/DGS10" },
      { label: "CPI on FRED", url: "https://fred.stlouisfed.org/series/CPIAUCSL" },
    ],
  },
];

export const NOT_USED = [
  "Social media, group chats, and influencer stock picks",
  "Unsigned price targets and lists of hot stocks",
  "General headlines used as a buy or sell signal",
  "Any screen that asks for a brokerage password",
];

export const NEWS_POLICY =
  "The only market news this app treats as source material is a filing the company or the fund made with the SEC, especially an 8-K. A headline can be a reason to open that filing. It is not itself a reason to trade.";

export const DISCLAIMER =
  "Goalpath is a personal education tool. It is not an investment adviser, broker-dealer, or fiduciary, and it does not know your full finances, taxes, or debts. Nothing here is a recommendation to buy or sell any security, a prediction of a price, or a guarantee of return or of principal. You can lose money, including over many years. Government figures can be revised. Fund names are examples of a category; read the current prospectus and the SEC filings before you invest. Past results are not future results.";
