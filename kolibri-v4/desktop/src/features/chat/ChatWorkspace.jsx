import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bird,
  Calculator,
  CaretDown,
  CheckCircle,
  FileText,
  MagnifyingGlass,
  PaperPlaneTilt,
  StopCircle,
  Table,
  WarningCircle,
} from "@phosphor-icons/react";
import { createOpaqueId } from "../../lib/ids.js";
import {
  buildAgentPrompt,
  cancelAgentRun,
  extractEstimateArtifact,
  loadThreadMessages,
  streamAgentTurn,
} from "./agent-client.js";

const THREAD_PREFIX = "kolibri:v4:thread:";
const MESSAGE_PREFIX = "kolibri:v4:messages:";

function storage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function threadKey(projectId) {
  return `${THREAD_PREFIX}${projectId}`;
}

function messageKey(projectId) {
  return `${MESSAGE_PREFIX}${projectId}`;
}

function getOrCreateThreadId(projectId) {
  const currentStorage = storage();
  const existing = currentStorage?.getItem(threadKey(projectId));
  if (existing) return existing;
  const created = createOpaqueId("thread_");
  currentStorage?.setItem(threadKey(projectId), created);
  return created;
}

function readCachedMessages(projectId) {
  try {
    const value = JSON.parse(storage()?.getItem(messageKey(projectId)) ?? "[]");
    return Array.isArray(value)
      ? value.filter((item) => item && typeof item.text === "string" && (item.role === "user" || item.role === "assistant")).slice(-200)
      : [];
  } catch {
    return [];
  }
}

function writeCachedMessages(projectId, messages) {
  try {
    storage()?.setItem(messageKey(projectId), JSON.stringify(messages.slice(-200)));
  } catch {
    // Local projection is optional; Product Chat remains the durable authority.
  }
}

export function resetProjectChat(projectId) {
  const currentStorage = storage();
  currentStorage?.removeItem(threadKey(projectId));
  currentStorage?.removeItem(messageKey(projectId));
}

function visibleAssistantText(text) {
  const withoutArtifact = text.replace(/```kolibri-estimate\s*[\s\S]*?```/gi, "").trim();
  return withoutArtifact || "Смета подготовлена и импортирована в редактор.";
}

const quickActions = [
  { icon: Calculator, label: "Составить технологическую карту и смету", prompt: "Сначала составь технологическую карту, затем подготовь предварительную смету. Не выдумывай недостающие данные и цены." },
  { icon: Table, label: "Проверить объёмы и расчёты", prompt: "Проверь исходные объёмы, единицы измерения и расчётную логику. Перечисли ошибки и вопросы." },
  { icon: FileText, label: "Подготовить документы", target: "documents" },
  { icon: MagnifyingGlass, label: "Найти источники цен", prompt: "Определи, каких источников цен не хватает, и составь план подтверждения цен по региону и дате." },
];

export function ChatWorkspace({
  project,
  session,
  selectedProfile,
  onSelectedProfile,
  onOpenSettings,
  onNavigate,
  onEstimateArtifact,
  initialDraft,
  onDraftConsumed,
  resetToken,
}) {
  const [threadId, setThreadId] = useState(() => getOrCreateThreadId(project.id));
  const [messages, setMessages] = useState(() => readCachedMessages(project.id));
  const [value, setValue] = useState("");
  const [running, setRunning] = useState(false);
  const [historyState, setHistoryState] = useState("idle");
  const abortRef = useRef(null);
  const acceptedRunRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => {
    const nextThreadId = getOrCreateThreadId(project.id);
    setThreadId(nextThreadId);
    setMessages(readCachedMessages(project.id));
    setHistoryState("idle");
  }, [project.id, resetToken]);

  useEffect(() => {
    writeCachedMessages(project.id, messages);
    endRef.current?.scrollIntoView({ block: "end", behavior: running ? "auto" : "smooth" });
  }, [messages, project.id, running]);

  useEffect(() => {
    if (!session?.authenticated || !threadId) return undefined;
    const controller = new AbortController();
    setHistoryState("loading");
    loadThreadMessages(threadId, { signal: controller.signal })
      .then((serverMessages) => {
        if (serverMessages.length) setMessages(serverMessages);
        setHistoryState("ready");
      })
      .catch((error) => {
        if (error?.name !== "AbortError") setHistoryState("unavailable");
      });
    return () => controller.abort();
  }, [session?.authenticated, threadId]);

  useEffect(() => {
    if (!initialDraft) return;
    setValue(initialDraft);
    onDraftConsumed?.();
  }, [initialDraft, onDraftConsumed]);

  const profileLabel = useMemo(() => ({ auto: "Авто", "mimo-code": "MiMo Code", "codex-cli": "Codex" })[selectedProfile] ?? "Авто", [selectedProfile]);

  const submit = async () => {
    const prompt = value.trim();
    if (!prompt || running) return;
    const userMessage = { id: createOpaqueId("message_"), role: "user", text: prompt, status: "complete" };
    const assistantId = createOpaqueId("message_");
    setMessages((current) => [...current, userMessage, { id: assistantId, role: "assistant", text: "", status: "running" }]);
    setValue("");
    setRunning(true);
    acceptedRunRef.current = null;
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await streamAgentTurn({
        prompt: buildAgentPrompt(project, prompt),
        threadId,
        agentProfile: selectedProfile,
        signal: controller.signal,
        onAccepted: (runId) => { acceptedRunRef.current = runId; },
        onDelta: (_delta, fullText) => {
          setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, text: fullText, status: "running" } : message));
        },
      });
      const artifact = extractEstimateArtifact(result.text, project);
      setMessages((current) => current.map((message) => message.id === assistantId ? {
        ...message,
        text: visibleAssistantText(result.text),
        status: "complete",
        artifact: artifact ? "estimate" : null,
      } : message));
      if (artifact) onEstimateArtifact(artifact);
    } catch (error) {
      const aborted = controller.signal.aborted;
      setMessages((current) => current.map((message) => message.id === assistantId ? {
        ...message,
        text: aborted ? "Запуск остановлен пользователем." : error instanceof Error ? error.message : "Агентный контур завершил запрос с ошибкой.",
        status: aborted ? "cancelled" : "error",
      } : message));
    } finally {
      setRunning(false);
      abortRef.current = null;
      acceptedRunRef.current = null;
    }
  };

  const stop = async () => {
    const acceptedRunId = acceptedRunRef.current;
    abortRef.current?.abort();
    if (acceptedRunId) {
      try {
        await cancelAgentRun(acceptedRunId);
      } catch {
        // The local stream is already stopped; backend cancellation can be retried from durable history.
      }
    }
  };

  return <section className="chat-workspace">
    <div className="chat-scroll" aria-live="polite">
      {!messages.length ? <div className="chat-welcome">
        <Bird size={55} className="brand-mark" />
        <h1>Что создадим в <button type="button" onClick={() => onNavigate("projects")}>{project.title}</button>?</h1>
        <p>{project.brief || "Опишите задачу — Kolibri создаст проектный контекст и честно отметит недостающие данные."}</p>
        <div className="action-grid">
          {quickActions.map(({ icon: Icon, label, prompt, target }) => <button key={label} type="button" className="action-card" onClick={() => target ? onNavigate(target) : setValue(prompt)}><Icon size={23} /><span>{label}</span></button>)}
        </div>
      </div> : <div className="message-list">
        {messages.map((message) => <article key={message.id} className={`chat-message ${message.role} ${message.status}`}>
          {message.role === "assistant" ? <span className="message-avatar"><Bird size={18} /></span> : null}
          <div className="message-bubble">
            <p>{message.text || (message.status === "running" ? "Агент отвечает…" : "")}</p>
            {message.artifact === "estimate" ? <button type="button" className="artifact-link" onClick={() => onNavigate("estimate")}><CheckCircle size={16} /> Открыть импортированную смету</button> : null}
            {message.status === "error" ? <small><WarningCircle size={14} /> Проверьте вход, подключение модели и backend.</small> : null}
          </div>
        </article>)}
        <div ref={endRef} />
      </div>}
    </div>

    <div className="chat-composer-wrap">
      {!session?.authenticated ? <div className="auth-warning"><WarningCircle size={18} /><span>Для реального запуска агента требуется вход в Kolibri.</span><button type="button" onClick={onOpenSettings}>Войти</button></div> : null}
      <div className="chat-context"><span>{project.title}</span><span>{project.region}</span><span>{historyState === "loading" ? "Загрузка истории…" : historyState === "ready" ? "История синхронизирована" : "Локальная проекция"}</span></div>
      <div className="chat-composer">
        <textarea aria-label="Сообщение агенту" value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(); } }} placeholder="Опишите объект, работу или результат" disabled={running} />
        <div className="chat-composer-actions">
          <label className="agent-select-label">Модель<select aria-label="Профиль агента" value={selectedProfile} onChange={(event) => onSelectedProfile(event.target.value)}><option value="auto">Авто</option><option value="mimo-code">MiMo Code</option><option value="codex-cli">Codex</option></select><CaretDown size={14} /></label>
          {running ? <button className="stop-button" type="button" onClick={() => void stop()}><StopCircle size={19} /> Остановить</button> : <button aria-label="Отправить" className={`send-button ${value.trim() && session?.authenticated ? "ready" : ""}`} type="button" disabled={!value.trim() || !session?.authenticated} onClick={() => void submit()}><PaperPlaneTilt size={19} weight="fill" /></button>}
        </div>
        <small className="composer-footnote">{profileLabel} · AG-UI · секреты моделей не передаются в браузер</small>
      </div>
    </div>
  </section>;
}
