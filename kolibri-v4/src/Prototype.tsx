import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArchiveIcon,
  ArrowLeftIcon,
  ChatBubbleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  Cross2Icon,
  DashboardIcon,
  DrawingPinFilledIcon,
  DotsHorizontalIcon,
  FileTextIcon,
  GearIcon,
  GlobeIcon,
  HamburgerMenuIcon,
  ImageIcon,
  MagnifyingGlassIcon,
  MagicWandIcon,
  MixerHorizontalIcon,
  MixerVerticalIcon,
  PaperPlaneIcon,
  Pencil2Icon,
  PersonIcon,
  PlusIcon,
  ReaderIcon,
  ReloadIcon,
  SpeakerLoudIcon,
} from "@radix-ui/react-icons";
import { KeyboardInput, MobileScroll, useKeyboard, useKeyboardInsets } from "./mobile";

type Screen = "chat" | "projects" | "project" | "settings";

const projects = [
  { name: "Фабрика Колибри", updated: "1 неделю назад", pinned: true },
  { name: "Бизнес-план", updated: "3 недели назад" },
  { name: "Колибри", updated: "3 недели назад" },
  { name: "Дом, кровля и забор", updated: "3 недели назад" },
];

function IconButton({ label, children, onClick, className = "" }: { label: string; children: React.ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button className={`icon-button ${className}`} type="button" aria-label={label} onClick={onClick}>
      {children}
    </button>
  );
}

function TopBar({ title, openMenu, action }: { title: string; openMenu: () => void; action?: React.ReactNode }) {
  return (
    <header className="top-bar">
      <div className="menu-button-wrap">
        <IconButton label="Открыть меню" onClick={openMenu}><HamburgerMenuIcon /></IconButton>
        <span className="notification-dot">1</span>
      </div>
      <button className="screen-title" type="button" aria-label={`Текущий раздел: ${title}`}>
        {title}{title === "Чат" && <ChevronDownIcon />}
      </button>
      {action ?? <IconButton label="Открыть профиль" className="profile-button"><PersonIcon /></IconButton>}
    </header>
  );
}

function ChatScreen({ openMenu, openSettings }: { openMenu: () => void; openSettings: () => void }) {
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const keyboard = useKeyboard();
  const { bottomInset } = useKeyboardInsets();

  const send = () => {
    if (!message.trim()) return;
    setSent(true);
    setMessage("");
    keyboard.hide();
  };

  return (
    <section className="screen chat-screen" aria-label="Чат Kolibri">
      <TopBar title="Чат" openMenu={openMenu} action={<IconButton label="Открыть профиль" className="profile-button" onClick={openSettings}><PersonIcon /></IconButton>} />
      <MobileScroll className="chat-scroll">
        <main className="chat-canvas">
          {sent ? (
            <div className="conversation-preview" aria-live="polite">
              <div className="user-bubble">Составь смету на ремонт квартиры</div>
              <div className="assistant-answer">
                <div className="assistant-mark">K</div>
                <div>
                  <strong>Начинаю смету</strong>
                  <p>Уточните площадь квартиры и состав работ. Я сохраню результат в проект и подготовлю PDF или XLSX.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="starter-actions" aria-label="Быстрые действия">
              <button type="button" onClick={() => setMessage("Составь смету на ремонт квартиры")}><DashboardIcon />Создать смету</button>
              <button type="button" onClick={() => setMessage("Проверь загруженный документ")}><Pencil2Icon />Проверить документ</button>
              <button type="button" onClick={() => setMessage("Подготовь акт КС-2 и справку КС-3")}><FileTextIcon />Подготовить КС-2 / КС-3</button>
            </div>
          )}
        </main>
      </MobileScroll>
      <div className="composer-layer" style={{ bottom: bottomInset + 18 }}>
        <div className="composer">
          <IconButton label="Прикрепить файл" className="composer-icon"><PlusIcon /></IconButton>
          <KeyboardInput
            aria-label="Сообщение для Kolibri"
            placeholder="Спросить Kolibri..."
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") send(); }}
          />
          <IconButton label="Голосовой ввод" className="composer-icon"><SpeakerLoudIcon /></IconButton>
          <IconButton label={message ? "Отправить" : "Начать голосовой разговор"} className="voice-button" onClick={send}>
            {message ? <PaperPlaneIcon /> : <MixerVerticalIcon />}
          </IconButton>
        </div>
      </div>
    </section>
  );
}

function ProjectsScreen({ openMenu, openProject }: { openMenu: () => void; openProject: () => void }) {
  const [query, setQuery] = useState("");
  const { bottomInset } = useKeyboardInsets();
  const visibleProjects = projects.filter((project) => project.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <section className="screen projects-screen" aria-label="Проекты">
      <TopBar title="Проекты" openMenu={openMenu} action={<IconButton label="Создать проект"><PlusIcon /></IconButton>} />
      <MobileScroll className="projects-scroll">
        <main className="projects-content">
          <div className="filter-row" role="tablist" aria-label="Фильтр проектов">
            <button className="active" type="button" role="tab" aria-selected="true">Все</button>
            <button type="button" role="tab" aria-selected="false">Созданные вами</button>
            <button type="button" role="tab" aria-selected="false">Общие</button>
          </div>
          <div className="project-list">
            {visibleProjects.map((project) => (
              <button className="project-row" type="button" key={project.name} onClick={openProject}>
                <span className="project-icon"><ArchiveIcon /></span>
                <span className="project-copy"><strong>{project.name}</strong><small>{project.updated}</small></span>
                {project.pinned && <DrawingPinFilledIcon className="pin-icon" />}
              </button>
            ))}
            {visibleProjects.length === 0 && <p className="empty-search">Проекты не найдены</p>}
          </div>
        </main>
      </MobileScroll>
      <div className="search-layer" style={{ bottom: bottomInset + 18 }}>
        <div className="search-field"><MagnifyingGlassIcon /><KeyboardInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск проектов" aria-label="Поиск проектов" /></div>
      </div>
    </section>
  );
}

function ProjectScreen({ back }: { back: () => void }) {
  const [tab, setTab] = useState<"chats" | "sources">("chats");
  const [message, setMessage] = useState("");
  const { bottomInset } = useKeyboardInsets();

  return (
    <section className="screen project-screen" aria-label="Проект Дом, кровля и забор">
      <header className="project-top-bar">
        <IconButton label="Назад к проектам" onClick={back}><ArrowLeftIcon /></IconButton>
        <div className="project-heading"><strong>Дом, кровля и забор</strong><button type="button">Чат <ChevronDownIcon /></button></div>
        <IconButton label="Действия проекта"><DotsHorizontalIcon /></IconButton>
      </header>
      <div className="project-tabs" role="tablist" aria-label="Содержимое проекта">
        <button className={tab === "chats" ? "active" : ""} type="button" role="tab" aria-selected={tab === "chats"} onClick={() => setTab("chats")}>Чаты</button>
        <button className={tab === "sources" ? "active" : ""} type="button" role="tab" aria-selected={tab === "sources"} onClick={() => setTab("sources")}>Источники</button>
      </div>
      <MobileScroll className="project-detail-scroll">
        <main className="project-detail-content">
          {tab === "chats" ? (
            <div className="project-chat-list">
              <button type="button"><strong>Смета на кровлю и ограждение</strong><span>Черновик сметы готов, осталось уточнить материалы</span></button>
              <button type="button"><strong>Проверка объёмов работ</strong><span>Сверены площади кровли, фасада и периметр участка</span></button>
            </div>
          ) : (
            <div className="source-list">
              <button type="button"><FileTextIcon /><span><strong>Ведомость объёмов.xlsx</strong><small>Добавлено сегодня</small></span></button>
              <button type="button"><ImageIcon /><span><strong>Фото объекта</strong><small>12 изображений</small></span></button>
            </div>
          )}
        </main>
      </MobileScroll>
      <div className="composer-layer" style={{ bottom: bottomInset + 18 }}>
        <div className="composer">
          <IconButton label="Прикрепить файл" className="composer-icon"><PlusIcon /></IconButton>
          <KeyboardInput aria-label="Сообщение в проекте" placeholder="Сообщение проекту..." value={message} onChange={(event) => setMessage(event.target.value)} />
          <IconButton label="Голосовой ввод" className="composer-icon"><SpeakerLoudIcon /></IconButton>
          <IconButton label="Отправить" className="voice-button"><PaperPlaneIcon /></IconButton>
        </div>
      </div>
    </section>
  );
}

function SettingsScreen({ close }: { close: () => void }) {
  return (
    <section className="screen settings-screen" aria-label="Настройки">
      <IconButton label="Закрыть настройки" className="close-settings" onClick={close}><Cross2Icon /></IconButton>
      <MobileScroll className="settings-scroll">
        <main className="settings-content">
          <div className="account-head">
            <div className="avatar">VK<span><Pencil2Icon /></span></div>
            <h1>Вова Викторов</h1>
          </div>
          <SettingsGroup title="Настроить Kolibri" items={[
            [<MixerHorizontalIcon />, "Персонализация", ""],
            [<ReaderIcon />, "Память", ""],
            [<MagicWandIcon />, "Инструменты", ""],
          ]} />
          <SettingsGroup title="Учётная запись" items={[
            [<PersonIcon />, "Профиль и вход", ""],
            [<DashboardIcon />, "Подписка", "Pro"],
            [<ReloadIcon />, "Восстановить покупки", ""],
            [<ClockIcon />, "Использование и лимиты", ""],
          ]} />
        </main>
      </MobileScroll>
    </section>
  );
}

function SettingsGroup({ title, items }: { title: string; items: [React.ReactNode, string, string][] }) {
  return (
    <section className="settings-group">
      <h2>{title}</h2>
      <div className="settings-card">
        {items.map(([icon, label, value]) => (
          <button type="button" key={label} className="settings-row">
            <span>{icon}</span><strong>{label}</strong>{value && <em>{value}</em>}<ChevronRightIcon className="settings-chevron" />
          </button>
        ))}
      </div>
    </section>
  );
}

function NavigationDrawer({ open, close, navigate }: { open: boolean; close: () => void; navigate: (screen: Screen) => void }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button className="drawer-scrim" aria-label="Закрыть меню" type="button" onClick={close} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.aside className="drawer" initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }} aria-label="Главное меню">
            <div className="drawer-head"><strong>Kolibri</strong><IconButton label="Поиск"><MagnifyingGlassIcon /></IconButton></div>
            <nav className="drawer-nav">
              <button type="button"><ImageIcon />Изображения</button>
              <button type="button"><ReaderIcon />Документы</button>
              <button type="button" onClick={() => navigate("projects")}><ArchiveIcon />Проекты</button>
              <button type="button"><ClockIcon />Запланированные</button>
              <button type="button"><GlobeIcon />Справочники</button>
              <button type="button"><DashboardIcon />Больше</button>
            </nav>
            <div className="drawer-history">
              <h2>Закреплено</h2>
              <button type="button"><ArchiveIcon />Фабрика Колибри</button>
              <button type="button"><ChatBubbleIcon />Смета дома</button>
              <button type="button"><ChatBubbleIcon />Акты КС-2 и КС-3</button>
              <h2>Недавнее</h2>
              <button type="button"><ChatBubbleIcon />Ремонт квартиры</button>
            </div>
            <div className="drawer-footer">
              <button className="new-chat" type="button" onClick={() => navigate("chat")}><Pencil2Icon />Чат</button>
              <IconButton label="Настройки" onClick={() => navigate("settings")}><GearIcon /></IconButton>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export default function Prototype() {
  const [screen, setScreen] = useState<Screen>("chat");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const keyboard = useKeyboard();
  const navigate = (next: Screen) => {
    keyboard.hide();
    setScreen(next);
    setDrawerOpen(false);
    window.setTimeout(() => keyboard.hide(), 0);
  };

  return (
    <div className="kolibri-app">
      {screen === "chat" && <ChatScreen openMenu={() => setDrawerOpen(true)} openSettings={() => navigate("settings")} />}
      {screen === "projects" && <ProjectsScreen openMenu={() => setDrawerOpen(true)} openProject={() => navigate("project")} />}
      {screen === "project" && <ProjectScreen back={() => navigate("projects")} />}
      {screen === "settings" && <SettingsScreen close={() => navigate("chat")} />}
      <NavigationDrawer open={drawerOpen} close={() => setDrawerOpen(false)} navigate={navigate} />
    </div>
  );
}
