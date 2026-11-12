import assert from "node:assert/strict";
import test from "node:test";
import { allocationFor, assessDrift, buildPlan, futureValue, monthlyNeeded, roundTo100, yearsUntil } from "../lib/plan.js";
import { inflationFromBls, parseTreasuryCsv } from "../lib/market.js";
import { pickFilings } from "../lib/sec.js";

const now = new Date(2026, 10, 12);

test("percentages sum to 100 and a distant spend goal holds more stock than a near one", () => {
  const far = allocationFor({ years: 25, risk: "moderate", goalUse: "spend" });
  const near = allocationFor({ years: 0.4, risk: "conservative", goalUse: "spend" });
  for (const mix of [far, near]) {
    const sum = Object.values(mix).reduce((total, value) => total + value, 0);
    assert.equal(sum, 100);
  }
  const stock = (mix) => mix.usStock + mix.intlStock;
  assert.ok(stock(far) > 80);
  assert.ok(stock(near) <= 20);
  assert.ok(near.cash > near.usStock);
});

test("an income goal keeps more stock near the date than a spending goal", () => {
  const spend = allocationFor({ years: 0.5, risk: "moderate", goalUse: "spend" });
  const ongoing = allocationFor({ years: 0.5, risk: "moderate", goalUse: "ongoing" });
  assert.ok(ongoing.usStock + ongoing.intlStock > spend.usStock + spend.intlStock);
});

test("conservative holds less stock than growth on a long spend goal", () => {
  const conservative = allocationFor({ years: 20, risk: "conservative", goalUse: "spend" });
  const growth = allocationFor({ years: 20, risk: "growth", goalUse: "spend" });
  const stock = (mix) => mix.usStock + mix.intlStock;
  assert.ok(stock(conservative) < stock(growth));
  assert.ok(stock(growth) <= 95);
});

test("zero illustration rate equals savings plus contributions", () => {
  assert.equal(futureValue({ current: 1000, monthly: 100, annualRate: 0, months: 12 }), 2200);
});

test("monthly amount closes the gap at a zero rate", () => {
  const needed = monthlyNeeded({ current: 2000, target: 8000, annualRate: 0, months: 10 });
  assert.equal(needed, 600);
});

test("rebalance band flags a 6 point drift and ignores a 2 point drift", () => {
  const result = assessDrift(
    { usStock: 40, intlStock: 20, bonds: 30, cash: 10 },
    { usStock: 46, intlStock: 18, bonds: 32, cash: 4 },
  );
  const byKey = Object.fromEntries(result.rows.map((row) => [row.key, row.action]));
  assert.equal(byKey.usStock, "trim");
  assert.equal(byKey.intlStock, "inside the band");
  assert.equal(byKey.cash, "add");
});

test("a past date is marked and does not throw", () => {
  const plan = buildPlan(
    {
      goalName: "Tuition",
      goalUse: "spend",
      risk: "conservative",
      account: "education",
      targetAmount: 20000,
      currentSavings: 8000,
      monthlyContribution: 500,
      targetDate: "2020-01-01",
    },
    { now, context: null },
  );
  assert.equal(plan.datePassed, true);
  assert.equal(plan.horizon.years, 0);
  assert.equal(plan.rules.sell[0], "There is no price at which this plan says to sell.");
});

test("years until a fixed date stay stable", () => {
  const years = yearsUntil("2030-11-12", now);
  assert.ok(years > 3.9 && years < 4.1);
});

test("rounding is deterministic and sums to 100", () => {
  const rounded = roundTo100({ usStock: 47.25, intlStock: 20.25, bonds: 32.5, cash: 0 });
  assert.equal(Object.values(rounded).reduce((sum, value) => sum + value, 0), 100);
  assert.deepEqual(roundTo100({ usStock: 47.25, intlStock: 20.25, bonds: 32.5, cash: 0 }), rounded);
});

test("treasury csv uses the newest yield row", () => {
  const parsed = parseTreasuryCsv(`Date,"1 Mo","3 Mo","10 Yr"
11/12/2026,3.70,3.64,4.17
11/10/2026,3.69,3.63,4.15`);
  assert.equal(parsed.date, "11/12/2026");
  assert.equal(parsed.threeMonth, 3.64);
  assert.equal(parsed.tenYear, 4.17);
});

test("cpi skips a month that has no reading from the year before", () => {
  const inflation = inflationFromBls({
    Results: {
      series: [
        {
          data: [
            { year: "2026", period: "M10", periodName: "October", value: "110" },
            { year: "2025", period: "M10", periodName: "October", value: "-" },
            { year: "2026", period: "M09", periodName: "September", value: "108" },
            { year: "2025", period: "M09", periodName: "September", value: "100" },
          ],
        },
      ],
    },
  });
  assert.equal(inflation.period, "September 2026");
  assert.equal(inflation.yoyPercent, 8);
  assert.match(inflation.note, /October 2026/);
});

test("cpi year over year uses the same month a year earlier", () => {
  const inflation = inflationFromBls({
    Results: {
      series: [
        {
          data: [
            { year: "2026", period: "M10", periodName: "October", value: "110" },
            { year: "2025", period: "M10", periodName: "October", value: "100" },
          ],
        },
      ],
    },
  });
  assert.equal(inflation.yoyPercent, 10);
  assert.equal(inflation.period, "October 2026");
});

test("filing picker keeps the latest annual report and three 8-Ks", () => {
  const filings = pickFilings({
    form: ["8-K", "8-K", "10-Q", "8-K", "8-K", "10-K"],
    filingDate: ["2026-11-01", "2026-10-01", "2026-08-01", "2026-07-01", "2026-06-01", "2026-01-15"],
    primaryDocument: ["a.htm", "b.htm", "c.htm", "d.htm", "e.htm", "f.htm"],
    primaryDocDescription: ["", "", "", "", "", ""],
    accessionNumber: ["1", "2", "3", "4", "5", "6"],
  });
  assert.equal(filings.filter((row) => row.form === "8-K").length, 3);
  assert.ok(filings.some((row) => row.form === "10-K"));
  assert.ok(filings.some((row) => row.form === "10-Q"));
});

test("an education account does not get retirement-account instructions", () => {
  const plan = buildPlan(
    {
      goalName: "Tuition",
      goalUse: "spend",
      risk: "conservative",
      account: "education",
      targetAmount: 25000,
      currentSavings: 6000,
      monthlyContribution: 400,
      targetDate: "2028-05-12",
    },
    { now, context: null },
  );
  const text = plan.rules.rebalance.join(" ");
  assert.match(text, /education account/i);
  assert.doesNotMatch(text, /retirement account/i);
});

test("bad input is rejected", () => {
  assert.throws(() => buildPlan({ targetAmount: 0 }, { now }), /target amount/i);
});
