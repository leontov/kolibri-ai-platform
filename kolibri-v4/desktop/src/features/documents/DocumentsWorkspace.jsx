import { useState } from "react";
import {
  CalendarCheck,
  CheckCircle,
  FileText,
  Folder,
  Handshake,
  LockSimple,
  Plus,
} from "@phosphor-icons/react";

const documentSteps = [
  { id: "estimate", name: "Смета", detail: "Ревизия 1 · предварительная", gate: 0, action: "Открыть", icon: FileText },
  { id: "proposal", name: "Коммерческое предложение", detail: "Создаётся из сохранённой сметы", gate: 3, action: "Сформировать", icon: Handshake },
  { id: "contract", name: "Договор подряда", detail: "После согласования предложения", gate: 4, action: "Создать договор", icon: FileText },
  { id: "schedule", name: "Календарный план", detail: "Этапы, сроки и плановые платежи", gate: 5, action: "Открыть план", icon: CalendarCheck },
  { id: "ks2", name: "Акт КС-2", detail: "Фактические объёмы за выбранный период", gate: 5, action: "Выбрать период", icon: FileText },
  { id: "ks3", name: "Справка КС-3", detail: "Формируется на основании принятого КС-2", gate: 6, action: "После КС-2", icon: FileText },
];

export function DocumentsWorkspace({ project, stage, setStage }) {
  const [notice, setNotice] = useState("Документы выпускаются последовательно и сохраняют связь с ревизией сметы.");

  const runAction = document => {
    if (stage < document.gate) return;
    if (document.id === "proposal") {
      setStage(value => Math.max(value, 4));
      setNotice("Черновик коммерческого предложения создан из ревизии 1. Перед отправкой нужны реквизиты подрядчика и заказчика.");
    } else if (document.id === "contract") {
      setStage(value => Math.max(value, 5));
      setNotice("Черновик договора и календарного плана создан. Даты и условия оплаты требуют согласования сторон.");
    } else if (document.id === "ks2") {
      setStage(value => Math.max(value, 6));
      setNotice("Создан период выполнения №1. Заполните фактические объёмы — после их принятия станет доступна КС-3.");
    } else {
      setNotice(`${document.name}: действие открыто в текущей ревизии проекта.`);
    }
  };

  return (
    <section className="product-page documents-page">
      <div className="page-heading">
        <div>
          <button className="breadcrumb"><Folder size={15} /> {project}</button>
          <h1>Согласование и документы</h1>
          <p>Смета → предложение → договор и план → выполнение → КС-2/КС-3</p>
        </div>
        <button className="primary-button" onClick={() => setNotice("Выберите доступный тип документа в цепочке ниже.")}><Plus size={17} /> Создать документ</button>
      </div>

      <div className="document-notice" role="status"><CheckCircle size={19} /><span>{notice}</span></div>

      <div className="document-timeline">
        {documentSteps.map((document, index) => {
          const locked = stage < document.gate;
          const complete = document.id === "estimate" || stage > document.gate;
          const Icon = document.icon;
          return (
            <article className={`${locked ? "locked" : ""} ${complete ? "complete" : ""}`} key={document.id}>
              <span className="document-step">{complete ? <CheckCircle size={20} weight="fill" /> : index + 1}</span>
              <span className="document-icon"><Icon size={22} /></span>
              <span className="document-copy"><strong>{document.name}</strong><small>{document.detail}</small></span>
              <span className={`document-state ${locked ? "locked" : complete ? "complete" : "available"}`}>{locked ? "Заблокировано" : complete ? "Готово" : "Доступно"}</span>
              <button className="secondary-button" disabled={locked} onClick={() => runAction(document)}>{locked ? <LockSimple size={16} /> : null}{document.action}</button>
            </article>
          );
        })}
      </div>

      <div className="document-release-rule">
        <LockSimple size={19} />
        <span><strong>Контроль выпуска</strong><small>Предварительная смета может использоваться для оценки бюджета. Перед юридически значимой передачей нужны региональные цены, реквизиты сторон и утверждённая ревизия.</small></span>
      </div>
    </section>
  );
}
