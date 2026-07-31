import { withCsrfHeader } from "../../lib/csrf.js";

export const ACCOUNT_AGENT_PROFILES = ["auto", "mimo-code", "codex-cli"];

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeString(value, maxLength) {
  return typeof value === "string" && value.trim() && value.trim().length <= maxLength
    ? value.trim()
    : "";
}

export function sanitizeAccountUser(value) {
  if (!isRecord(value)) return null;
  const id = safeString(value.id, 160);
  const tenantId = safeString(value.tenantId ?? value.tenant_id, 160);
  const email = safeString(value.email, 320).toLowerCase();
  const name = safeString(value.name, 160);
  const role = value.role;
  const isPlatformOwner = value.isPlatformOwner ?? value.is_platform_owner;
  const preferredAgentProfile = value.preferredAgentProfile ?? value.preferred_agent_profile;
  const capabilities = value.capabilities;
  if (
    id.length < 8 ||
    tenantId.length < 8 ||
    !email.includes("@") ||
    !name ||
    (role !== "owner" && role !== "user") ||
    typeof isPlatformOwner !== "boolean" ||
    isPlatformOwner !== (role === "owner") ||
    !Array.isArray(capabilities) ||
    capabilities.length > 32 ||
    capabilities.some((capability) => typeof capability !== "string" || !/^[a-z][a-z0-9._-]{1,95}$/.test(capability)) ||
    new Set(capabilities).size !== capabilities.length ||
    !ACCOUNT_AGENT_PROFILES.includes(preferredAgentProfile)
  ) {
    return null;
  }
  return {
    id,
    tenantId,
    email,
    name,
    role,
    isPlatformOwner,
    capabilities,
    preferredAgentProfile,
  };
}

export function sanitizeAccountSession(value) {
  if (!isRecord(value) || typeof value.authenticated !== "boolean") return null;
  if (!value.authenticated) {
    return value.user === null || value.user === undefined
      ? { authenticated: false, user: null }
      : null;
  }
  const user = sanitizeAccountUser(value.user);
  return user ? { authenticated: true, user } : null;
}

export class AccountRequestError extends Error {
  constructor(message, status = 0, code = "account_request_failed") {
    super(message);
    this.name = "AccountRequestError";
    this.status = status;
    this.code = code;
  }
}

async function readPayload(response) {
  if (response.status === 204) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function errorDetails(payload, status) {
  const nested = isRecord(payload?.detail) ? payload.detail : null;
  const code = safeString(payload?.code ?? nested?.code, 120) || `http_${status}`;
  const message =
    safeString(typeof payload?.detail === "string" ? payload.detail : payload?.message ?? nested?.message, 500) ||
    (status === 401 ? "Неверный email или пароль." : "Не удалось выполнить запрос аккаунта.");
  return { code, message };
}

async function requestJson(pathname, init = {}, fetchImpl = globalThis.fetch, allowCsrfRefresh = true) {
  if (typeof fetchImpl !== "function") throw new AccountRequestError("Fetch API недоступен.");
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers({
    Accept: "application/json",
    ...(init.body ? { "Content-Type": "application/json" } : {}),
    ...init.headers,
  });
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
    throw new AccountRequestError(message, response.status, code);
  }
  return payload;
}

export async function getAccountSession({ signal, fetch: fetchImpl } = {}) {
  const payload = await requestJson(
    "/api/v3/session",
    { signal },
    fetchImpl ?? globalThis.fetch,
  );
  const session = sanitizeAccountSession(payload);
  if (!session) throw new AccountRequestError("Backend вернул несовместимую сессию.", 502, "invalid_session_contract");
  return session;
}

export async function loginAccount(input, { fetch: fetchImpl } = {}) {
  const payload = await requestJson(
    "/api/v3/auth/login",
    { method: "POST", body: JSON.stringify(input) },
    fetchImpl ?? globalThis.fetch,
  );
  const session = sanitizeAccountSession(payload);
  if (!session?.authenticated) throw new AccountRequestError("Не удалось подтвердить вход.", 502, "invalid_login_contract");
  return session;
}

export async function registerAccount(input, { fetch: fetchImpl } = {}) {
  const payload = await requestJson(
    "/api/v3/auth/register",
    { method: "POST", body: JSON.stringify(input) },
    fetchImpl ?? globalThis.fetch,
  );
  const session = sanitizeAccountSession(payload);
  if (!session?.authenticated) throw new AccountRequestError("Не удалось создать аккаунт.", 502, "invalid_registration_contract");
  return session;
}

export async function logoutAccount({ fetch: fetchImpl } = {}) {
  await requestJson(
    "/api/v3/auth/logout",
    { method: "POST" },
    fetchImpl ?? globalThis.fetch,
  );
}

export async function updateAgentProfile(profile, { fetch: fetchImpl } = {}) {
  if (!ACCOUNT_AGENT_PROFILES.includes(profile)) throw new TypeError("Unknown agent profile.");
  const payload = await requestJson(
    "/api/v3/profile/agent-profile",
    { method: "PUT", body: JSON.stringify({ profile }) },
    fetchImpl ?? globalThis.fetch,
  );
  const user = sanitizeAccountUser(payload);
  if (!user) throw new AccountRequestError("Backend не подтвердил профиль агента.", 502, "invalid_profile_contract");
  return user;
}

export function accountInitials(user) {
  const parts = user?.name?.split(/\s+/).filter(Boolean) ?? [];
  const initials = parts.slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("ru-RU") ?? "").join("");
  return initials || "К";
}
