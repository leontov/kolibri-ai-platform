import { withCsrfHeader } from "../../lib/csrf.js";
import { createOpaqueId } from "../../lib/ids.js";

export const PROVIDER_IDS = ["mimo-code", "codex-cli"];

const PRESENTATION = {
  "mimo-code": {
    displayName: "MiMo Code",
    defaultDetail: "Подключение MiMo ещё не подтверждено серверным контуром.",
  },
  "codex-cli": {
    displayName: "Codex",
    defaultDetail: "Вход Codex ещё не подтверждён Provider Execution Authority.",
  },
};

const STATUS_LABELS = {
  not_configured: "Не подключён",
  pending: "Ожидает подтверждения",
  connected: "Подключён",
  error: "Требует внимания",
};

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeText(value, fallback, maxLength = 500) {
  if (typeof value !== "string") return fallback;
  const candidate = value.trim();
  return candidate && candidate.length <= maxLength ? candidate : fallback;
}

function safeTimestamp(value) {
  if (typeof value !== "string" || value.length > 64) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function defaultProvider(id) {
  if (!PROVIDER_IDS.includes(id)) throw new TypeError("Unknown provider.");
  return {
    id,
    displayName: PRESENTATION[id].displayName,
    status: "not_configured",
    statusLabel: STATUS_LABELS.not_configured,
    authFlowSupported: false,
    detail: PRESENTATION[id].defaultDetail,
    lastVerifiedAt: null,
  };
}

export function sanitizeProvider(value) {
  if (!isRecord(value) || !PROVIDER_IDS.includes(value.id) || !(value.status in STATUS_LABELS)) {
    return null;
  }
  return {
    id: value.id,
    displayName: PRESENTATION[value.id].displayName,
    status: value.status,
    statusLabel: safeText(value.statusLabel, STATUS_LABELS[value.status], 80),
    authFlowSupported: value.authFlowSupported === true,
    detail: safeText(value.detail, PRESENTATION[value.id].defaultDetail),
    lastVerifiedAt: safeTimestamp(value.lastVerifiedAt),
  };
}

export function sanitizeProviderList(value) {
  if (!isRecord(value) || !Array.isArray(value.providers) || typeof value.authorityConfigured !== "boolean") {
    return null;
  }
  const providers = new Map();
  for (const candidate of value.providers) {
    const provider = sanitizeProvider(candidate);
    if (provider && !providers.has(provider.id)) providers.set(provider.id, provider);
  }
  return {
    authorityConfigured: value.authorityConfigured,
    providers: PROVIDER_IDS.map((id) => providers.get(id) ?? defaultProvider(id)),
  };
}

export class ProviderRequestError extends Error {
  constructor(message, status = 0, code = "provider_request_failed") {
    super(message);
    this.name = "ProviderRequestError";
    this.status = status;
    this.code = code;
  }
}

async function readPayload(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function errorDetails(payload, status) {
  const nested = isRecord(payload?.detail) ? payload.detail : null;
  const code = safeText(payload?.code ?? nested?.code, `http_${status}`, 120);
  const message = safeText(
    typeof payload?.detail === "string" ? payload.detail : payload?.message ?? nested?.message,
    status === 401
      ? "Требуется вход владельца платформы."
      : "Контур провайдеров не выполнил операцию.",
  );
  return { code, message };
}

async function requestJson(pathname, init = {}, fetchImpl = globalThis.fetch, allowCsrfRefresh = true) {
  if (typeof fetchImpl !== "function") throw new ProviderRequestError("Fetch API недоступен.");
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers({ Accept: "application/json", ...init.headers });
  const response = await fetchImpl(pathname, {
    ...init,
    method,
    headers: method === "GET" || method === "HEAD" ? headers : withCsrfHeader(headers),
    credentials: "same-origin",
    cache: "no-store",
  });
  const payload = await readPayload(response);
  if (!response.ok) {
    const { code, message } = errorDetails(payload, response.status);
    if (
      allowCsrfRefresh &&
      method !== "GET" &&
      (code === "csrf_token_required" || code === "csrf_token_stale")
    ) {
      const refreshed = await fetchImpl("/api/v3/session", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (refreshed.ok) return requestJson(pathname, init, fetchImpl, false);
    }
    throw new ProviderRequestError(message, response.status, code);
  }
  return payload;
}

export async function getProviderConnections({ signal, fetch: fetchImpl } = {}) {
  const payload = await requestJson(
    "/api/superadmin/provider-connections",
    { signal },
    fetchImpl ?? globalThis.fetch,
  );
  const list = sanitizeProviderList(payload);
  if (!list) throw new ProviderRequestError("Сервер вернул несовместимое состояние провайдеров.");
  return list;
}

export async function startProviderEnrollment(providerId, { fetch: fetchImpl } = {}) {
  if (!PROVIDER_IDS.includes(providerId)) throw new TypeError("Unknown provider.");
  const payload = await requestJson(
    `/api/superadmin/provider-connections/${providerId}/enrollments`,
    {
      method: "POST",
      headers: { "Idempotency-Key": createOpaqueId("enrollment_") },
    },
    fetchImpl ?? globalThis.fetch,
  );
  const provider = sanitizeProvider(payload?.provider);
  if (!provider || provider.id !== providerId) {
    throw new ProviderRequestError("Сервер не подтвердил запуск подключения.");
  }
  return provider;
}
