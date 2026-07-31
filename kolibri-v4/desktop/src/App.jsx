import { useState } from "react";
import {
  ArrowCounterClockwise,
  ArrowLeft,
  ArrowRight,
  Bell,
  Bird,
  Bug,
  CaretDown,
  ChatCircle,
  CheckCircle,
  Clock,
  Code,
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
  X,
  Wrench,
} from "@phosphor-icons/react";

const actions = [
  { icon: Code, color: "blue", text: "Изучить проект и разобраться в нём" },
  { icon: Hammer, color: "violet", text: "Создать смету, документ или инструмент" },
  { icon: ArrowCounterClockwise, color: "green", text: "Проверить результат и предложить изменения" },
  { icon: Bug, color: "orange", text: "Исправить проблему или ошибку" },
];

const pinned = ["kolibri-ai-platform", "Смета дома 140 м²", "Акты КС-2 и КС-3"];
const projects = ["Колибри", "Фабрика смет", "База документов"];

function NavItem({ icon: Icon, children, active, onClick }) {
  return <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}><Icon size={19} /> <span>{children}</span></button>;
}

export function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentProject, setCurrentProject] = useState("kolibri-ai-platform");
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
          <NavItem icon={Folder}>Проекты</NavItem>
          <NavItem icon={GridFour}>Документы</NavItem>
          <NavItem icon={Clock} active={screen === "scheduled"} onClick={() => { setScreen("scheduled"); setSettings(false); }}>Запланировано</NavItem>
          <NavItem icon={Wrench} active={screen === "plugins"} onClick={() => { setScreen("plugins"); setSettings(false); }}>Плагины</NavItem>
          <NavItem icon={ShieldCheck}>Контроль</NavItem>
        </nav>
        <div className="side-section">
          <p>Закреплённые</p>
          {pinned.map((item, index) => (
            <button key={item} className={`project-row ${currentProject === item ? "active" : ""}`} onContextMenu={event => { event.preventDefault(); setProjectMenu(true); }} onClick={() => { setCurrentProject(item); setSubmitted(""); setSettings(false); }}>
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
        ) : screen === "plugins" ? (
          <Plugins />
        ) : screen === "scheduled" ? (
          <Scheduled />
        ) : !submitted ? (
          <section className="welcome">
            <Bird size={54} className="brand-mark" />
            <h1>Что создадим в <button>{currentProject}</button>?</h1>
            <div className="action-grid">
              {actions.map(({ icon: Icon, color, text }) => (
                <button key={text} className="action-card" onClick={() => setValue(text)}>
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
          <div className="context-strip"><span><Folder size={17} /> {currentProject}</span><span className="context-secondary"><Code size={17} /> Облачный кластер</span><span className="context-secondary">main</span></div>
          <div className="composer">
            <textarea aria-label="Сообщение" value={value} onChange={event => setValue(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(); } }} placeholder="Выполните любую задачу" />
            <div className="composer-actions">
              <div><button aria-label="Добавить" className="icon-button"><Plus size={22} /></button><button className="access-button"><ShieldCheck size={17} /> Полный доступ</button></div>
              <div><button className="model-button">Kolibri Pro <CaretDown size={14} /></button><button aria-label="Микрофон" className="icon-button"><Microphone size={20} /></button><button aria-label="Отправить" className={`send-button ${value.trim() ? "ready" : ""}`} onClick={submit}><PaperPlaneTilt size={19} weight="fill" /></button></div>
            </div>
          </div>
        </section>}
      </main>

      {rightPanel && !settings && <aside className="utility-panel">
        <div className="utility-tabs"><button className="active"><CheckCircle size={18} /> Проверка</button><button aria-label="Закрыть" onClick={() => setRightPanel(false)}><X size={18} /></button></div>
        <div className="branch-row"><strong>Ветка</strong><span>main</span></div>
        <div className="utility-empty"><Code size={58} /><strong>Изменений пока нет</strong><p>Результаты работы агента появятся здесь.</p></div>
        <div className="utility-shortcuts"><button><CheckCircle size={19} /> Проверка</button><button><TerminalWindow size={19} /> Терминал</button><button><MagnifyingGlass size={19} /> Браузер</button><button><Folder size={19} /> Файлы</button></div>
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
