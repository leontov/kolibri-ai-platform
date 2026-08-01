import test from "node:test";
import assert from "node:assert/strict";

import { calculateEstimate, groupRowsBySection, safeNumber } from "../src/features/estimate/calculation.js";

test("calculates work, material and service totals deterministically", () => {
  const result = calculateEstimate([
    { type: "Работа", qty: 10, price: 100 },
    { type: "Материал", qty: "2,5", price: 200 },
    { type: "Услуга", qty: 1, price: 300 },
  ]);

  assert.deepEqual(result, { work: 1000, materials: 500, services: 300, total: 1800 });
});

test("normalizes invalid numeric input without producing NaN", () => {
  assert.equal(safeNumber("1,25"), 1.25);
  assert.equal(safeNumber("invalid"), 0);
});

test("keeps estimate sections in their original order", () => {
  const groups = groupRowsBySection([
    { section: "Фундамент", id: 1 },
    { section: "Стены", id: 2 },
    { section: "Фундамент", id: 3 },
  ]);

  assert.deepEqual(groups.map(([name, rows]) => [name, rows.length]), [["Фундамент", 2], ["Стены", 1]]);
});
