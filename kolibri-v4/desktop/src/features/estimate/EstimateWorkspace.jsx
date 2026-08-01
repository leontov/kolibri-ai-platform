import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle,
  DownloadSimple,
  Folder,
  Plus,
  WarningCircle,
} from "@phosphor-icons/react";

import { usePersistedState } from "../../hooks/usePersistedState.js";
import { calculateEstimate, DEFAULT_ESTIMATE_ROWS, groupRowsBySection, safeNumber } from "./calculation.js";

const money = value => new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
}).format(value);

const tabs = [
  ["estimate", "Смета", null],
  ["sources", "Источники", "4/12"],
  ["assumptions", "Допущения", "4"],
  ["questions", "Вопросы", "4"],
];

const sourceRows = [
  ["Организация площадки", "Внутренняя цена подрядчика", "Без региона", "185 000 ₽/компл.", "01.08.2026", "Предварительно"],
  ["Монолитные работы", "Внутренняя цена подрядчика", "Без региона", "16 800 ₽/м³", "01.08.2026", "Предварительно"],
  ["Облицовочная кладка", "Внутренняя цена подрядчика", "Без региона", "2 450 ₽/м²", "01.08.2026", "Предварительно"],
  ["Материалы и доставка", "Не выбран", "—", "—", "—", "Нужен источник"],
];

export function EstimateWorkspace({ project, onShare }) {
  const [rows, setRows] = usePersistedState("kolibri-v4-house-134-estimate", DEFAULT_ESTIMATE_ROWS);
  const [saveState, setSaveState] = useState("Сохранено локально");
  const [activeTab, setActiveTab] = useState("estimate");
  const totals = useMemo(() => calculateEstimate(rows), [rows]);
  const groupedRows = useMemo(() => groupRowsBySection(rows), [rows]);

  useEffect(() => {
    if (saveState !== "Сохранение…") return undefined;
    const timer = window.setTimeout(() => setSaveState("Сохранено локально"), 450);
    return () => window.clearTimeout(timer);
  }, [rows, saveState]);

  const update = (id, field, value) => {
    setRows(items => items.map(row => row.id === id
      ? { ...row, [field]: field === "name" ? value : safeNumber(value) }
      : row));
    setSaveState("Сохранение…");
  };

  const addRow = () => {
    setRows(items => [...items, {
      id: `custom-${Date.now()}`,
      section: "Дополнительные работы",
      name: "Новая позиция",
      unit: "шт.",
      qty: 1,
      price: 0,
      type: "Работа",
      source: "Не указан",
    }]);
    setSaveState("Сохранение…");
  };

  const exportCsv = () => {
    const header = ["Раздел", "Позиция", "Тип", "Ед.", "Количество", "Цена", "Сумма"];
    const lines = rows.map(row => [row.section, row.name, row.type, row.unit, row.qty, row.price, row.qty * row.price]);
    const csv = [header, ...lines].map(line => line.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "dom-134-predvaritelnaya-smeta.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="estimate-page">
      <header className="estimate-header">
        <div>
          <button className="breadcrumb"><Folder size={15} /> {project}</button>
          <h1>Предварительная смета · дом 134 м²</h1>
          <p><span className="status-badge preliminary">Предварительная</span> Ревизия 1 · {saveState}</p>
        </div>
        <div>
          <button className="secondary-button">Ревизии</button>
          <button className="secondary-button" onClick={exportCsv}><DownloadSimple size={17} /> Экспорт CSV</button>
          <button className="primary-button" onClick={onShare}>Сохранить версию <ArrowRight size={17} /></button>
        </div>
      </header>

      <div className="estimate-tabs" role="tablist" aria-label="Состав сметы">
        {tabs.map(([id, label, count]) => (
          <button key={id} role="tab" aria-selected={activeTab === id} className={activeTab === id ? "active" : ""} onClick={() => setActiveTab(id)}>{label}{count ? <span>{count}</span> : null}</button>
        ))}
      </div>

      {activeTab === "estimate" ? (
        <>
          <div className="estimate-notice warning-notice">
            <WarningCircle size={19} />
            <span><strong>Бюджет рассчитан детерминированно, но ещё не проверен</strong><small>Не указаны регион, проектные габариты, ТУ и состав отделки. Итог нельзя выдавать заказчику как твёрдую цену.</small></span>
          </div>
          <div className="estimate-sheet">
            <div className="estimate-row estimate-columns"><span>Позиция</span><span>Тип</span><span>Ед.</span><span>Количество</span><span>Цена</span><span>Сумма</span></div>
            {groupedRows.map(([section, sectionRows]) => (
              <div className="estimate-section" key={section}>
                <div className="estimate-section-heading"><strong>{section}</strong><span>{money(calculateEstimate(sectionRows).total)}</span></div>
                {sectionRows.map(row => (
                  <div className="estimate-row" key={row.id}>
                    <label><span className="sr-only">Название позиции</span><input value={row.name} onChange={event => update(row.id, "name", event.target.value)} /></label>
                    <span className="row-type">{row.type}</span>
                    <span>{row.unit}</span>
                    <label><span className="sr-only">Количество</span><input type="number" min="0" step="any" value={row.qty} onChange={event => update(row.id, "qty", event.target.value)} /></label>
                    <label><span className="sr-only">Цена</span><input type="number" min="0" step="any" value={row.price} onChange={event => update(row.id, "price", event.target.value)} /></label>
                    <strong>{money(row.qty * row.price)}</strong>
                  </div>
                ))}
              </div>
            ))}
            <button className="add-row" onClick={addRow}><Plus size={17} /> Добавить позицию</button>
          </div>
        </>
      ) : activeTab === "sources" ? (
        <EstimateSources />
      ) : activeTab === "assumptions" ? (
        <EstimateList title="Допущения предварительного расчёта" items={[
          "Площадь 134 м² принята как общая площадь одноэтажного дома.",
          "Площадь кровли и фасада рассчитана укрупнённо без рабочего проекта.",
          "Инженерные системы учтены комплектно без стоимости внешнего подключения.",
          "Отделка эконом-класса не включает мебель, бытовую технику и благоустройство.",
        ]} />
      ) : (
        <EstimateList title="Вопросы, влияющие на цену" items={[
          "В каком регионе и населённом пункте находится участок?",
          "Есть ли архитектурный проект, геология и посадка дома?",
          "Какие точки подключения к электричеству, воде, канализации и газу доступны?",
          "Что именно входит в чистовую отделку эконом-класса?",
        ]} numbered />
      )}

      <aside className="estimate-summary">
        <h2>Итоги</h2>
        <div><span>Работы</span><strong>{money(totals.work)}</strong></div>
        <div><span>Материалы</span><strong>{money(totals.materials)}</strong></div>
        <div><span>Услуги и доставка</span><strong>{money(totals.services)}</strong></div>
        <div><span>Резерв</span><strong>не задан</strong></div>
        <div className="grand-total"><span>Всего</span><strong>{money(totals.total)}</strong></div>
        <small>Без НДС · регион не указан · ценовая дата 01.08.2026</small>
        <div className="coverage-meter"><span><i style={{ width: "33%" }} /></span><small>Покрытие источниками: 33%</small></div>
      </aside>
    </section>
  );
}

function EstimateSources() {
  return (
    <div className="estimate-tab-panel source-list compact-source-list">
      {sourceRows.map(row => (
        <article key={row[0]}>{row.map((cell, index) => <span key={`${row[0]}-${index}`}><small>{["Позиция", "Источник", "Регион", "Цена", "Дата", "Статус"][index]}</small><strong className={index === 5 && cell.includes("Нужен") ? "warning-text" : ""}>{cell}</strong></span>)}</article>
      ))}
    </div>
  );
}

function EstimateList({ title, items, numbered = false }) {
  const Tag = numbered ? "ol" : "ul";
  return (
    <section className="estimate-tab-panel estimate-list-panel">
      <h2>{title}</h2>
      <Tag>{items.map(item => <li key={item}><CheckCircle size={18} /><span>{item}</span></li>)}</Tag>
    </section>
  );
}
