import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  Calculator,
  CheckCircle,
  Clock,
  Database,
  FileText,
  Folder,
  Gear,
  MagnifyingGlass,
  PencilSimple,
  ShieldCheck,
  SidebarSimple,
  SlidersHorizontal,
  WarningCircle,
  Wrench,
  X,
} from "@phosphor-icons/react";
import { getAccountSession, accountInitials, updateAgentProfile } from "./features/account/account-client.js";
import { ChatWorkspace, resetProjectChat } from "./features/chat/ChatWorkspace.jsx";
import { EstimateWorkspace } from "./features/estimate/EstimateWorkspace.jsx";
import { deriveEstimateStatus, writeEstimate } from "./features/estimate/estimate-store.js";
import { SettingsView } from "./features/settings/SettingsView.jsx";
import {
  DocumentsWorkspace,
  EmptyProductWorkspace,
  ProjectsWorkspace,
  SourcesWorkspace,
} from "./features/workspaces/ProjectWorkspaces.jsx";
import { createProject, readProjects, writeProjects } from "./features/workspaces/project-store.js";

function browserStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function NavItem({ icon: Icon, children, active, onClick }) {
  return <button type="button" className={`nav-item ${active ? "active" : ""}`} onClick={onClick}><Icon size={19} /><span>{children}</span></button>;
}

export function App() {
  const [projects, setProjects] = useState(() => readProjects(browserStorage()));
  const [currentProjectId, setCurrentProjectId] = useState(() => browserStorage()?.getItem("kolibri:v4:current-project") ?? "project_house_134");
  const [screen, setScreen] = useState("home");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightPanel, setRightPanel] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState("");
  const [chatResetToken, setChatResetToken] = useState(0);
  const [estimateToken, setEstimateToken] = useState(0);
  const [selectedProfile, setSelectedProfile] = useState(() => browserStorage()?.getItem("kolibri:v4:agent-profile") ?? "auto");
  const [sessionState, setSessionState] = useState({ status: "loading", session: null });

  const currentProject = useMemo(
    () => projects.find((project) => project.id === currentProjectId) ?? projects[0],
    [currentProjectId, projects],
  );

  useEffect(() => {
    if (!currentProject) return;
    browserStorage()?.setItem("kolibri:v4:current-project", currentProject.id);
  }, [currentProject]);

  const refreshSession = useCallback(async () => {
    setSessionState((current) => ({ ...current, status: "loading" }));
    try {
      const session = await getAccountSession();
      setSessionState({ status: "ready", session });
      if (session.authenticated && session.user?.preferredAgentProfile) {
        setSelectedProfile(session.user.preferredAgentProfile);
        browserStorage()?.setItem("kolibri:v4:agent-profile", session.user.preferredAgentProfile);
      }
    } catch {
      setSessionState({ status: "error", session: { authenticated: false, user: null } });
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const updateProjects = useCallback((updater) => {
    setProjects((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      writeProjects(browserStorage(), next);
      return next;
    });
  }, []);

  const updateProjectStatus = useCallback((status) => {
    updateProjects((current) => current.map((project) => project.id === currentProjectId && project.estimateStatus !== status ? { ...project, estimateStatus: status } : project));
  }, [currentProjectId, updateProjects]);

  const selectProject = (projectId, nextScreen = "home") => {
    setCurrentProjectId(projectId);
    setScreen(nextScreen);
    setSettingsOpen(false);
    setRightPanel(false);
  };

  const createNewProject = ({ title, region, brief }) => {
    const project = createProject(title, region || "Регион не указан", brief);
    updateProjects((current) => [...current, project]);
    selectProject(project.id, "home");
    return project;
  };

  const selectAgentProfile = async (profile) => {
    setSelectedProfile(profile);
    browserStorage()?.setItem("kolibri:v4:agent-profile", profile);
    if (!sessionState.session?.authenticated) return;
    try {
      const user = await updateAgentProfile(profile);
      setSessionState({ status: "ready", session: { authenticated: true, user } });
    } catch {
      // The local selector remains usable; backend will still validate every run.
    }
  };

  const handleEstimateArtifact = (estimate) => {
    writeEstimate(browserStorage(), estimate);
    updateProjectStatus(deriveEstimateStatus(estimate).label);
    setEstimateToken((value) => value + 1);
    setScreen("estimate");
  };

  const startNewChat = () => {
    resetProjectChat(currentProject.id);
    setChatResetToken((value) => value + 1);
    setDraftPrompt("");
    setScreen("home");
    setSettingsOpen(false);
  };

  const askAgent = (prompt) => {
    setDraftPrompt(prompt);
    setScreen("home");
    setSettingsOpen(false);
  };

  const backendLabel = sessionState.status === "loading"
    ? "Проверка backend"
    : sessionState.status === "error"
      ? "Backend недоступен"
      : sessionState.session?.authenticated
        ? "Backend подключён"
        : "Backend доступен";

  if (!currentProject) return null;

  return <div className={`app-shell ${sidebarOpen ? "sidebar-open" : ""} ${settingsOpen ? "settings-open" : ""} ${rightPanel ? "utility-open" : ""}`}>
    <header className="topbar">
      <div className="topbar-left">
        <button aria-label="Открыть боковую панель" type="button" className="icon-button" onClick={() => setSidebarOpen((value) => !value)}><SidebarSimple size={20} /></button>
        <button aria-label="Новый чат" type="button" className="icon-button" onClick={startNewChat}><PencilSimple size={20} /></button>
      </div>
      <strong className="topbar-project">{settingsOpen ? "Настройки Kolibri V4" : currentProject.title}</strong>
      <div className="topbar-right">
        <button aria-label="Поиск" type="button" className="icon-button" onClick={() => setScreen("projects")}><MagnifyingGlass size={18} /></button>
        <button aria-label="Уведомления" type="button" className="icon-button" onClick={() => setScreen("scheduled")}><Bell size={18} /></button>
        <button aria-label="Рабочая панель" type="button" className={`icon-button ${rightPanel ? "selected" : ""}`} onClick={() => setRightPanel((value) => !value)}><SlidersHorizontal size={18} /></button>
      </div>
    </header>

    <aside className="sidebar" aria-hidden={!sidebarOpen}>
      <div className="sidebar-heading"><strong>Kolibri AI</strong><span>V4</span></div>
      <nav className="main-nav">
        <NavItem icon={PencilSimple} active={screen === "home" && !settingsOpen} onClick={startNewChat}>Новый чат</NavItem>
        <NavItem icon={Folder} active={screen === "projects"} onClick={() => { setScreen("projects"); setSettingsOpen(false); }}>Проекты</NavItem>
        <NavItem icon={Calculator} active={screen === "estimate"} onClick={() => { setScreen("estimate"); setSettingsOpen(false); }}>Сметы</NavItem>
        <NavItem icon={FileText} active={screen === "documents"} onClick={() => { setScreen("documents"); setSettingsOpen(false); }}>Документы</NavItem>
        <NavItem icon={Database} active={screen === "sources"} onClick={() => { setScreen("sources"); setSettingsOpen(false); }}>Источники цен</NavItem>
        <NavItem icon={Clock} active={screen === "scheduled"} onClick={() => { setScreen("scheduled"); setSettingsOpen(false); }}>Запланировано</NavItem>
        <NavItem icon={Wrench} active={screen === "plugins"} onClick={() => { setScreen("plugins"); setSettingsOpen(false); }}>Плагины</NavItem>
        <NavItem icon={ShieldCheck} active={rightPanel} onClick={() => setRightPanel(true)}>Контроль</NavItem>
      </nav>
      <div className="side-section projects-section">
        <p>Проекты</p>
        {projects.map((project) => <button type="button" key={project.id} className={`project-row ${project.id === currentProject.id ? "active" : ""}`} onClick={() => selectProject(project.id)}><Folder size={18} /><span>{project.title}</span></button>)}
      </div>
      <div className="cluster-row"><span className={`status-dot ${sessionState.status === "error" ? "error" : ""}`} /><span>{backendLabel}</span>{sessionState.status === "error" ? <WarningCircle size={17} /> : <CheckCircle size={17} />}</div>
      <button type="button" className="account-row" onClick={() => { setSettingsOpen(true); setRightPanel(false); }}><span className="avatar">{accountInitials(sessionState.session?.user)}</span><span><strong>{sessionState.session?.user?.name ?? "Войти в Kolibri"}</strong><small>{sessionState.session?.user?.isPlatformOwner ? "Владелец платформы" : "Настройки и модели"}</small></span><Gear size={18} /></button>
    </aside>

    {sidebarOpen ? <button className="sidebar-scrim" aria-label="Закрыть меню" type="button" onClick={() => setSidebarOpen(false)} /> : null}

    <main className="workspace">
      {settingsOpen ? <SettingsView onClose={() => setSettingsOpen(false)} session={sessionState.session} sessionStatus={sessionState.status} onSessionChange={(session) => setSessionState({ status: "ready", session })} onRefreshSession={refreshSession} selectedProfile={selectedProfile} onSelectedProfile={(profile) => void selectAgentProfile(profile)} /> : screen === "home" ? <ChatWorkspace key={`${currentProject.id}:${chatResetToken}`} project={currentProject} session={sessionState.session} selectedProfile={selectedProfile} onSelectedProfile={(profile) => void selectAgentProfile(profile)} onOpenSettings={() => setSettingsOpen(true)} onNavigate={setScreen} onEstimateArtifact={handleEstimateArtifact} initialDraft={draftPrompt} onDraftConsumed={() => setDraftPrompt("")} resetToken={chatResetToken} /> : screen === "projects" ? <ProjectsWorkspace projects={projects} currentProjectId={currentProject.id} onSelect={(id) => selectProject(id, "home")} onCreate={createNewProject} onOpenEstimate={(id) => selectProject(id, "estimate")} /> : screen === "estimate" ? <EstimateWorkspace key={`${currentProject.id}:${estimateToken}`} project={currentProject} onProjectStatusChange={updateProjectStatus} onNavigate={setScreen} /> : screen === "sources" ? <SourcesWorkspace key={currentProject.id} project={currentProject} onAskAgent={() => askAgent("Найди и сравни актуальные источники цен для позиций текущей сметы. Укажи дату, регион, НДС и единицу измерения; неподтверждённые цены не выдумывай.")} onNavigate={setScreen} onProjectStatusChange={updateProjectStatus} /> : screen === "documents" ? <DocumentsWorkspace project={currentProject} onNavigate={setScreen} /> : <EmptyProductWorkspace type={screen} />}
    </main>

    {rightPanel && !settingsOpen ? <aside className="utility-panel">
      <div className="utility-tabs"><button type="button" className="active"><ShieldCheck size={18} /> Контроль</button><button aria-label="Закрыть" type="button" onClick={() => setRightPanel(false)}><X size={18} /></button></div>
      <div className="branch-row"><strong>{currentProject.title}</strong><span>{currentProject.estimateStatus}</span></div>
      <div className="utility-empty">{currentProject.estimateStatus === "Цены подтверждены" || currentProject.estimateStatus === "Утверждена локально" ? <CheckCircle size={58} /> : <WarningCircle size={58} />}<strong>{currentProject.estimateStatus}</strong><p>Статус строится из фактических строк, цен и источников. Проверка не становится зелёной от демонстрационных данных.</p></div>
      <div className="utility-shortcuts"><button type="button" onClick={() => setScreen("estimate")}><Calculator size={19} /> Редактор сметы</button><button type="button" onClick={() => setScreen("sources")}><Database size={19} /> Источники цен</button><button type="button" onClick={() => setScreen("documents")}><FileText size={19} /> Документы</button><button type="button" onClick={() => setScreen("projects")}><Folder size={19} /> Проекты</button></div>
    </aside> : null}
  </div>;
}
