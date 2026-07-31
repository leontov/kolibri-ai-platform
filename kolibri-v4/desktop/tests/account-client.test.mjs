import assert from "node:assert/strict";
import test from "node:test";
import {
  getAccountSession,
  loginAccount,
  sanitizeAccountSession,
} from "../src/features/account/account-client.js";

const sessionPayload = {
  authenticated: true,
  user: {
    id: "user_1234567890",
    tenantId: "tenant_1234567890",
    email: "owner@example.com",
    name: "Владелец Kolibri",
    role: "owner",
    isPlatformOwner: true,
    capabilities: ["providers.manage"],
    preferredAgentProfile: "auto",
  },
};

test("account contract rejects inconsistent owner claims", () => {
  assert.equal(sanitizeAccountSession({
    ...sessionPayload,
    user: { ...sessionPayload.user, role: "user", isPlatformOwner: true },
  }), null);
});

test("session and login use the V3 same-origin API", async () => {
  const calls = [];
  const fetch = async (input, init) => {
    calls.push({ input, init });
    return new Response(JSON.stringify(sessionPayload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const session = await getAccountSession({ fetch });
  const loggedIn = await loginAccount({ email: "owner@example.com", password: "long-enough-password" }, { fetch });
  assert.equal(session.user.isPlatformOwner, true);
  assert.equal(loggedIn.authenticated, true);
  assert.equal(calls[0].input, "/api/v3/session");
  assert.equal(calls[1].input, "/api/v3/auth/login");
  assert.equal(calls[1].init.credentials, "same-origin");
});
