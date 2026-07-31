import assert from "node:assert/strict";
import test from "node:test";
import {
  getProviderConnections,
  sanitizeProviderList,
  startProviderEnrollment,
} from "../src/features/providers/provider-client.js";

const provider = {
  id: "codex-cli",
  displayName: "untrusted label",
  status: "connected",
  statusLabel: "Подключён",
  authFlowSupported: true,
  detail: "Authority confirmed Codex login",
  lastVerifiedAt: "2026-08-01T00:00:00.000Z",
};

test("provider projection is sanitized and completed in canonical order", () => {
  const value = sanitizeProviderList({ providers: [provider], authorityConfigured: true });
  assert.equal(value.providers.length, 2);
  assert.equal(value.providers[0].id, "mimo-code");
  assert.equal(value.providers[1].displayName, "Codex");
  assert.equal(value.providers[1].status, "connected");
});

test("provider list uses same-origin credentials", async () => {
  let request;
  const result = await getProviderConnections({
    fetch: async (input, init) => {
      request = { input, init };
      return new Response(JSON.stringify({ providers: [provider], authorityConfigured: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  assert.equal(request.input, "/api/superadmin/provider-connections");
  assert.equal(request.init.credentials, "same-origin");
  assert.equal(result.providers[1].id, "codex-cli");
});

test("enrollment sends no browser secret and includes idempotency", async () => {
  let request;
  const result = await startProviderEnrollment("codex-cli", {
    fetch: async (input, init) => {
      request = { input, init };
      return new Response(JSON.stringify({ provider }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  assert.equal(request.input, "/api/superadmin/provider-connections/codex-cli/enrollments");
  assert.equal(request.init.method, "POST");
  assert.equal(request.init.body, undefined);
  assert.match(request.init.headers.get("Idempotency-Key"), /^enrollment_[a-f0-9]{36}$/);
  assert.equal(result.id, "codex-cli");
});
