import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("assistant catalog is backend-driven and passed as a preference only", async () => {
  const [catalog, client, runtime, thread, route] = await Promise.all([
    read("lib/assistants/catalog.ts"),
    read("lib/product-chat/client.ts"),
    read("app/MyRuntimeProvider.tsx"),
    read("components/assistant-ui/thread.tsx"),
    read("app/api/v3/assistants/route.ts"),
  ]);

  assert.match(route, /proxyV3JsonRequest\(request, "\/v1\/assistants"\)/);
  assert.match(catalog, /parseTerminalAssistantCatalog/);
  assert.match(catalog, /availability: "available" \| "offline"/);
  assert.match(client, /getAssistantId: \(\) => string \| null/);
  assert.match(client, /\.\.\.\(assistantId === null \? \{\} : \{ assistantId \}\)/);
  assert.match(runtime, /loadTerminalAssistantCatalog\(\)/);
  assert.match(runtime, /getAssistantId: \(\) => selectedAssistantIdRef\.current/);
  assert.match(thread, /<AssistantSelector compact=\{compact\} \/>/);

  for (const forbidden of [
    'assistantId: "estimator"',
    'assistantId: "documents"',
    'assistantId: "research"',
    'assistantId: "developer"',
  ]) {
    assert.doesNotMatch(runtime, new RegExp(forbidden));
    assert.doesNotMatch(thread, new RegExp(forbidden));
  }
});

test("browser cannot submit node, skill path, workspace, or authority fields", async () => {
  const client = await read("lib/product-chat/client.ts");
  const forwardedProps = client.slice(client.indexOf("forwardedProps:"));

  assert.doesNotMatch(forwardedProps, /nodeId:/);
  assert.doesNotMatch(forwardedProps, /nodePool:/);
  assert.doesNotMatch(forwardedProps, /skillIds:/);
  assert.doesNotMatch(forwardedProps, /skillPath:/);
  assert.doesNotMatch(forwardedProps, /workspaceRef:/);
  assert.doesNotMatch(forwardedProps, /tenantId:/);
  assert.doesNotMatch(forwardedProps, /authority:/);
});
