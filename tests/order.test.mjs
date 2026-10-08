import test from "node:test";
import assert from "node:assert/strict";
import { orderSchema, calculateOrder, InvalidCartError } from "../lib/order.ts";

const catalog = [{
  id: "qa-carpet", name: "QA fixture", description: "", material: "", image: "/qa.webp", imageAlt: "QA fixture",
  variants: [
    { id: "small", size: "100 × 150 см", priceKopiykas: 250000, available: true },
    { id: "large", size: "200 × 300 см", priceKopiykas: 650000, available: true },
    { id: "sold", size: "160 × 230 см", priceKopiykas: 400000, available: false },
  ],
}];
const base = {
  requestId: "cc86b1cd-3bf8-4ea1-bdc5-658a35be6c07", name: "Тест", phone: "+380501234567", email: "", note: "",
  items: [{ productId: "qa-carpet", variantId: "small", quantity: 2 }],
};
test("totals use the chosen server-side variant prices, in integer kopecks", () => {
  const input = orderSchema.parse({ ...base, items: [...base.items, { productId: "qa-carpet", variantId: "large", quantity: 1 }] });
  const result = calculateOrder(input, catalog);
  assert.equal(result.totalKopiykas, 1150000);
  assert.equal(result.items[0].name, "QA fixture");
  assert.equal(result.items[1].size, "200 × 300 см");
});
test("client-provided prices and totals are rejected", () => {
  assert.equal(orderSchema.safeParse({ ...base, totalKopiykas: 1 }).success, false);
  assert.equal(orderSchema.safeParse({ ...base, items: [{ ...base.items[0], priceKopiykas: 1 }] }).success, false);
});
test("unavailable, unknown and empty catalogs cannot produce orders", () => {
  for (const id of ["sold", "does-not-exist"]) {
    assert.throws(() => calculateOrder({ ...base, items: [{ ...base.items[0], variantId: id }] }, catalog), InvalidCartError);
  }
  assert.throws(() => calculateOrder(base, []), InvalidCartError);
});
test("invalid quantities and incomplete contacts fail validation", () => {
  for (const quantity of [0, -1, 1.5, 21]) {
    assert.equal(orderSchema.safeParse({ ...base, items: [{ ...base.items[0], quantity }] }).success, false);
  }
  assert.equal(orderSchema.safeParse({ ...base, phone: "123" }).success, false);
  assert.equal(orderSchema.safeParse({ ...base, name: " " }).success, false);
  assert.equal(orderSchema.safeParse({ ...base, email: "not-an-email" }).success, false);
  assert.equal(orderSchema.safeParse({ ...base, items: [] }).success, false);
});
test("duplicate lines and aggregate quantities above the limit fail", () => {
  assert.throws(() => calculateOrder({ ...base, items: [base.items[0], base.items[0]] }, catalog), InvalidCartError);
  assert.throws(() => calculateOrder({ ...base, items: [
    { ...base.items[0], quantity: 15 },
    { productId: "qa-carpet", variantId: "large", quantity: 10 },
  ] }, catalog), InvalidCartError);
});
test("calculating an order preserves the input cart", () => {
  const input = structuredClone(base);
  calculateOrder(input, catalog);
  assert.deepEqual(input, base);
});
