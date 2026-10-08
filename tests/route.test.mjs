import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import ts from "typescript";
import * as order from "../lib/order.ts";

const catalog = [{ id: "qa-only", name: "QA fixture", description: "", material: "", image: "/qa.webp", imageAlt: "QA",
  variants: [{ id: "qa-size", size: "160 × 230 см", priceKopiykas: 325000, available: true }] }];
function makeApi() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../drizzle/0000_free_dark_phoenix.sql", import.meta.url), "utf8"));
  const env = { DB: { prepare(sql) {
    const statement = db.prepare(sql);
    return { bind(...values) { return {
      async run() { return statement.run(...values); },
      async first() { return statement.get(...values) ?? null; },
    }; } };
  } } };
  const code = ts.transpileModule(readFileSync(new URL("../app/api/orders/route.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  const require = (name) => {
    if (name === "cloudflare:workers") return { env };
    if (name === "@/lib/catalog") return { getCatalog: () => catalog };
    if (name === "@/lib/order") return order;
    throw new Error("Unexpected module: " + name);
  };
  new Function("require", "exports", "module", code)(require, module.exports, module);
  return { POST: module.exports.POST, db, env };
}
const origin = "https://kotys.test";
const input = () => ({
  requestId: crypto.randomUUID(), name: "QA fixture", phone: "+380501234567", email: "", note: "",
  items: [{ productId: "qa-only", variantId: "qa-size", quantity: 2 }],
});
const req = (body, overrides = {}) => new Request(origin + "/api/orders", {
  method: "POST", headers: { Origin: origin, "Content-Type": "application/json", ...overrides },
  body: typeof body === "string" ? body : JSON.stringify(body),
});

test("order persists in SQLite with server prices and repeat submission reuses one row", async () => {
  const { POST, db } = makeApi(); const body = input();
  const first = await POST(req(body)); assert.equal(first.status, 201);
  const receipt = await first.json(); assert.equal(receipt.totalKopiykas, 650000); assert.match(receipt.orderNumber, /^KC-/);
  const second = await POST(req(body)); assert.equal(second.status, 201); assert.deepEqual(await second.json(), receipt);
  const saved = db.prepare("SELECT * FROM order_requests").all(); assert.equal(saved.length, 1);
  assert.equal(saved[0].phone, body.phone); assert.equal(saved[0].total_kopiykas, 650000);
  assert.equal(JSON.parse(saved[0].items_json)[0].priceKopiykas, 325000);
  const conflict = await POST(req({ ...body, phone: "+380501234568" })); assert.equal(conflict.status, 409);
  assert.equal(db.prepare("SELECT count(*) AS n FROM order_requests").get().n, 1);
  db.close();
});
test("bad origins, malformed data, oversized requests and fabricated prices do not write orders", async () => {
  const { POST, db } = makeApi();
  assert.equal((await POST(req(input(), { Origin: "https://example.invalid" }))).status, 403);
  assert.equal((await POST(req(input(), { "Content-Type": "text/plain" }))).status, 415);
  assert.equal((await POST(req("{"))).status, 400);
  assert.equal((await POST(req("x".repeat(12001)))).status, 413);
  assert.equal((await POST(req({ ...input(), totalKopiykas: 1 }))).status, 400);
  assert.equal((await POST(req({ ...input(), items: [{ productId: "qa-only", variantId: "unknown", quantity: 1 }] }))).status, 409);
  assert.equal(db.prepare("SELECT count(*) AS n FROM order_requests").get().n, 0);
  db.close();
});
test("unavailable database never returns success", async () => {
  const { POST, env, db } = makeApi();
  env.DB = undefined;
  const unavailable = await POST(req(input())); assert.equal(unavailable.status, 503);
  assert.match((await unavailable.json()).error, /не вдалося зберегти/);
  assert.equal(db.prepare("SELECT count(*) AS n FROM order_requests").get().n, 0);
  db.close();
});
