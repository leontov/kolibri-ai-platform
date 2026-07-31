const STORAGE_VERSION = 2;
export const ESTIMATE_ROW_TYPES = ["Работа", "Материал", "Услуга"];

export function normalizeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

export function normalizeEstimateRow(value, fallbackId = `row_${Date.now()}`) {
  const row = value && typeof value === "object" ? value : {};
  return {
    id: typeof row.id === "string" && row.id ? row.id.slice(0, 160) : fallbackId,
    name: typeof row.name === "string" ? row.name.slice(0, 240) : "",
    type: ESTIMATE_ROW_TYPES.includes(row.type) ? row.type : "Работа",
    unit: typeof row.unit === "string" && row.unit.trim() ? row.unit.slice(0, 24) : "шт.",
    qty: normalizeNumber(row.qty),
    price: normalizeNumber(row.price),
    source: typeof row.source === "string" ? row.source.slice(0, 500) : "",
  };
}

export function createEmptyEstimate(project) {
  return {
    version: STORAGE_VERSION,
    projectId: project.id,
    title: `Смета — ${project.title}`,
    revision: 1,
    reservePercent: 0,
    updatedAt: new Date().toISOString(),
    approval: null,
    rows: [],
  };
}

function normalizeApproval(value) {
  if (!value || typeof value !== "object" || value.status !== "approved") return null;
  const approvedAt = typeof value.approvedAt === "string" ? value.approvedAt : "";
  const date = new Date(approvedAt);
  return Number.isNaN(date.getTime())
    ? null
    : { status: "approved", approvedAt: date.toISOString() };
}

export function normalizeEstimate(value, project) {
  if (!value || typeof value !== "object" || value.projectId !== project.id) {
    return createEmptyEstimate(project);
  }
  return {
    version: STORAGE_VERSION,
    projectId: project.id,
    title: typeof value.title === "string" && value.title.trim() ? value.title.slice(0, 240) : `Смета — ${project.title}`,
    revision: Math.max(1, Math.trunc(normalizeNumber(value.revision)) || 1),
    reservePercent: Math.min(100, normalizeNumber(value.reservePercent)),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
    approval: normalizeApproval(value.approval),
    rows: Array.isArray(value.rows)
      ? value.rows.slice(0, 2_000).map((row, index) => normalizeEstimateRow(row, `row_${index + 1}`))
      : [],
  };
}

export function calculateEstimateTotals(rows, reservePercent = 0) {
  const totals = { work: 0, materials: 0, services: 0, subtotal: 0, reserve: 0, total: 0 };
  for (const row of rows) {
    const amount = normalizeNumber(row.qty) * normalizeNumber(row.price);
    if (row.type === "Материал") totals.materials += amount;
    else if (row.type === "Услуга") totals.services += amount;
    else totals.work += amount;
  }
  totals.subtotal = totals.work + totals.materials + totals.services;
  totals.reserve = totals.subtotal * Math.min(100, normalizeNumber(reservePercent)) / 100;
  totals.total = totals.subtotal + totals.reserve;
  return totals;
}

export function estimateSourceCoverage(rows) {
  const priced = rows.filter((row) => normalizeNumber(row.price) > 0);
  const sourced = priced.filter((row) => typeof row.source === "string" && row.source.trim());
  return { priced: priced.length, sourced: sourced.length };
}

export function deriveEstimateStatus(estimate) {
  if (estimate.approval?.status === "approved") {
    return { id: "approved", label: "Утверждена локально", tone: "approved" };
  }
  if (!estimate.rows.length) {
    return { id: "needs_input", label: "Нужны исходные данные", tone: "warning" };
  }
  const invalidRows = estimate.rows.filter(
    (row) => !row.name.trim() || normalizeNumber(row.qty) <= 0 || normalizeNumber(row.price) <= 0,
  );
  if (invalidRows.length) {
    return { id: "needs_input", label: "Нужны исходные данные", tone: "warning" };
  }
  const coverage = estimateSourceCoverage(estimate.rows);
  if (coverage.priced > coverage.sourced) {
    return { id: "preliminary", label: "Предварительная", tone: "preliminary" };
  }
  return { id: "source_backed", label: "Цены подтверждены", tone: "source-backed" };
}

export function estimateStorageKey(projectId) {
  return `kolibri:v4:estimate:${projectId}`;
}

export function readEstimate(storage, project) {
  if (!storage) return createEmptyEstimate(project);
  try {
    const raw = storage.getItem(estimateStorageKey(project.id));
    return raw ? normalizeEstimate(JSON.parse(raw), project) : createEmptyEstimate(project);
  } catch {
    return createEmptyEstimate(project);
  }
}

export function writeEstimate(storage, estimate) {
  if (!storage) return;
  storage.setItem(estimateStorageKey(estimate.projectId), JSON.stringify({
    ...estimate,
    version: STORAGE_VERSION,
    updatedAt: new Date().toISOString(),
  }));
}

export function estimateSummaryText(project, estimate) {
  const totals = calculateEstimateTotals(estimate.rows, estimate.reservePercent);
  const rows = estimate.rows.map((row, index) =>
    `${index + 1}. ${row.name || "Без названия"}: ${row.qty} ${row.unit} × ${row.price} ₽ = ${Math.round(row.qty * row.price)} ₽`,
  );
  return [
    project.title,
    estimate.title,
    `Ревизия ${estimate.revision}`,
    ...rows,
    `Итого: ${Math.round(totals.total)} ₽`,
  ].join("\n");
}
