import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateEstimateTotals,
  createEmptyEstimate,
  deriveEstimateStatus,
  estimateSourceCoverage,
  readEstimate,
  writeEstimate,
} from "../src/features/estimate/estimate-store.js";

const project = { id: "project_12345678", title: "Дом 134 м²" };

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

test("a new estimate contains no invented rows or prices", () => {
  const estimate = createEmptyEstimate(project);
  assert.equal(estimate.rows.length, 0);
  assert.equal(calculateEstimateTotals(estimate.rows).total, 0);
  assert.equal(deriveEstimateStatus(estimate).id, "needs_input");
});

test("deterministic totals separate work, materials, services and reserve", () => {
  const rows = [
    { type: "Работа", qty: 10, price: 500 },
    { type: "Материал", qty: 2, price: 1_000 },
    { type: "Услуга", qty: 1, price: 750 },
  ];
  assert.deepEqual(calculateEstimateTotals(rows, 10), {
    work: 5_000,
    materials: 2_000,
    services: 750,
    subtotal: 7_750,
    reserve: 775,
    total: 8_525,
  });
});

test("status becomes source-backed only when all usable rows have a source", () => {
  const base = {
    ...createEmptyEstimate(project),
    rows: [{ id: "row_12345678", name: "Работа", type: "Работа", unit: "м²", qty: 10, price: 500, source: "" }],
  };
  assert.equal(deriveEstimateStatus(base).id, "preliminary");
  assert.deepEqual(estimateSourceCoverage(base.rows), { priced: 1, sourced: 0 });
  const sourced = { ...base, rows: [{ ...base.rows[0], source: "Прайс подрядчика, Татарстан, 01.08.2026, без НДС" }] };
  assert.equal(deriveEstimateStatus(sourced).id, "source_backed");
  assert.equal(deriveEstimateStatus({ ...sourced, approval: { status: "approved", approvedAt: new Date().toISOString() } }).id, "approved");
});

test("estimate persistence round-trips through local storage", () => {
  const storage = new MemoryStorage();
  const estimate = {
    ...createEmptyEstimate(project),
    rows: [{ id: "row_12345678", name: "Работа", type: "Работа", unit: "м²", qty: 10, price: 500, source: "Источник" }],
  };
  writeEstimate(storage, estimate);
  const restored = readEstimate(storage, project);
  assert.equal(restored.rows[0].name, "Работа");
  assert.equal(restored.rows[0].price, 500);
});
