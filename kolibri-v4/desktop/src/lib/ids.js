const SAFE_OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._~-]{7,159}$/;

export function isSafeOpaqueId(value) {
  return typeof value === "string" && SAFE_OPAQUE_ID.test(value);
}

export function createOpaqueId(prefix) {
  if (!/^[a-z][a-z0-9_]{1,20}_$/i.test(prefix)) {
    throw new TypeError("Opaque ID prefix is invalid.");
  }

  const cryptoObject = globalThis.crypto;
  if (!cryptoObject?.getRandomValues) {
    throw new Error("Secure random number generation is unavailable.");
  }

  const bytes = new Uint8Array(18);
  cryptoObject.getRandomValues(bytes);
  const suffix = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  const result = `${prefix}${suffix}`;
  if (!isSafeOpaqueId(result)) throw new Error("Generated opaque ID is invalid.");
  return result;
}
