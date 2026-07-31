import { useState } from "react";
import {
  ArrowCounterClockwise,
  ArrowLeft,
  ArrowRight,
  Bell,
  Bird,
  Bug,
  Calculator,
  CaretDown,
  ChatCircle,
  CheckCircle,
  Clock,
  Code,
  Database,
  DownloadSimple,
  FileText,
  Folder,
  Gear,
  GridFour,
  Hammer,
  MagnifyingGlass,
  Microphone,
  PaperPlaneTilt,
  PencilSimple,
  Plus,
  ShieldCheck,
  SidebarSimple,
  SlidersHorizontal,
  Sparkle,
  TerminalWindow,
  Table,
  X,
  Wrench,
} from "@phosphor-icons/react";

const actions = [
  { icon: Calculator, color: "blue", text: "Составить смету по описанию или файлам", target: "estimate" },
  { icon: Table, color: "violet", text: "Проверить объёмы, цены и расчёты", target: "estimate" },
  { icon: FileText, color: "green", text: "Подготовить КС-2, КС-3 или предложение", target: "documents" },
  { icon: MagnifyingGlass, color: "orange", text: "Найти и подтвердить источники цен", target: "sources" },
];

const pinned = ["Дом 140 м² — кровля и фасад", "Ремонт офиса 320 м²", "Акты КС-2 и КС-3 за июль"];
const projects = ["Фабрика Колибри", "Бизнес-центр Север", "Частные дома 2026"];

function NavItem({ icon: Icon, children, active, onClick }) {
  return <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}><Icon size={19} /> <span>{children}</span></button>;
}

export function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentProject, setCurrentProject] = useState("Дом 140 м² — кровля и фасад");
  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [rightPanel, setRightPanel] = useState(false);
  const [settings, setSettings] = useState(false);
  const [projectMenu, setProjectMenu] = useState(false);
  const [screen, setScreen] = useState("home");

  const submit = () => {
    const next = value.trim();
    if (!next) return;
    setSubmitted(next);
    setValue("");
  };

  return (
    <div className={`app-shell ${sidebarOpen ? "sidebar-open" : ""} ${settings ? "settings-open" : ""}`}>
      <header className="topbar">
        <div className="topbar-left">
          <button aria-label="Открыть боковую панель" className="icon-button" onClick={() => setSidebarOpen(!sidebarOpen)}><SidebarSimple size={20} /></button>
          <button aria-label="Назад" className="icon-button muted"><ArrowLeft size={20} /></button>
          <button aria-label="Вперёд" className="icon-button muted"><ArrowRight size={20} /></button>
          <button aria-label="Новый чат" className="icon-button"><PencilSimple size={20} /></button>
        </div>
        <div className="topbar-right">
          <button aria-label="Рабочая панель" className={`icon-button ${rightPanel ? "selected" : ""}`} onClick={() => setRightPanel(!rightPanel)}><SlidersHorizontal size={18} /></button>
          <button aria-label="Свернуть" className="window-button">−</button>
          <button aria-label="Развернуть" className="window-button">□</button>
        </div>
      </header>

      <aside className="sidebar" aria-hidden={!sidebarOpen}>
        <div className="sidebar-heading">
          <button className="product-switcher">Kolibri AI <CaretDown size={14} weight="bold" /></button>
          <div><button className="icon-button"><MagnifyingGlass size={18} /></button><button className="icon-button"><Bell size={18} /></button></div>
        </div>
        <nav className="main-nav">
          <NavItem icon={PencilSimple} active={screen === "home" && !settings} onClick={() => { setScreen("home"); setSettings(false); setSubmitted(""); }}>Новый чат</NavItem>
          <NavItem icon={Folder} active={screen === "projects"} onClick={() => { setScreen("projects"); setSettings(false); }}>Проекты</NavItem>
          <NavItem icon={Calculator} active={screen === "estimate"} onClick={() => { setScreen("estimate"); setSettings(false); }}>Сметы</NavItem>
          <NavItem icon={FileText} active={screen === "documents"} onClick={() => { setScreen("documents"); setSettings(false); }}>Документы</NavItem>
          <NavItem icon={Database} active={screen === "sources"} onClick={() => { setScreen("sources"); setSettings(false); }}>Источники цен</NavItem>
          <NavItem icon={Clock} active={screen === "scheduled"} onClick={() => { setScreen("scheduled"); setSettings(false); }}>Запланировано</NavItem>
          <NavItem icon={Wrench} active={screen === "plugins"} onClick={() => { setScreen("plugins"); setSettings(false); }}>Плагины</NavItem>
          <NavItem icon={ShieldCheck}>Контроль</NavItem>
        </nav>
        <div className="side-section">
          <p>Закреплённые</p>
          {pinned.map((item, index) => (
            <button key={item} className={`project-row ${currentProject === item ? "active" : ""}`} onContextMenu={event => { event.preventDefault(); setProjectMenu(true); }} onClick={() => { setCurrentProject(item); setSubmitted(""); setSettings(false); setScreen("home"); }}>
              {index === 0 ? <Folder size={18} /> : <ChatCircle size={18} />}<span>{item}</span>
            </button>
          ))}
        </div>
        <div className="side-section projects-section">
          <p>Проекты</p>
          {projects.map(item => <button key={item} className="project-row" onClick={() => setCurrentProject(item)}><Folder size={18} /><span>{item}</span></button>)}
        </div>
        <div className="cluster-row"><span className="status-dot" /> <span>Основной кластер</span><CheckCircle size={17} /></div>
        <button className="account-row" onClick={() => { setSettings(true); setRightPanel(false); }}><span className="avatar">VV</span><span><strong>vova viktorov</strong><small>Настройки · Pro</small></span><Gear size={18} /></button>
      </aside>

      {sidebarOpen && <button className="sidebar-scrim" aria-label="Закрыть меню" onClick={() => setSidebarOpen(false)} />}

      <main className="workspace">
        {settings ? (
          <Settings onClose={() => setSettings(false)} />
        ) : screen === "estimate" ? (
          <EstimateWorkspace project={currentProject} />
        ) : screen === "projects" ? (
          <ProjectsWorkspace onOpen={project => { setCurrentProject(project); setScreen("estimate"); }} />
        ) : screen === "documents" ? (
          <DocumentsWorkspace project={currentProject} />
        ) : screen === "sources" ? (
          <SourcesWorkspace />
        ) : screen === "plugins" ? (
          <Plugins />
        ) : screen === "scheduled" ? (
          <Scheduled />
        ) : !submitted ? (
          <section className="welcome">
            <Bird size={54} className="brand-mark" />
            <h1>Что создадим в <button>{currentProject}</button>?</h1>
            <div className="action-grid">
              {actions.map(({ icon: Icon, color, text, target }) => (
                <button key={text} className="action-card" onClick={() => setScreen(target)}>
                  <Icon size={23} className={color} />
                  <span>{text}</span>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <section className="conversation">
            <div className="conversation-icon"><Sparkle size={23} /></div>
            <h1>{currentProject}</h1>
            <div className="user-message">{submitted}</div>
            <div className="assistant-message"><span className="thinking-dot" /> Приступаю. Сначала изучу проект и соберу точный план изменений.</div>
          </section>
        )}

        {!settings && screen === "home" && <section className="composer-wrap">
          <div className="context-strip"><span><Folder size={17} /> {currentProject}</span><span className="context-secondary"><Calculator size={17} /> Сметы и документы</span><span className="context-secondary">Предварительная</span></div>
          <div className="composer">
            <textarea aria-label="Сообщение" value={value} onChange={event => setValue(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(); } }} placeholder="Опишите объект, работу или приложите файлы" />
            <div className="composer-actions">
              <div><button aria-label="Добавить" className="icon-button"><Plus size={22} /></button><button className="access-button"><ShieldCheck size={17} /> Полный доступ</button></div>
              <div><button className="model-button">Kolibri Сметчик <CaretDown size={14} /></button><button aria-label="Микрофон" className="icon-button"><Microphone size={20} /></button><button aria-label="Отправить" className={`send-button ${value.trim() ? "ready" : ""}`} onClick={submit}><PaperPlaneTilt size={19} weight="fill" /></button></div>
            </div>
          </div>
        </section>}
      </main>

      {rightPanel && !settings && <aside className="utility-panel">
        <div className="utility-tabs"><button className="active"><CheckCircle size={18} /> Проверка</button><button aria-label="Закрыть" onClick={() => setRightPanel(false)}><X size={18} /></button></div>
        <div className="branch-row"><strong>Ревизия сметы</strong><span>Версия 3 · сохранено</span></div>
        <div className="utility-empty"><CheckCircle size={58} /><strong>Критичных замечаний нет</strong><p>Один источник цены требует подтверждения перед выпуском документов.</p></div>
        <div className="utility-shortcuts"><button><CheckCircle size={19} /> Проверка</button><button><Database size={19} /> Источники цен</button><button><ArrowCounterClockwise size={19} /> Ревизии</button><button><Folder size={19} /> Файлы проекта</button></div>
      </aside>}

      {projectMenu && <div className="project-menu">
        <button onClick={() => setProjectMenu(false)}>Открепить проект</button>
        <button onClick={() => setProjectMenu(false)}>Открыть файлы</button>
        <button onClick={() => { setSettings(true); setProjectMenu(false); }}>Редактировать проект</button>
        <button onClick={() => setProjectMenu(false)}>Архивировать чаты</button>
      </div>}
    </div>
  );
}

function Toggle({ checked = false }) {
  const [on, setOn] = useState(checked);
  return <button aria-label="Переключатель" className={`toggle ${on ? "on" : ""}`} onClick={() => setOn(!on)}><span /></button>;
}

function Settings({ onClose }) {
  const [section, setSection] = useState("Общее");
  const sections = ["Общее", "Импорт", "Профиль", "Внешний вид", "Голос", "Конфигурация", "Персонализация", "Питомцы", "Сочетания клавиш", "Использование и оплата"];
  return <section className="settings-view">
    <aside className="settings-nav">
      <button className="back-to-app" onClick={onClose}><ArrowLeft size={18} /> Вернуться в приложение</button>
      <strong>Все настройки</strong>
      <label><MagnifyingGlass size={18} /><input placeholder="Поиск настроек…" /></label>
      <p>Персональные настройки</p>
      {sections.map(item => <button key={item} className={section === item ? "active" : ""} onClick={() => setSection(item)}><Gear size={18} /> {item}</button>)}
    </aside>
    <div className="settings-content">
      <h1>{section}</h1>
      {section === "Внешний вид" ? <Appearance /> : section === "Питомцы" ? <Pets /> : <General section={section} />}
    </div>
  </section>;
}

function General({ section }) {
  return <>
    <h2>{section === "Общее" ? "Редактор" : "Параметры"}</h2>
    <div className="settings-card">
      <div><span><strong>Показывать использование контекстного окна</strong><small>Отображать заполнение контекста во время работы</small></span><Toggle checked /></div>
      <div><span><strong>Сочетание клавиш для отправки</strong><small>Выберите, когда Enter отправляет сообщение</small></span><button className="pill">Enter⌄</button></div>
      <div><span><strong>Последующее поведение</strong><small>Добавляйте следующие запросы в очередь</small></span><button className="pill">Управление</button></div>
    </div>
    <h2>Уведомления</h2>
    <div className="settings-card">
      <div><span><strong>Уведомлять о завершении хода</strong><small>Показывать уведомление после завершения</small></span><Toggle checked /></div>
      <div><span><strong>Уведомлять о вопросах</strong><small>Сообщать, когда агенту нужен ваш ответ</small></span><Toggle checked /></div>
    </div>
  </>;
}

function Appearance() {
  return <><h2>Тема</h2><div className="theme-grid"><button><span className="theme-preview system" />Системная</button><button className="selected"><span className="theme-preview light" />Светлая</button><button><span className="theme-preview dark" />Тёмная</button></div><div className="settings-card appearance-card"><div><strong>Акцентный цвет</strong><span className="color-chip blue-chip">#339CFF</span></div><div><strong>Фон</strong><span className="color-chip">#FFFFFF</span></div><div><strong>Шрифт интерфейса</strong><span className="pill">Kolibri Sans</span></div></div></>;
}

function Pets() {
  const pets = [["Колибри", "Быстрый помощник для смет и документов"], ["Кодекс", "Спокойный спутник для глубокой работы"], ["Искра", "Энергия для быстрых итераций"], ["Сова", "Внимательная проверка результата"]];
  return <><div className="pets-heading"><div><h2>Выберите помощника</h2><p>Помощники следят за задачами и выделяют важное</p></div><button className="pill">Создать</button></div><div className="pets-card">{pets.map(([name, text], index) => <div key={name}><span className={`pet-avatar pet-${index}`}><Bird size={24} /></span><span><strong>{name}</strong><small>{text}</small></span><button className="pill">{index === 0 ? "Выбрано" : "Выбрать"}</button></div>)}</div></>;
}

function Plugins() {
  const items = [["Сметы", "Расчёт и проверка строительных смет"], ["Документы", "Сметы, КС-2, КС-3 и коммерческие предложения"], ["Таблицы", "Работа с XLSX и ведомостями"], ["GitHub", "Код, задачи и публикация изменений"], ["Диск", "Источники и файлы проектов"], ["Почта", "Получение и отправка документов"]];
  return <section className="catalog-page">
    <div className="catalog-top"><div><button className="pill active">Плагины</button><button className="plain-tab">Навыки</button></div><button className="create-button">Создать <CaretDown size={14} /></button></div>
    <h1>Плагины</h1><p className="lead">Подключайте Kolibri AI к вашим рабочим инструментам</p>
    <label className="catalog-search"><MagnifyingGlass size={21} /><input placeholder="Искать плагины" /></label>
    <h2>Установленные</h2><div className="installed-row">{items.map(([name], i) => <span key={name} className={`plugin-icon plugin-${i}`}>{name.slice(0,1)}</span>)}</div>
    <div className="catalog-tabs"><button className="pill">Общедоступные</button><button>Личные</button></div>
    <h2>Рекомендуемые</h2><div className="plugin-grid">{items.map(([name, text], i) => <article key={name}><span className={`plugin-icon plugin-${i}`}>{name.slice(0,1)}</span><span><strong>{name}</strong><small>{text}</small></span><button className="pill">Подключить</button></article>)}</div>
  </section>;
}

function Scheduled() {
  const tasks = [["Проверка новых заявок", "Ежедневно в 9:00 · следующий запуск через 6 часов"], ["Еженедельная сводка", "По пятницам в 16:00"], ["Мониторинг цен материалов", "Каждые 12 часов"], ["Резервная копия проектов", "Ежедневно в 23:30"]];
  return <section className="catalog-page scheduled-page">
    <div className="catalog-top"><span /><button className="create-button">Создать <CaretDown size={14} /></button></div>
    <h1>Запланированные задачи</h1><p className="lead">Планируйте задачи, напоминания и регулярные проверки</p>
    <label className="catalog-search"><MagnifyingGlass size={21} /><input placeholder="Поиск запланированных задач" /></label>
    <div className="catalog-tabs"><button className="pill">Все</button><button>Активные</button><button>Приостановленные</button></div>
    <div className="task-list">{tasks.map(([name, text], index) => <article key={name}><button className={`task-state ${index === 0 ? "active" : ""}`} /><span><strong>{name}</strong><small>{text}</small></span>{index === 2 && <span className="live-dot" />}</article>)}</div>
    <h2 className="recommendation-title">Рекомендации</h2><div className="recommendation"><Sparkle size={20} /><span><strong>Еженедельный обзор проектов</strong><small>Каждую пятницу формировать краткий отчёт о выполненной работе</small></span><button className="pill">Добавить</button></div>
  </section>;
}

function ProjectsWorkspace({ onOpen }) {
  const data = [["Дом 140 м² — кровля и фасад", "Москва", "Предварительная", "1 842 560 ₽"], ["Ремонт офиса 320 м²", "Санкт-Петербург", "Нужны данные", "—"], ["Фабрика Колибри", "Тверская область", "Источники проверены", "6 218 400 ₽"]];
  return <section className="product-page"><div className="page-heading"><div><h1>Проекты</h1><p>Объекты, чаты, сметы и связанные документы</p></div><button className="primary-button"><Plus size={17} /> Новый проект</button></div><label className="page-search"><MagnifyingGlass size={19} /><input placeholder="Найти проект" /></label><div className="project-table"><div className="table-head"><span>Проект</span><span>Регион</span><span>Статус сметы</span><span>Итого</span></div>{data.map(row => <button key={row[0]} onClick={() => onOpen(row[0])}>{row.map((cell,index)=><span key={cell} className={index===2?"status-text":""}>{cell}</span>)}</button>)}</div></section>;
}

function EstimateWorkspace({ project }) {
  const [rows, setRows] = useState([
    { id: 1, name: "Монтаж стропильной системы", unit: "м²", qty: 168, price: 1150, type: "Работа" },
    { id: 2, name: "Пиломатериал хвойный, сорт 1", unit: "м³", qty: 8.4, price: 27800, type: "Материал" },
    { id: 3, name: "Утеплитель минераловатный 200 мм", unit: "м²", qty: 152, price: 980, type: "Материал" },
    { id: 4, name: "Доставка материалов", unit: "рейс", qty: 3, price: 14500, type: "Услуга" },
  ]);
  const [saveState, setSaveState] = useState("Сохранено");
  const update = (id, field, value) => { setRows(items => items.map(row => row.id === id ? {...row, [field]: field === "name" ? value : Number(value)} : row)); setSaveState("Сохранение…"); setTimeout(() => setSaveState("Сохранено"), 500); };
  const subtotal = kind => rows.filter(row => row.type === kind).reduce((sum,row)=>sum+row.qty*row.price,0);
  const work = subtotal("Работа"), materials = subtotal("Материал"), services = subtotal("Услуга"), total = work+materials+services;
  return <section className="estimate-page">
    <header className="estimate-header"><div><button className="breadcrumb"><Folder size={15} /> {project}</button><h1>Смета на кровлю и фасад</h1><p><span className="status-badge preliminary">Предварительная</span> Версия 3 · {saveState}</p></div><div><button className="secondary-button">Ревизии</button><button className="secondary-button"><DownloadSimple size={17} /> Экспорт</button><button className="primary-button">Проверить смету</button></div></header>
    <div className="estimate-tabs"><button className="active">Смета</button><button>Источники <span>3/4</span></button><button>Допущения <span>2</span></button><button>Вопросы <span>1</span></button></div>
    <div className="estimate-notice"><CheckCircle size={19} /><span><strong>Расчёт выполнен детерминированно</strong><small>Итоги пересчитываются после каждого изменения. Для проверки нужен источник цены по доставке.</small></span></div>
    <div className="estimate-sheet"><div className="estimate-row estimate-columns"><span>Позиция</span><span>Тип</span><span>Ед.</span><span>Количество</span><span>Цена</span><span>Сумма</span></div>{rows.map(row => <div className="estimate-row" key={row.id}><input value={row.name} onChange={e=>update(row.id,"name",e.target.value)} /><span className="row-type">{row.type}</span><span>{row.unit}</span><input type="number" value={row.qty} onChange={e=>update(row.id,"qty",e.target.value)} /><input type="number" value={row.price} onChange={e=>update(row.id,"price",e.target.value)} /><strong>{money(row.qty*row.price)}</strong></div>)}<button className="add-row" onClick={()=>setRows(items=>[...items,{id:Date.now(),name:"Новая позиция",unit:"шт.",qty:1,price:0,type:"Работа"}])}><Plus size={17} /> Добавить позицию</button></div>
    <aside className="estimate-summary"><h2>Итоги</h2><div><span>Работы</span><strong>{money(work)}</strong></div><div><span>Материалы</span><strong>{money(materials)}</strong></div><div><span>Услуги и доставка</span><strong>{money(services)}</strong></div><div><span>Резерв</span><strong>не задан</strong></div><div className="grand-total"><span>Всего</span><strong>{money(total)}</strong></div><small>Без НДС · цены для Москвы · актуальность 01.08.2026</small></aside>
  </section>;
}

const money = value => new Intl.NumberFormat("ru-RU", {style:"currency", currency:"RUB", maximumFractionDigits:0}).format(value);

function DocumentsWorkspace({ project }) {
  const docs = [["Смета", "Версия 3", "Готово к проверке"], ["Коммерческое предложение", "Не создано", "Создать из сметы"], ["Акт КС-2", "Не создано", "Выберите период работ"], ["Справка КС-3", "Не создано", "Создаётся после КС-2"], ["Договор", "Черновик", "Требует реквизиты"]];
  return <section className="product-page"><div className="page-heading"><div><button className="breadcrumb"><Folder size={15} /> {project}</button><h1>Документы</h1><p>Формируются только из сохранённой рассчитанной ревизии сметы</p></div><button className="primary-button"><Plus size={17} /> Создать документ</button></div><div className="document-grid">{docs.map(([name,version,action])=><article key={name}><span className="document-icon"><FileText size={22}/></span><div><strong>{name}</strong><small>{version}</small></div><button className="secondary-button">{action}</button></article>)}</div></section>;
}

function SourcesWorkspace() {
  const sources=[["Пиломатериал хвойный", "ООО «ЛесТорг»", "Москва", "27 800 ₽/м³", "01.08.2026", "Подтверждено"], ["Утеплитель 200 мм", "Петрович", "Москва", "980 ₽/м²", "31.07.2026", "Подтверждено"], ["Доставка", "Допущение проекта", "—", "14 500 ₽/рейс", "—", "Нужен источник"]];
  return <section className="product-page"><div className="page-heading"><div><h1>Источники цен</h1><p>Поставщики, даты наблюдения, регион, единицы и НДС</p></div><button className="primary-button"><MagnifyingGlass size={17}/> Найти цены</button></div><div className="source-list">{sources.map(row=><article key={row[0]}>{row.map((cell,index)=><span key={cell}><small>{["Позиция","Источник","Регион","Цена","Дата","Статус"][index]}</small><strong className={index===5&&cell.includes("Нужен")?"warning-text":""}>{cell}</strong></span>)}</article>)}</div></section>;
}
