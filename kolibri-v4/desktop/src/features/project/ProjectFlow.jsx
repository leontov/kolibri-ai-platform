import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Calculator,
  CheckCircle,
  Clock,
  Database,
  FileText,
  Hammer,
  House,
  ListChecks,
  MapPin,
  Ruler,
  ShieldCheck,
  Sparkle,
  UsersThree,
  WarningCircle,
} from "@phosphor-icons/react";

const officeAgents = [
  { name: "Архитектор", task: "Разбирает конструктив и состав помещений", icon: House },
  { name: "Инженер ПТО", task: "Формирует технологическую последовательность", icon: ListChecks },
  { name: "Сметчик", task: "Определяет объёмы, ресурсы и структуру затрат", icon: Calculator },
  { name: "Исследователь цен", task: "Готовит запрос цен по региону и источникам", icon: Database },
  { name: "Контролёр", task: "Проверяет полноту и фиксирует вопросы", icon: ShieldCheck },
];

const lifecycle = [
  ["Исходные данные", "Запрос разобран", Sparkle],
  ["Технологическая карта", "Готова к проверке", ListChecks],
  ["Смета", "Предварительный расчёт", Calculator],
  ["Согласование", "Передача заказчику", UsersThree],
  ["Договор и план", "После утверждения", FileText],
  ["Выполнение и КС", "По факту работ", Hammer],
];

const technologySections = [
  {
    title: "01. Подготовка и исходные данные",
    items: [
      ["Инженерные изыскания и привязка дома", "компл.", "Требуется участок"],
      ["Организация площадки и временные сети", "компл.", "Предусмотрено"],
      ["Разбивка осей здания", "компл.", "Предусмотрено"],
    ],
  },
  {
    title: "02. Монолитная фундаментная плита",
    items: [
      ["Разработка котлована и подготовка основания", "187 м³", "Расчётно"],
      ["Песчано-щебёночная подготовка с уплотнением", "67 м³", "Расчётно"],
      ["Армирование, опалубка и бетонирование B25", "47 м³", "Расчётно"],
      ["Гидроизоляция и утепление контура", "196 м²", "Расчётно"],
    ],
  },
  {
    title: "03. Коробка, фасад и кровля",
    items: [
      ["Кладка несущих стен из рядового кирпича", "78 м³", "Расчётно"],
      ["Облицовочная кладка жёлтым кирпичом", "168 м²", "Расчётно"],
      ["Устройство утеплённой мягкой кровли", "176 м²", "Расчётно"],
    ],
  },
  {
    title: "04. Отделка и инженерные системы",
    items: [
      ["Электроснабжение и слаботочные сети", "134 м²", "Нужны ТУ"],
      ["Отопление, водоснабжение и канализация", "134 м²", "Нужны ТУ"],
      ["Отделка под ключ, эконом-класс", "134 м²", "Уточнить состав"],
    ],
  },
];

export function DigitalOfficeRun({ onOpenProject }) {
  const [completed, setCompleted] = useState(0);
  const resultRef = useRef(null);

  useEffect(() => {
    if (completed >= officeAgents.length) return undefined;
    const timer = window.setTimeout(() => setCompleted(value => value + 1), 420);
    return () => window.clearTimeout(timer);
  }, [completed]);

  const isReady = completed === officeAgents.length;

  useEffect(() => {
    if (!isReady) return undefined;
    const frame = window.requestAnimationFrame(() => {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isReady]);

  return (
    <section className="office-run" aria-live="polite">
      <div className="office-run-heading">
        <span className="office-logo"><UsersThree size={20} /></span>
        <span><strong>Цифровая контора начала работу</strong><small>{isReady ? "Первичный разбор завершён" : `Параллельный разбор · ${completed} из ${officeAgents.length}`}</small></span>
        <span className={`office-status ${isReady ? "ready" : ""}`}>{isReady ? "Готово" : "В работе"}</span>
      </div>
      <div className="office-progress"><span style={{ width: `${(completed / officeAgents.length) * 100}%` }} /></div>
      <div className="agent-list">
        {officeAgents.map(({ name, task, icon: Icon }, index) => {
          const done = index < completed;
          const active = index === completed;
          return (
            <div className={`agent-row ${done ? "done" : ""} ${active ? "active" : ""}`} key={name}>
              <span className="agent-icon"><Icon size={18} /></span>
              <span><strong>{name}</strong><small>{task}</small></span>
              {done ? <CheckCircle size={19} weight="fill" /> : active ? <span className="agent-pulse" /> : <Clock size={18} />}
            </div>
          );
        })}
      </div>
      {isReady ? (
        <div className="office-result" ref={resultRef}>
          <div><CheckCircle size={20} weight="fill" /><span><strong>Создан объект «Дом 134 м² под ключ»</strong><small>Состав работ определён. Расчёт останется предварительным до уточнения региона, участка и технических условий.</small></span></div>
          <button className="primary-button" onClick={onOpenProject}>Открыть объект <ArrowRight size={17} /></button>
        </div>
      ) : null}
    </section>
  );
}

export function ProjectWorkspace({ stage, onOpenTechnology }) {
  return (
    <section className="product-page project-workspace">
      <div className="project-title-row">
        <div>
          <div className="eyebrow">Новый объект · жилая недвижимость</div>
          <h1>Дом 134 м² под ключ</h1>
          <p>Одноэтажный кирпичный дом · монолитная плита · мягкая кровля · эконом-класс</p>
        </div>
        <button className="primary-button" onClick={onOpenTechnology}>Открыть техкарту <ArrowRight size={17} /></button>
      </div>

      <div className="project-facts">
        <article><Ruler size={21} /><span><small>Площадь</small><strong>134 м²</strong></span></article>
        <article><House size={21} /><span><small>Этажность</small><strong>1 этаж</strong></span></article>
        <article><MapPin size={21} /><span><small>Регион строительства</small><strong className="warning-text">Нужно уточнить</strong></span></article>
        <article><WarningCircle size={21} /><span><small>Статус расчёта</small><strong>Предварительный</strong></span></article>
      </div>

      <section className="lifecycle-card">
        <header><span><strong>Жизненный цикл объекта</strong><small>Каждый документ выпускается только из утверждённого предыдущего этапа</small></span><span>{Math.min(stage + 1, lifecycle.length)} / {lifecycle.length}</span></header>
        <div className="lifecycle-list">
          {lifecycle.map(([title, detail, Icon], index) => {
            const done = index < stage;
            const active = index === stage;
            return (
              <div className={`lifecycle-row ${done ? "done" : ""} ${active ? "active" : ""}`} key={title}>
                <span className="lifecycle-icon">{done ? <CheckCircle size={20} weight="fill" /> : <Icon size={20} />}</span>
                <span><strong>{title}</strong><small>{detail}</small></span>
                <span>{done ? "Завершено" : active ? "Текущий этап" : "Ожидает"}</span>
              </div>
            );
          })}
        </div>
      </section>

      <aside className="questions-card">
        <header><WarningCircle size={19} /><strong>Нужно уточнить до проверки сметы</strong></header>
        <ol>
          <li>Регион и населённый пункт строительства.</li>
          <li>Габариты дома, высоту помещений и наличие проекта.</li>
          <li>Геологию участка и точки подключения инженерных сетей.</li>
          <li>Состав чистовой отделки и оборудование инженерных систем.</li>
        </ol>
      </aside>
    </section>
  );
}

export function TechnologyWorkspace({ onCreateEstimate }) {
  const totalItems = technologySections.reduce((sum, section) => sum + section.items.length, 0);

  return (
    <section className="product-page technology-page">
      <div className="page-heading technology-heading">
        <div>
          <div className="eyebrow">Дом 134 м² под ключ · ревизия 1</div>
          <h1>Технологическая карта</h1>
          <p>Последовательность работ определяет состав и структуру сметы</p>
        </div>
        <button className="primary-button" onClick={onCreateEstimate}>Создать смету <ArrowRight size={17} /></button>
      </div>

      <div className="technology-notice">
        <ListChecks size={20} />
        <span><strong>{totalItems} технологических операций сформировано</strong><small>Объёмы получены из укрупнённой модели. Нормы и цены будут проверяться отдельно; отсутствующие данные отмечены явно.</small></span>
      </div>

      <div className="technology-layout">
        <div className="technology-sections">
          {technologySections.map(section => (
            <section className="technology-section" key={section.title}>
              <h2>{section.title}</h2>
              {section.items.map(([name, quantity, status]) => (
                <div className="technology-row" key={name}>
                  <CheckCircle size={18} />
                  <span><strong>{name}</strong><small>{status}</small></span>
                  <strong>{quantity}</strong>
                </div>
              ))}
            </section>
          ))}
        </div>
        <aside className="technology-aside">
          <h2>Основание расчёта</h2>
          <div><small>Тип результата</small><strong>Предварительный бюджет</strong></div>
          <div><small>Нормативная база</small><strong>Требует выбора региона и метода</strong></div>
          <div><small>Ценовая дата</small><strong>01.08.2026</strong></div>
          <div><small>Точность объёмов</small><strong>Укрупнённая модель</strong></div>
          <p><WarningCircle size={17} /> Техкарта не заменяет рабочий проект и не подтверждает соответствие конкретным ТУ.</p>
        </aside>
      </div>
    </section>
  );
}
