const form = document.querySelector("#goal-form");
const result = document.querySelector("#result");
const formError = document.querySelector("#form-error");
const filingForm = document.querySelector("#filing-form");
const filingResult = document.querySelector("#filing-result");
const sourcesRoot = document.querySelector("#sources");
const footerDisclaimer = document.querySelector("#footer-disclaimer");

let lastPlan = null;

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return node;
}

function list(items) {
  return el("ul", {}, items.map((item) => el("li", {}, [item])));
}

function shiftMonths(months) {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

const examples = {
  house: { goalName: "House down payment", goalUse: "spend", targetAmount: 80000, currentSavings: 15000, monthlyContribution: 700, targetDate: shiftMonths(48), risk: "moderate", account: "taxable" },
  retirement: { goalName: "Retirement income", goalUse: "ongoing", targetAmount: 1000000, currentSavings: 40000, monthlyContribution: 800, targetDate: shiftMonths(300), risk: "growth", account: "retirement" },
  tuition: { goalName: "Tuition", goalUse: "spend", targetAmount: 25000, currentSavings: 6000, monthlyContribution: 400, targetDate: shiftMonths(18), risk: "conservative", account: "education" },
};

function applyExample(name) {
  const example = examples[name];
  for (const [key, value] of Object.entries(example)) {
    const field = form.elements[key];
    if (!field) continue;
    if (field instanceof RadioNodeList) field.value = value;
    else field.value = value;
  }
}

function payloadFromForm() {
  const data = new FormData(form);
  return {
    goalName: data.get("goalName"),
    goalUse: data.get("goalUse"),
    risk: data.get("risk"),
    account: data.get("account"),
    targetAmount: Number(data.get("targetAmount")),
    currentSavings: Number(data.get("currentSavings")),
    monthlyContribution: Number(data.get("monthlyContribution")),
    targetDate: data.get("targetDate"),
  };
}

function showError(message) {
  formError.hidden = false;
  formError.textContent = message;
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "The plan could not be built.");
  return payload;
}

function summaryText(plan) {
  const mix = plan.allocation.map((row) => `${row.label}: ${row.percent}%`).join("\n");
  return [
    plan.goal.goalName,
    plan.disclaimer,
    "",
    `${plan.horizon.phase.title}. ${plan.horizon.years} years.`,
    plan.horizon.phase.summary,
    "",
    mix,
    "",
    "When to add:",
    ...plan.rules.buy.map((line) => `- ${line}`),
    "",
    "When to reduce:",
    ...plan.rules.sell.map((line) => `- ${line}`),
    "",
    "Rebalance:",
    ...plan.rules.rebalance.map((line) => `- ${line}`),
  ].join("\n");
}

function renderPlan(plan) {
  lastPlan = plan;
  result.replaceChildren();

  const phase = el("div", { class: "phase" }, [
    el("div", {}, [el("strong", {}, [plan.horizon.phase.title]), el("p", {}, [plan.goal.goalName])]),
    el("p", {}, [`${plan.horizon.years} years · ${plan.horizon.months} months`]),
  ]);
  result.append(phase);
  if (plan.datePassed) {
    result.append(el("p", { class: "form-error" }, ["That date has already passed. The mix below is the preserve mix, as if the money is needed now."]));
  }
  result.append(el("p", {}, [plan.horizon.phase.summary]));

  const bar = el("div", { class: "bar", role: "img", "aria-label": "Allocation bar" });
  for (const row of plan.allocation) {
    if (row.percent > 0) bar.append(el("span", { class: row.key, style: `width:${row.percent}%` }));
  }
  result.append(bar);

  const table = el("table", {}, [
    el("thead", {}, [el("tr", {}, ["Sleeve", "Share", "Of the savings you entered"].map((label) => el("th", {}, [label])))]),
    el("tbody", {}, plan.allocation.map((row) => el("tr", {}, [
      el("td", {}, [el("i", { class: `swatch ${row.key}`, "aria-hidden": "true" }), row.label]),
      el("td", {}, [`${row.percent}%`]),
      el("td", {}, [money.format(row.dollarsNow)]),
    ]))),
  ]);
  result.append(table);
  result.append(el("p", {}, [plan.allocation.map((row) => row.detail).filter((detail, index) => plan.allocation[index].percent > 0).join(" ")]));

  const figures = el("div", { class: "figures" });
  const treasury = plan.context.treasury;
  figures.append(el("article", {}, [
    el("h3", {}, ["Treasury yield curve"]),
    el("p", { class: "big" }, [treasury ? `${treasury.tenYear}%` : "Unavailable"]),
    el("p", {}, [treasury ? `${treasury.date}: 10-year ${treasury.tenYear}%, 3-month ${treasury.threeMonth ?? "n/a"}%.` : "The illustration used a stand-in yield."]),
  ]));
  const cpi = plan.context.cpi;
  figures.append(el("article", {}, [
    el("h3", {}, ["CPI-U inflation"]),
    el("p", { class: "big" }, [cpi?.yoyPercent == null ? "Unavailable" : `${cpi.yoyPercent}%`]),
    el("p", {}, [
      cpi?.yoyPercent == null
        ? "BLS did not return a year-over-year rate."
        : `${cpi.period} versus ${cpi.priorPeriod}, not seasonally adjusted, series ${cpi.seriesId}. ${cpi.note || ""}`.trim(),
    ]),
  ]));
  result.append(figures);
  for (const note of plan.illustration.marketErrors) result.append(el("p", {}, [note]));

  const rules = el("div", { class: "rules" });
  rules.append(el("article", {}, [el("h3", {}, ["When to add"]), list(plan.rules.buy)]));
  rules.append(el("article", {}, [el("h3", {}, ["When to reduce"]), list(plan.rules.sell)]));
  rules.append(el("article", {}, [el("h3", {}, ["When to rebalance"]), list(plan.rules.rebalance)]));
  result.append(rules);

  const middle = plan.illustration.paths.find((path) => path.id === "middle");
  const illustration = el("div", { class: "callout" }, [
    el("h3", {}, ["Illustration, not a forecast"]),
    el("p", {}, [`Of your own money, contributions plus what you already saved come to ${money.format(plan.illustration.contributed)} by the date. Anything above that depends on markets.`]),
  ]);
  if (middle?.monthlyToTarget > 0) {
    illustration.append(el("p", {}, [`Under the middle illustration only, about ${money.format(middle.monthlyToTarget)} a month lines up with ${money.format(plan.goal.targetAmount)}. A lower result needs more. This is arithmetic on an assumed rate.`]));
  }
  result.append(illustration);
  result.append(list(plan.illustration.assumptions));

  const pathTable = el("table", {}, [
    el("thead", {}, [el("tr", {}, ["Path", "Illustration rate", "Future dollars", "In today's prices"].map((label) => el("th", {}, [label])))]),
    el("tbody", {}, plan.illustration.paths.map((path) => el("tr", {}, [
      el("td", {}, [path.label]),
      el("td", {}, [`${path.annualPercent}%`]),
      el("td", {}, [money.format(path.futureValue)]),
      el("td", {}, [path.realFutureValue == null ? "—" : money.format(path.realFutureValue)]),
    ]))),
  ]);
  result.append(pathTable);

  result.append(el("h3", {}, ["Account"]));
  result.append(el("ul", { class: "notes" }, plan.accountNotes.map((note) => el("li", {}, [note]))));

  result.append(el("h3", {}, ["Fund and ETF examples"]));
  result.append(el("p", {}, ["These are examples of a category from large sponsors. They are not a ranking, and the expense ratio on a sponsor's site can change. Open the SEC filing and read the current prospectus."]));
  const funds = el("div", { class: "funds" });
  for (const fund of plan.funds) {
    funds.append(el("article", { class: "fund" }, [
      el("h3", {}, [el("span", { class: "ticker" }, [fund.ticker]), ` ${fund.name}`]),
      el("p", {}, [`${fund.vehicle}. ${fund.holds}`]),
      el("p", {}, [fund.note]),
      el("p", {}, [el("a", { href: fund.filingUrl, target: "_blank", rel: "noopener noreferrer" }, ["SEC filings for this ticker"])]),
    ]));
  }
  result.append(funds);

  const target = el("div", { class: "callout" }, [
    el("h3", {}, [plan.targetDateFund.title]),
    el("p", {}, [plan.targetDateFund.body]),
    el("p", {}, [el("a", { href: plan.targetDateFund.links[0].url, target: "_blank", rel: "noopener noreferrer" }, [plan.targetDateFund.links[0].label])]),
  ]);
  result.append(target);

  result.append(el("h3", {}, ["Check a mix you already hold"]));
  result.append(el("p", {}, ["Enter dollars in each sleeve. The band is 5 percentage points. Inside it, the note says to leave the mix alone."]));
  const drift = el("form", { id: "drift-form" });
  for (const row of plan.allocation) {
    drift.append(el("label", {}, [
      row.label,
      el("input", { name: row.key, type: "number", min: "0", step: "1", value: String(row.dollarsNow) }),
    ]));
  }
  drift.append(el("button", { type: "submit" }, ["Check the band"]));
  result.append(drift);
  result.append(el("div", { id: "drift-result" }));

  const actions = el("div", { class: "actions" });
  const copy = el("button", { type: "button" }, ["Copy this note"]);
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(summaryText(plan));
      copy.textContent = "Copied";
    } catch {
      copy.textContent = "Select the note and copy it by hand";
    }
  });
  actions.append(copy);
  result.append(actions);
  result.append(el("p", {}, [plan.disclaimer]));

  drift.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(drift);
    const holdings = Object.fromEntries(plan.allocation.map((row) => [row.key, Number(data.get(row.key))]));
    const button = drift.querySelector("button");
    button.disabled = true;
    try {
      const driftPlan = await postJson("/api/rebalance", { goal: plan.goal, holdings });
      renderDrift(driftPlan);
    } catch (error) {
      document.querySelector("#drift-result").replaceChildren(el("p", { class: "form-error" }, [error.message]));
    } finally {
      button.disabled = false;
    }
  });
}

function renderDrift(driftPlan) {
  const root = document.querySelector("#drift-result");
  const table = el("table", {}, [
    el("thead", {}, [el("tr", {}, ["Sleeve", "Now", "Target", "Drift", "Note"].map((label) => el("th", {}, [label])))]),
    el("tbody", {}, driftPlan.rows.map((row) => el("tr", {}, [
      el("td", {}, [row.label]),
      el("td", {}, [`${row.currentPct}%`]),
      el("td", {}, [`${row.targetPct}%`]),
      el("td", {}, [`${row.drift > 0 ? "+" : ""}${row.drift}`]),
      el("td", {}, [row.action]),
    ]))),
  ]);
  root.replaceChildren(el("p", {}, [`Checked against a ${driftPlan.band} percentage-point band. Total entered: ${money.format(driftPlan.total)}.`]), table);
}

function renderCompany(company) {
  const cap = lastPlan ? money.format(lastPlan.goal.currentSavings * (lastPlan.singleCompanyCapPercent / 100)) : null;
  const items = [
    el("h3", {}, [company.name]),
    el("p", {}, [`${company.ticker} · CIK ${company.cik}. This is a reading list, not a buy or a sell.`]),
    cap ? el("p", {}, [`Five percent of the savings in the plan on screen is ${cap}.`]) : el("p", {}, ["Build a plan first if you want that 5% cap in dollars."]),
    el("ul", { class: "check" }, company.checklist.map((item) => el("li", {}, [item]))),
    el("ul", { class: "filing-list" }, company.filings.map((filing) => el("li", {}, [
      el("a", { href: filing.url, target: "_blank", rel: "noopener noreferrer" }, [`${filing.form} · ${filing.filed}`]),
    ]))),
    el("p", {}, [el("a", { href: company.searchUrl, target: "_blank", rel: "noopener noreferrer" }, ["All filings on EDGAR"])]),
  ];
  filingResult.replaceChildren(...items);
}

async function loadSources() {
  const response = await fetch("/api/sources");
  const payload = await response.json();
  footerDisclaimer.textContent = payload.disclaimer;
  const blocks = payload.sources.map((source) => el("article", { class: "source" }, [
    el("p", { class: "kind" }, [source.kind]),
    el("h3", {}, [source.name]),
    el("p", {}, [source.role]),
    el("p", {}, [source.usedFor]),
    el("p", {}, source.links.map((link, index) => {
      const anchor = el("a", { href: link.url, target: "_blank", rel: "noopener noreferrer" }, [link.label]);
      return index === 0 ? anchor : el("span", {}, [" · ", anchor]);
    })),
  ]));
  sourcesRoot.replaceChildren(
    el("p", {}, [payload.newsPolicy]),
    ...blocks,
    el("h3", {}, ["Left unread on purpose"]),
    el("ul", { class: "skip" }, payload.notUsed.map((item) => el("li", {}, [item]))),
  );
}

form.querySelector(".examples").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (button?.dataset.example) applyExample(button.dataset.example);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formError.hidden = true;
  const button = document.querySelector("#build");
  button.disabled = true;
  button.textContent = "Reading official figures…";
  try {
    renderPlan(await postJson("/api/plan", payloadFromForm()));
  } catch (error) {
    showError(error.message);
  } finally {
    button.disabled = false;
    button.textContent = "Show the educational plan";
  }
});

filingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const ticker = new FormData(filingForm).get("ticker");
  filingResult.replaceChildren(el("p", {}, ["Opening the SEC list…"]));
  try {
    const response = await fetch(`/api/company?ticker=${encodeURIComponent(ticker)}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "No filing was found.");
    renderCompany(payload);
  } catch (error) {
    filingResult.replaceChildren(el("p", { class: "form-error" }, [error.message]));
  }
});

loadSources().catch(() => {
  sourcesRoot.textContent = "The source list could not be loaded.";
});
