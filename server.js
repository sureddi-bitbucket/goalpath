import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPlan, assessDrift, validateInput } from "./lib/plan.js";
import { getMarketContext } from "./lib/market.js";
import { lookupCompany } from "./lib/sec.js";
import { DISCLAIMER, NEWS_POLICY, NOT_USED, SOURCES } from "./lib/sources.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, "public");
const port = Number(process.env.PORT) || 4173;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

function send(response, status, body, type = "application/json; charset=utf-8") {
  response.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(body);
}

function sendJson(response, status, payload) {
  send(response, status, JSON.stringify(payload));
}

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 20_000) {
      const error = new Error("The request is too large.");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Send the form as JSON.");
    error.status = 400;
    throw error;
  }
}

async function serveStatic(response, urlPath) {
  const requested = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.join(publicDir, path.normalize(requested));
  const relative = path.relative(publicDir, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    send(response, 403, "Forbidden", "text/plain; charset=utf-8");
    return;
  }
  try {
    const file = await readFile(filePath);
    send(response, 200, file, TYPES[path.extname(filePath)] || "application/octet-stream");
  } catch {
    send(response, 404, "Not found", "text/plain; charset=utf-8");
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  try {
    if (request.method === "GET" && url.pathname === "/api/sources") {
      sendJson(response, 200, { disclaimer: DISCLAIMER, newsPolicy: NEWS_POLICY, notUsed: NOT_USED, sources: SOURCES });
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/context") {
      sendJson(response, 200, await getMarketContext());
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/company") {
      sendJson(response, 200, await lookupCompany(url.searchParams.get("ticker")));
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/plan") {
      const body = await readBody(request);
      const context = await getMarketContext();
      sendJson(response, 200, await buildPlan(body, { context }));
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/rebalance") {
      const body = await readBody(request);
      const checked = validateInput({
        ...body.goal,
        goalName: body.goal?.goalName || "Rebalance check",
      });
      if (checked.errors.length) {
        sendJson(response, 400, { error: checked.errors.join(" ") });
        return;
      }
      const plan = buildPlan(checked.value);
      const targets = Object.fromEntries(plan.allocation.map((row) => [row.key, row.percent]));
      sendJson(response, 200, assessDrift(targets, body.holdings));
      return;
    }
    if (request.method === "GET") {
      await serveStatic(response, url.pathname);
      return;
    }
    sendJson(response, 405, { error: "That action is not available." });
  } catch (error) {
    const status = error.status || 502;
    sendJson(response, status, { error: error.details ? error.details.join(" ") : error.message });
  }
});

server.listen(port, () => {
  console.log(`Goalpath is at http://localhost:${port}`);
});
