import { withCsrfHeader } from "../../lib/csrf.js";
import { createOpaqueId, isSafeOpaqueId } from "../../lib/ids.js";
import { normalizeEstimate } from "../estimate/estimate-store.js";

export const AGENT_PROFILES = ["auto", "mimo-code", "codex-cli"];
const MAX_PROMPT_LENGTH = 100_000;
const ESTIMATE_FENCE = /```kolibri-estimate\s*([\s\S]*?)```/i;

export class AgentRunError extends Error {
  constructor(message, code = "agent_run_failed", status = 0) {
    super(message);
    this.name = "AgentRunError";
    this.code = code;
    this.status = status;
  }
}

function normalizePrompt(value) {
  if (typeof value !== "string") throw new TypeError("Prompt must be a string.");
  const prompt = value.trim();
  if (!prompt) throw new AgentRunError("Введите сообщение.", "empty_prompt");
  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw new AgentRunError("Сообщение слишком большое.", "prompt_too_large");
  }
  return prompt;
}

function parseEventBlock(block) {
  const data = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");
  if (!data || data === "[DONE]") return null;
  try {
    return JSON.parse(data);
  } catch {
    throw new AgentRunError("Поток агента содержит повреждённое событие.", "invalid_event_stream");
  }
}

export async function consumeAgentEventStream(response, onDelta = () => {}) {
  if (!response.body) throw new AgentRunError("Сервер не вернул поток ответа.", "missing_stream");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let finished = false;

  const apply = (event) => {
    if (!event || typeof event !== "object") return;
    if (event.type === "TEXT_MESSAGE_CONTENT") {
      if (typeof event.delta !== "string" || !event.delta) {
        throw new AgentRunError("Получена некорректная часть ответа.", "invalid_text_delta");
      }
      text += event.delta;
      onDelta(event.delta, text);
      return;
    }
    if (event.type === "RUN_ERROR") {
      throw new AgentRunError(
        typeof event.message === "string" && event.message.trim()
          ? event.message.trim()
          : "Агент завершил задачу с ошибкой.",
        typeof event.code === "string" ? event.code : "run_error",
      );
    }
    if (event.type === "RUN_FINISHED") finished = true;
  };

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() ?? "";
    for (const block of blocks) apply(parseEventBlock(block));
    if (done) break;
  }
  if (buffer.trim()) apply(parseEventBlock(buffer));
  if (!finished) throw new AgentRunError("Поток агента завершился без подтверждения результата.", "incomplete_stream");
  return text;
}

async function responseError(response) {
  let payload = null;
  try {
    payload = await response.clone().json();
  } catch {
    payload = null;
  }
  const nested = payload && typeof payload.detail === "object" ? payload.detail : null;
  const code = payload?.code ?? nested?.code ?? `http_${response.status}`;
  const message =
    (typeof payload?.message === "string" && payload.message) ||
    (typeof payload?.detail === "string" && payload.detail) ||
    (typeof nested?.message === "string" && nested.message) ||
    (response.status === 401
      ? "Войдите в Kolibri, чтобы отправлять сообщения агентам."
      : "Агентный контур не принял запрос.");
  return new AgentRunError(message, String(code), response.status);
}

export function buildAgentPrompt(project, prompt) {
  const normalized = normalizePrompt(prompt);
  const context = [
    "Контекст проекта Kolibri:",
    `Название: ${project.title}`,
    `Регион: ${project.region || "не указан"}`,
    project.brief ? `Исходное описание: ${project.brief}` : "Исходное описание: не заполнено",
    "",
    `Запрос пользователя: ${normalized}`,
    "",
    "Правила результата:",
    "1. Не выдумывай объёмы, нормы, цены, источники или факт проверки.",
    "2. Явно отделяй известные данные, допущения и вопросы.",
    "3. Если можешь подготовить редактируемую смету, добавь в конце блок строго такого вида:",
    "```kolibri-estimate",
    '{"title":"...","reservePercent":0,"rows":[{"name":"...","type":"Работа|Материал|Услуга","unit":"...","qty":0,"price":0,"source":""}]}',
    "```",
    "4. Неподтверждённую цену указывай как 0, а source оставляй пустым.",
  ].join("\n");
  return normalizePrompt(context);
}

export function extractEstimateArtifact(text, project) {
  if (typeof text !== "string") return null;
  const match = text.match(ESTIMATE_FENCE);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    const raw = parsed?.artifact === "estimate" && parsed.estimate ? parsed.estimate : parsed;
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.rows)) return null;
    const estimate = normalizeEstimate(
      {
        ...raw,
        projectId: project.id,
        revision: Number(raw.revision) || 1,
        approval: null,
      },
      project,
    );
    return estimate.rows.length ? estimate : null;
  } catch {
    return null;
  }
}

export function sanitizeThreadMessages(value, expectedThreadId) {
  if (!value || typeof value !== "object" || value.threadId !== expectedThreadId || !Array.isArray(value.messages)) {
    return null;
  }
  const messages = [];
  for (const raw of value.messages.slice(-200)) {
    if (!raw || typeof raw !== "object" || !isSafeOpaqueId(raw.id)) continue;
    if (raw.role !== "user" && raw.role !== "assistant") continue;
    const parts = Array.isArray(raw.content) ? raw.content : [];
    const text = parts
      .filter((part) => part && part.type === "text" && typeof part.text === "string")
      .map((part) => part.text)
      .join("\n")
      .trim();
    if (!text) continue;
    messages.push({ id: raw.id, role: raw.role, text, status: "complete" });
  }
  return messages;
}

export async function loadThreadMessages(threadId, { fetch: fetchImpl = globalThis.fetch, signal } = {}) {
  if (!isSafeOpaqueId(threadId)) throw new AgentRunError("Некорректный идентификатор чата.", "invalid_thread_id");
  const response = await fetchImpl(`/api/v3/chat/threads/${encodeURIComponent(threadId)}/messages`, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (response.status === 404) return [];
  if (!response.ok) throw await responseError(response);
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new AgentRunError("Backend вернул повреждённую историю чата.", "invalid_history_json");
  }
  const messages = sanitizeThreadMessages(payload, threadId);
  if (!messages) throw new AgentRunError("Backend вернул несовместимую историю чата.", "invalid_history_contract");
  return messages;
}

export async function streamAgentTurn(
  {
    prompt: rawPrompt,
    threadId,
    agentProfile = "auto",
    signal,
    onDelta,
    onAccepted,
  },
  { fetch: fetchImpl = globalThis.fetch, allowCsrfRefresh = true } = {},
) {
  const prompt = normalizePrompt(rawPrompt);
  if (!isSafeOpaqueId(threadId)) throw new AgentRunError("Некорректный идентификатор чата.", "invalid_thread_id");
  if (!AGENT_PROFILES.includes(agentProfile)) throw new AgentRunError("Неизвестный профиль агента.", "invalid_agent_profile");
  if (typeof fetchImpl !== "function") throw new AgentRunError("Fetch API недоступен.", "fetch_unavailable");

  const runId = createOpaqueId("run_");
  const messageId = createOpaqueId("message_");
  const body = JSON.stringify({
    threadId,
    runId,
    messages: [{ id: messageId, role: "user", content: prompt }],
    state: null,
    tools: [],
    context: [],
    forwardedProps: {
      agentProfile,
      executionMode: "standard",
    },
  });

  const request = async (refreshAllowed) => {
    const response = await fetchImpl("/api/agui", {
      method: "POST",
      headers: withCsrfHeader({
        Accept: "text/event-stream",
        "Content-Type": "application/json",
      }),
      credentials: "same-origin",
      cache: "no-store",
      signal,
      body,
    });

    if (!response.ok) {
      const error = await responseError(response);
      if (
        refreshAllowed &&
        (error.code === "csrf_token_required" || error.code === "csrf_token_stale")
      ) {
        const refreshed = await fetchImpl("/api/v3/session", {
          credentials: "same-origin",
          cache: "no-store",
          signal,
        });
        if (refreshed.ok) return request(false);
      }
      throw error;
    }

    const mediaType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
    if (mediaType !== "text/event-stream") {
      throw new AgentRunError("Сервер вернул ответ не в формате AG-UI.", "invalid_content_type");
    }
    const acceptedRunId = response.headers.get("x-kolibri-run-id");
    if (!isSafeOpaqueId(acceptedRunId)) {
      await response.body?.cancel().catch(() => undefined);
      throw new AgentRunError("Сервер не подтвердил идентификатор запуска.", "missing_run_id");
    }

    onAccepted?.(acceptedRunId);
    const text = await consumeAgentEventStream(response, onDelta);
    return { runId: acceptedRunId, text };
  };

  return request(allowCsrfRefresh);
}

export async function cancelAgentRun(runId, { fetch: fetchImpl = globalThis.fetch } = {}) {
  if (!isSafeOpaqueId(runId)) throw new AgentRunError("Некорректный идентификатор запуска.", "invalid_run_id");
  const response = await fetchImpl(`/api/v3/chat/runs/${encodeURIComponent(runId)}/cancel`, {
    method: "POST",
    headers: withCsrfHeader({ Accept: "application/json" }),
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) throw await responseError(response);
  if (response.status !== 204) throw new AgentRunError("Backend не подтвердил остановку запуска.", "invalid_cancel_response");
}
