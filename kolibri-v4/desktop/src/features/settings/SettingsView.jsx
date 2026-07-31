import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Gear,
  Info,
  MagnifyingGlass,
  Robot,
  SlidersHorizontal,
  UserCircle,
} from "@phosphor-icons/react";
import { AccountPanel } from "../account/AccountPanel.jsx";
import { AgentConnections } from "../providers/AgentConnections.jsx";

const sections = [
  { id: "account", label: "Аккаунт", icon: UserCircle, keywords: "вход регистрация профиль" },
  { id: "agents", label: "Модели и подключения", icon: Robot, keywords: "mimo codex модель агент" },
  { id: "interface", label: "Интерфейс", icon: SlidersHorizontal, keywords: "анимация плотность" },
  { id: "about", label: "О приложении", icon: Info, keywords: "версия архитектура" },
];

function readPreference(key, fallback = false) {
  try {
    const value = globalThis.localStorage?.getItem(key);
    return value === null ? fallback : value === "true";
  } catch {
    return fallback;
  }
}

function writePreference(key, value) {
  try {
    globalThis.localStorage?.setItem(key, String(value));
  } catch {
    // Preferences are optional.
  }
}

export function SettingsView({
  onClose,
  session,
  sessionStatus,
  onSessionChange,
  onRefreshSession,
  selectedProfile,
  onSelectedProfile,
}) {
  const [section, setSection] = useState("account");
  const [query, setQuery] = useState("");
  const [reduceMotion, setReduceMotion] = useState(() => readPreference("kolibri:v4:reduce-motion"));
  const [comfortableDensity, setComfortableDensity] = useState(() => readPreference("kolibri:v4:comfortable-density"));

  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", reduceMotion);
    writePreference("kolibri:v4:reduce-motion", reduceMotion);
  }, [reduceMotion]);

  useEffect(() => {
    document.documentElement.classList.toggle("comfortable-density", comfortableDensity);
    writePreference("kolibri:v4:comfortable-density", comfortableDensity);
  }, [comfortableDensity]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized ? sections.filter((item) => `${item.label} ${item.keywords}`.toLowerCase().includes(normalized)) : sections;
  }, [query]);

  return <section className="settings-view functional-settings">
    <aside className="settings-nav">
      <button className="back-to-app" type="button" onClick={onClose}><ArrowLeft size={18} /> Вернуться в приложение</button>
      <strong>Настройки Kolibri V4</strong>
      <label><MagnifyingGlass size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск настроек…" /></label>
      <p>Рабочее пространство</p>
      {filtered.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={section === id ? "active" : ""} onClick={() => setSection(id)}><Icon size={18} /> {label}</button>)}
    </aside>
    <main className="settings-content">
      <header className="settings-page-title"><Gear size={24} /><div><h1>{sections.find((item) => item.id === section)?.label}</h1><p>Настройки применяются сразу и не содержат демонстрационных состояний.</p></div></header>
      {section === "account" ? <AccountPanel session={session} sessionStatus={sessionStatus} onSessionChange={onSessionChange} onRefresh={onRefreshSession} /> : null}
      {section === "agents" ? <AgentConnections session={session} selectedProfile={selectedProfile} onSelectedProfile={onSelectedProfile} /> : null}
      {section === "interface" ? <section className="settings-section">
        <div className="settings-section-heading"><SlidersHorizontal size={24} /><div><h2>Интерфейс</h2><p>Два локальных предпочтения без серверных фиктивных данных.</p></div></div>
        <div className="preference-list functional-card">
          <label><span><strong>Уменьшить движение</strong><small>Отключает декоративные переходы и плавную прокрутку.</small></span><input type="checkbox" checked={reduceMotion} onChange={(event) => setReduceMotion(event.target.checked)} /></label>
          <label><span><strong>Комфортная плотность</strong><small>Увеличивает высоту строк и полей редактора.</small></span><input type="checkbox" checked={comfortableDensity} onChange={(event) => setComfortableDensity(event.target.checked)} /></label>
        </div>
      </section> : null}
      {section === "about" ? <section className="settings-section">
        <div className="settings-section-heading"><Info size={24} /><div><h2>Kolibri V4 desktop</h2><p>Chat-first оболочка поверх существующего защищённого V3 Product/API контура.</p></div></div>
        <div className="about-grid functional-card">
          <div><span>Чат</span><strong>AG-UI / SSE</strong></div>
          <div><span>Провайдеры</span><strong>MiMo Code и Codex</strong></div>
          <div><span>Смета</span><strong>Детерминированный локальный расчёт</strong></div>
          <div><span>Секреты</span><strong>Только серверный authority</strong></div>
        </div>
      </section> : null}
    </main>
  </section>;
}
