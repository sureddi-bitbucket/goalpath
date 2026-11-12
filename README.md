# Goalpath

Goalpath is a personal education tool for a goal, a date, and a mix of investments. You enter what the money is for, when you need it, what you have saved, and what you can add each month. It answers with a stock, bond, and cash mix, rules for when to add and when to reduce, a 5 percentage-point rebalance band, and examples of mutual funds and ETFs in each category.

It does not name a stock to buy. It does not name a price at which to sell. It does not promise a return.

Goalpath is not an investment adviser, broker, or fiduciary. It does not know your taxes, debts, or the rest of your finances. You can lose money. Read the disclaimer on the page before you use a figure.

## What it reads

Suggestions come from these places, and from the arithmetic in this repository:

| Source | What it is used for |
|---|---|
| [SEC EDGAR](https://www.sec.gov/edgar/searchedgar/companysearch) and [Investor.gov](https://www.investor.gov/introduction-investing/getting-started/asset-allocation) | Company and fund filings. The filing desk opens 10-K, 10-Q, and 8-K documents. Fund examples link to the same EDGAR search. |
| [Treasury daily yield curve](https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve) | The latest 3-month and 10-year yields. They set the illustration rate for cash and bonds. A yield is not a fund's future return. |
| [BLS CPI](https://www.bls.gov/cpi/), series [CUUR0000SA0](https://data.bls.gov/timeseries/CUUR0000SA0) | The latest year-over-year inflation reading, so a long goal can be restated in today's prices. |
| [FDIC](https://www.fdic.gov/resources/deposit-insurance) | The difference between an insured bank deposit and a stock, fund, or ETF, which is not a deposit. |
| [IRS retirement plans](https://www.irs.gov/retirement-plans) and [529 plans](https://www.irs.gov/taxtopics/tc313) | Where to check account rules and limits. The app does not calculate tax. |
| [FRED](https://fred.stlouisfed.org/series/DGS10) | A cross-check. The app does not call FRED, because the Treasury and the BLS publish the figures themselves. |

The only news treated as source material is a filing, especially an 8-K. A headline can be a reason to open that filing. It is not a reason to trade.

The app does not read social media, price-target sites, or hot-stock lists, and it never asks for a brokerage password.

The mix itself is this app's glide path, documented in `lib/plan.js`. A spending goal moves toward cash as the date nears. An income goal keeps a meaningful stock share, because withdrawals can last decades. Stocks inside the stock sleeve are split 70% U.S. and 30% international. The illustration adds 4 percentage points to the 10-year Treasury yield for the stock sleeve. That premium is a round teaching figure, not a forecast.

## Run

Node.js 18 or newer. There is no install step.

```bash
node server.js
```

Open http://localhost:4173

```bash
node --test
```

## What you can do on the page

- Build a plan for a dated purchase or for income that lasts many years.
- See when new money is added, when a sleeve is reduced, and when a 5 point gap is wide enough to rebalance.
- Enter dollars you already hold and check them against that band.
- Look up one company's SEC filings.
- Copy a plain-text note that includes the disclaimer.
