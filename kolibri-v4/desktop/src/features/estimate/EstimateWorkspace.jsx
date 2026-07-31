import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle,
  Database,
  DownloadSimple,
  FilePdf,
  FloppyDisk,
  PaperPlaneTilt,
  Plus,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import { createOpaqueId } from "../../lib/ids.js";
import {
  calculateEstimateTotals,
  deriveEstimateStatus,
  ESTIMATE_ROW_TYPES,
  estimateSourceCoverage,
  estimateSummaryText,
  normalizeEstimateRow,
  readEstimate,
  writeEstimate,
} from "./estimate-store.js";

const money = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

function browserStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function download(name, content, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function printableHtml(project, estimate, totals) {
  const rows = estimate.rows.map((row, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.type)}</td><td>${escapeHtml(row.unit)}</td><td>${row.qty}</td><td>${money.format(row.price)}</td><td>${money.format(row.qty * row.price)}</td></tr>`).join("");
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${escapeHtml(estimate.title)}</title><style>body{font-family:Arial,sans-serif;margin:32px;color:#161616}h1{font-size:24px}p{color:#555}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{border:1px solid #bbb;padding:8px;text-align:left}th{background:#f3f3f3}.total{margin-top:20px;text-align:right;font-size:20px;font-weight:700}</style></head><body><h1>${escapeHtml(estimate.title)}</h1><p>${escapeHtml(project.title)} · ${escapeHtml(project.region)} · ревизия ${estimate.revision}</p><table><thead><tr><th>№</th><th>Позиция</th><th>Тип</th><th>Ед.</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr></thead><tbody>${rows}</tbody></table><div class="total">Итого: ${money.format(totals.total)}</div><script>window.addEventListener('load',()=>window.print())<\/script></body></html>`;
}

export function EstimateWorkspace({ project, onProjectStatusChange, onNavigate }) {
  const [estimate, setEstimate] = useState(() => readEstimate(browserStorage(), project));
  const [saveState, setSaveState] = useState("Сохранено локально");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setEstimate(readEstimate(browserStorage(), project));
    setSaveState("Сохранено локально");
    setMessage("");
  }, [project.id]);

  useEffect(() => {
    setSaveState("Сохранение…");
    const timer = globalThis.setTimeout(() => {
      writeEstimate(browserStorage(), estimate);
      setSaveState("Сохранено локально");
    }, 240);
    return () => globalThis.clearTimeout(timer);
  }, [estimate]);

  const totals = useMemo(() => calculateEstimateTotals(estimate.rows, estimate.reservePercent), [estimate.rows, estimate.reservePercent]);
  const coverage = useMemo(() => estimateSourceCoverage(estimate.rows), [estimate.rows]);
  const status = useMemo(() => deriveEstimateStatus(estimate), [estimate]);

  useEffect(() => {
    onProjectStatusChange(status.label);
  }, [onProjectStatusChange, status.label]);

  const edit = (mutator) => {
    setEstimate((current) => ({
      ...mutator(current),
      approval: null,
      updatedAt: new Date().toISOString(),
    }));
    setMessage("");
  };

  const addRow = () => {
    edit((current) => ({
      ...current,
      rows: [...current.rows, normalizeEstimateRow({ id: createOpaqueId("row_"), name: "", type: "Работа", unit: "шт.", qty: 0, price: 0, source: "" })],
    }));
  };

  const updateRow = (rowId, field, value) => {
    edit((current) => ({
      ...current,
      rows: current.rows.map((row) => row.id === rowId
        ? normalizeEstimateRow({ ...row, [field]: field === "qty" || field === "price" ? Number(value) : value }, row.id)
        : row),
    }));
  };

  const deleteRow = (rowId) => {
    edit((current) => ({ ...current, rows: current.rows.filter((row) => row.id !== rowId) }));
  };

  const saveRevision = () => {
    const next = { ...estimate, revision: estimate.revision + 1, approval: null, updatedAt: new Date().toISOString() };
    setEstimate(next);
    writeEstimate(browserStorage(), next);
    setSaveState("Новая ревизия сохранена");
    setMessage(`Создана ревизия ${next.revision}.`);
  };

  const approve = () => {
    if (status.id !== "source_backed") return;
    const next = { ...estimate, approval: { status: "approved", approvedAt: new Date().toISOString() } };
    setEstimate(next);
    writeEstimate(browserStorage(), next);
    setMessage("Смета утверждена в локальном рабочем пространстве. Серверный реестр утверждений остаётся отдельным следующим контуром.");
  };

  const share = async () => {
    const text = estimateSummaryText(project, estimate);
    try {
      if (navigator.share) {
        await navigator.share({ title: estimate.title, text });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setMessage("Сводка сметы скопирована в буфер обмена.");
      } else {
        download(`${project.title}-смета.txt`, text);
      }
    } catch (error) {
      if (error?.name !== "AbortError") setMessage("Не удалось передать смету через системное меню.");
    }
  };

  const exportCsv = () => {
    const header = ["№", "Позиция", "Тип", "Ед.", "Количество", "Цена", "Сумма", "Источник"];
    const values = estimate.rows.map((row, index) => [index + 1, row.name, row.type, row.unit, row.qty, row.price, row.qty * row.price, row.source]);
    const csv = [header, ...values].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(";")).join("\n");
    download(`${project.title}-ревизия-${estimate.revision}.csv`, `\uFEFF${csv}`, "text/csv;charset=utf-8");
  };

  const print = () => {
    const popup = window.open("", "_blank");
    if (!popup) {
      setMessage("Браузер заблокировал окно печати.");
      return;
    }
    popup.opener = null;
    popup.document.write(printableHtml(project, estimate, totals));
    popup.document.close();
  };

  return <section className="estimate-workspace product-page">
    <header className="page-heading estimate-heading">
      <div><button type="button" className="breadcrumb" onClick={() => onNavigate("projects")}>{project.title}</button><h1>{estimate.title}</h1><p><span className={`status-badge ${status.tone}`}>{status.label}</span> Ревизия {estimate.revision} · {saveState}</p></div>
      <div className="page-actions"><button type="button" className="secondary-button" onClick={saveRevision}><FloppyDisk size={17} /> Сохранить версию</button><button type="button" className="secondary-button" disabled={!estimate.rows.length} onClick={exportCsv}><DownloadSimple size={17} /> CSV для Excel</button><button type="button" className="secondary-button" disabled={!estimate.rows.length} onClick={print}><FilePdf size={17} /> Печать / PDF</button></div>
    </header>

    <div className="estimate-toolbar">
      <button type="button" className="active">Смета</button>
      <button type="button" onClick={() => onNavigate("sources")}><Database size={16} /> Источники {coverage.sourced}/{coverage.priced}</button>
      <label>Резерв, %<input type="number" min="0" max="100" step="0.1" value={estimate.reservePercent} onChange={(event) => edit((current) => ({ ...current, reservePercent: Number(event.target.value) }))} /></label>
    </div>

    <div className={`estimate-notice ${status.tone}`}>
      {status.id === "source_backed" || status.id === "approved" ? <CheckCircle size={20} /> : <WarningCircle size={20} />}
      <div><strong>{status.label}</strong><span>{status.id === "needs_input" ? "Добавьте позиции, объёмы и цены. Нулевые значения не считаются рассчитанной сметой." : status.id === "preliminary" ? "Расчёт выполняется детерминированно, но не у всех цен указан источник." : status.id === "source_backed" ? "Все ненулевые цены имеют источник. Смету можно локально утвердить." : "После изменения любой позиции локальное утверждение будет снято."}</span></div>
    </div>

    <div className="estimate-layout">
      <div className="estimate-table-wrap">
        <div className="estimate-table-head estimate-grid"><span>Позиция</span><span>Тип</span><span>Ед.</span><span>Количество</span><span>Цена</span><span>Сумма</span><span aria-hidden="true" /></div>
        {estimate.rows.length ? estimate.rows.map((row) => <div className="estimate-grid estimate-line" key={row.id}>
          <input aria-label="Название позиции" value={row.name} placeholder="Название работы или материала" onChange={(event) => updateRow(row.id, "name", event.target.value)} />
          <select aria-label="Тип позиции" value={row.type} onChange={(event) => updateRow(row.id, "type", event.target.value)}>{ESTIMATE_ROW_TYPES.map((type) => <option key={type}>{type}</option>)}</select>
          <input aria-label="Единица измерения" value={row.unit} onChange={(event) => updateRow(row.id, "unit", event.target.value)} />
          <input aria-label="Количество" type="number" min="0" step="0.001" value={row.qty} onChange={(event) => updateRow(row.id, "qty", event.target.value)} />
          <input aria-label="Цена" type="number" min="0" step="0.01" value={row.price} onChange={(event) => updateRow(row.id, "price", event.target.value)} />
          <strong>{money.format(row.qty * row.price)}</strong>
          <button aria-label="Удалить позицию" type="button" className="icon-button danger" onClick={() => deleteRow(row.id)}><Trash size={17} /></button>
          <label className="source-field">Источник цены<input value={row.source} placeholder="Поставщик, URL, дата, регион, НДС" onChange={(event) => updateRow(row.id, "source", event.target.value)} /></label>
        </div>) : <div className="empty-estimate"><CalculatorIllustration /><h2>Позиции ещё не добавлены</h2><p>Сначала запросите технологическую карту у агента или добавьте строку вручную. Приложение не подставляет демонстрационные объёмы и цены.</p></div>}
        <button type="button" className="add-row-button" onClick={addRow}><Plus size={17} /> Добавить позицию</button>
      </div>

      <aside className="estimate-summary functional-card">
        <h2>Итоги</h2>
        <div><span>Работы</span><strong>{money.format(totals.work)}</strong></div>
        <div><span>Материалы</span><strong>{money.format(totals.materials)}</strong></div>
        <div><span>Услуги</span><strong>{money.format(totals.services)}</strong></div>
        <div><span>Резерв</span><strong>{money.format(totals.reserve)}</strong></div>
        <div className="grand-total"><span>Всего</span><strong>{money.format(totals.total)}</strong></div>
        <small>Итоги рассчитываются только из введённых строк. НДС и региональные коэффициенты не применяются без явных исходных данных.</small>
      </aside>
    </div>

    <footer className="estimate-footer-actions">
      <button type="button" className="secondary-button" disabled={status.id !== "source_backed"} onClick={approve}><CheckCircle size={17} /> Утвердить локально</button>
      <button type="button" className="primary-button" disabled={!estimate.rows.length} onClick={() => void share()}><PaperPlaneTilt size={17} /> Передать клиенту</button>
    </footer>
    {message ? <p className="floating-message" role="status">{message}</p> : null}
  </section>;
}

function CalculatorIllustration() {
  return <span className="empty-estimate-icon" aria-hidden="true"><Plus size={28} /></span>;
}
