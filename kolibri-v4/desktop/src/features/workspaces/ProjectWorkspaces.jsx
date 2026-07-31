import { useMemo, useState } from "react";
import {
  Calculator,
  CalendarBlank,
  Database,
  FileText,
  Folder,
  MagnifyingGlass,
  Plus,
  Wrench,
} from "@phosphor-icons/react";
import {
  calculateEstimateTotals,
  deriveEstimateStatus,
  estimateSourceCoverage,
  readEstimate,
  writeEstimate,
} from "../estimate/estimate-store.js";

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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function download(name, content, type = "text/html;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function ProjectsWorkspace({ projects, currentProjectId, onSelect, onCreate, onOpenEstimate }) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [region, setRegion] = useState("");
  const [brief, setBrief] = useState("");
  const [message, setMessage] = useState("");

  const rows = useMemo(() => projects
    .filter((project) => !query.trim() || `${project.title} ${project.region}`.toLowerCase().includes(query.trim().toLowerCase()))
    .map((project) => {
      const estimate = readEstimate(browserStorage(), project);
      return {
        project,
        status: deriveEstimateStatus(estimate),
        total: calculateEstimateTotals(estimate.rows, estimate.reservePercent).total,
      };
    }), [projects, query]);

  const create = (event) => {
    event.preventDefault();
    try {
      const project = onCreate({ title, region, brief });
      setTitle("");
      setRegion("");
      setBrief("");
      setCreating(false);
      setMessage(`Создан проект «${project.title}».`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Проект не создан.");
    }
  };

  return <section className="product-page projects-workspace">
    <header className="page-heading"><div><h1>Проекты</h1><p>Реальные локальные рабочие пространства без демонстрационных итогов.</p></div><button type="button" className="primary-button" onClick={() => setCreating((value) => !value)}><Plus size={17} /> Новый проект</button></header>
    {creating ? <form className="project-create-form functional-card" onSubmit={create}>
      <label>Название<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={180} placeholder="Например, дом 134 м²" required /></label>
      <label>Регион<input value={region} onChange={(event) => setRegion(event.target.value)} maxLength={120} placeholder="Необязательно" /></label>
      <label className="wide">Исходное описание<textarea value={brief} onChange={(event) => setBrief(event.target.value)} maxLength={4_000} placeholder="Конструкции, отделка, инженерные сети, класс работ" /></label>
      <div className="wide form-actions"><button type="button" className="secondary-button" onClick={() => setCreating(false)}>Отмена</button><button type="submit" className="primary-button">Создать проект</button></div>
    </form> : null}
    <label className="page-search"><MagnifyingGlass size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти проект" /></label>
    <div className="project-list">
      {rows.map(({ project, status, total }) => <article key={project.id} className={`project-card functional-card ${project.id === currentProjectId ? "active" : ""}`}>
        <span className="project-icon"><Folder size={22} /></span>
        <div className="project-card-copy"><strong>{project.title}</strong><span>{project.region}</span><small>{project.brief || "Описание ещё не заполнено"}</small></div>
        <div className="project-metrics"><span className={`status-badge ${status.tone}`}>{status.label}</span><strong>{total > 0 ? money.format(total) : "Итог не рассчитан"}</strong></div>
        <div className="project-card-actions"><button type="button" className="secondary-button" onClick={() => onSelect(project.id)}>Открыть чат</button><button type="button" className="primary-button" onClick={() => onOpenEstimate(project.id)}><Calculator size={17} /> Смета</button></div>
      </article>)}
      {!rows.length ? <div className="empty-workspace"><Folder size={42} /><h2>Проекты не найдены</h2><p>Измените поиск или создайте новый проект.</p></div> : null}
    </div>
    {message ? <p className="inline-message" role="status">{message}</p> : null}
  </section>;
}

export function SourcesWorkspace({ project, onAskAgent, onNavigate, onProjectStatusChange }) {
  const [estimate, setEstimate] = useState(() => readEstimate(browserStorage(), project));
  const [message, setMessage] = useState("");
  const coverage = estimateSourceCoverage(estimate.rows);

  const updateSource = (rowId, source) => {
    const next = {
      ...estimate,
      approval: null,
      rows: estimate.rows.map((row) => row.id === rowId ? { ...row, source: source.slice(0, 500) } : row),
      updatedAt: new Date().toISOString(),
    };
    setEstimate(next);
    writeEstimate(browserStorage(), next);
    onProjectStatusChange(deriveEstimateStatus(next).label);
    setMessage("Источник сохранён локально.");
  };

  return <section className="product-page sources-workspace">
    <header className="page-heading"><div><button type="button" className="breadcrumb" onClick={() => onNavigate("estimate")}>{project.title}</button><h1>Источники цен</h1><p>Источник должен содержать поставщика или документ, дату, регион, единицу и сведения о НДС.</p></div><button type="button" className="primary-button" onClick={onAskAgent}><MagnifyingGlass size={17} /> Подготовить поиск агенту</button></header>
    <div className="coverage-card functional-card"><Database size={23} /><div><strong>{coverage.sourced} из {coverage.priced} цен имеют источник</strong><span>{coverage.priced ? "Пустой источник не считается подтверждением." : "Сначала добавьте ненулевые цены в смету."}</span></div></div>
    {estimate.rows.length ? <div className="source-editor-list">
      {estimate.rows.map((row) => <article key={row.id} className="source-editor-row functional-card">
        <div><strong>{row.name || "Позиция без названия"}</strong><span>{row.qty} {row.unit} · {row.price > 0 ? money.format(row.price) : "цена не указана"}</span></div>
        <label>Источник<input value={row.source} onChange={(event) => updateSource(row.id, event.target.value)} placeholder="Поставщик / URL / документ · дата · регион · НДС" /></label>
      </article>)}
    </div> : <div className="empty-workspace"><Database size={42} /><h2>Нет позиций для проверки</h2><p>Источники появляются только для фактических строк сметы.</p><button type="button" className="primary-button" onClick={() => onNavigate("estimate")}>Открыть смету</button></div>}
    {message ? <p className="inline-message" role="status">{message}</p> : null}
  </section>;
}

export function DocumentsWorkspace({ project, onNavigate }) {
  const estimate = readEstimate(browserStorage(), project);
  const totals = calculateEstimateTotals(estimate.rows, estimate.reservePercent);
  const status = deriveEstimateStatus(estimate);

  const createProposal = () => {
    const rows = estimate.rows.map((row, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(row.name)}</td><td>${row.qty} ${escapeHtml(row.unit)}</td><td>${money.format(row.qty * row.price)}</td></tr>`).join("");
    const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Коммерческое предложение — ${escapeHtml(project.title)}</title><style>body{font-family:Arial,sans-serif;margin:40px;color:#151515}h1{font-size:26px}table{width:100%;border-collapse:collapse;margin:24px 0}td,th{border:1px solid #bbb;padding:9px}th{background:#f3f3f3}.total{text-align:right;font-size:20px;font-weight:700}</style></head><body><h1>Коммерческое предложение</h1><p><strong>Проект:</strong> ${escapeHtml(project.title)}</p><p><strong>Регион:</strong> ${escapeHtml(project.region)}</p><p><strong>Основание:</strong> локальная ревизия сметы №${estimate.revision}</p><table><thead><tr><th>№</th><th>Позиция</th><th>Количество</th><th>Сумма</th></tr></thead><tbody>${rows}</tbody></table><p class="total">Итого: ${money.format(totals.total)}</p><p>Статус расчёта: ${escapeHtml(status.label)}. Неподтверждённые исходные данные должны быть согласованы до подписания.</p></body></html>`;
    download(`${project.title}-коммерческое-предложение.html`, html);
  };

  const documents = [
    { title: "Смета", detail: `Ревизия ${estimate.revision} · ${status.label}`, enabled: estimate.rows.length > 0, action: () => onNavigate("estimate"), label: "Открыть" },
    { title: "Коммерческое предложение", detail: estimate.rows.length ? "Формируется из текущей локальной ревизии" : "Сначала заполните смету", enabled: estimate.rows.length > 0, action: createProposal, label: "Создать HTML" },
    { title: "Акт КС-2", detail: "Нужны утверждённая серверная ревизия, период и фактические объёмы", enabled: false, label: "Недоступно" },
    { title: "Справка КС-3", detail: "Создаётся только из принятого КС-2", enabled: false, label: "Недоступно" },
    { title: "Договор", detail: "Нужны реквизиты сторон и согласованные условия", enabled: false, label: "Недоступно" },
  ];

  return <section className="product-page documents-workspace">
    <header className="page-heading"><div><button type="button" className="breadcrumb" onClick={() => onNavigate("projects")}>{project.title}</button><h1>Документы</h1><p>Документы формируются из сохранённой ревизии; недостающие юридические данные не подменяются шаблонными.</p></div></header>
    <div className="document-list">{documents.map((document) => <article key={document.title} className="document-row functional-card"><span className="document-icon"><FileText size={22} /></span><div><strong>{document.title}</strong><small>{document.detail}</small></div><button type="button" className={document.enabled ? "secondary-button" : "secondary-button disabled"} disabled={!document.enabled} onClick={document.action}>{document.label}</button></article>)}</div>
  </section>;
}

export function EmptyProductWorkspace({ type }) {
  const scheduled = type === "scheduled";
  const Icon = scheduled ? CalendarBlank : Wrench;
  return <section className="product-page empty-product-page"><div className="empty-workspace"><Icon size={48} /><h1>{scheduled ? "Запланированные задачи" : "Плагины"}</h1><p>{scheduled ? "Фиктивные расписания удалены. Раздел будет показывать только задачи, созданные реальным серверным планировщиком." : "Фиктивный каталог удалён. Здесь появятся только реально установленные интеграции и навыки."}</p></div></section>;
}
