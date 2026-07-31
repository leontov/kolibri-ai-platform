const DEFAULT_COOKIE_NAME = "kolibri_v3_csrf";
const SAFE_COOKIE_NAME = /^[A-Za-z0-9_-]{1,120}$/;
const SAFE_TOKEN = /^[A-Za-z0-9_-]{32,512}$/;

function decodeCookiePart(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}

export function csrfCookieName() {
  const configured = import.meta.env?.VITE_KOLIBRI_CSRF_COOKIE_NAME?.trim() ?? "";
  return SAFE_COOKIE_NAME.test(configured) ? configured : DEFAULT_COOKIE_NAME;
}

export function readCsrfToken(cookieHeader = typeof document === "undefined" ? "" : document.cookie) {
  const expectedName = csrfCookieName();
  for (const segment of cookieHeader.split(";")) {
    const separator = segment.indexOf("=");
    if (separator < 1) continue;
    const name = decodeCookiePart(segment.slice(0, separator).trim());
    if (name !== expectedName) continue;
    const token = decodeCookiePart(segment.slice(separator + 1).trim());
    return SAFE_TOKEN.test(token) ? token : null;
  }
  return null;
}

export function withCsrfHeader(headers) {
  const result = new Headers(headers);
  const token = readCsrfToken();
  if (token) result.set("x-csrf-token", token);
  return result;
}
