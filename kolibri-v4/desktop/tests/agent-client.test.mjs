import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAgentPrompt,
  cancelAgentRun,
  consumeAgentEventStream,
  extractEstimateArtifact,
  sanitizeThreadMessages,
  streamAgentTurn,
} from "../src/features/chat/agent-client.js";

function eventStream(events, headers = {}) {
  const body = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "x-kolibri-run-id": "run_1234567890abcdef",
      ...headers,
    },
  });
}

const project = {
  id: "project_12345678",
  title: "Одноэтажный дом 134 м²",
  region: "Регион не указан",
  brief: "Мягкая кровля и монолитная плита",
};

test("SSE consumer emits text and requires RUN_FINISHED", async () => {
  const deltas = [];
  const text = await consumeAgentEventStream(eventStream([
    { type: "RUN_STARTED" },
    { type: "TEXT_MESSAGE_CONTENT", delta: "Готовлю " },
    { type: "TEXT_MESSAGE_CONTENT", delta: "смету" },
    { type: "RUN_FINISHED" },
  ]), (delta) => deltas.push(delta));
  assert.equal(text, "Готовлю смету");
  assert.deepEqual(deltas, ["Готовлю ", "смету"]);
});

test("AG-UI request keeps authority out of browser payload", async () => {
  let request;
  const result = await streamAgentTurn({
    prompt: "Проверь исходные данные",
    threadId: "thread_1234567890abcdef",
    agentProfile: "codex-cli",
  }, {
    fetch: async (input, init) => {
      request = { input, init };
      return eventStream([
        { type: "TEXT_MESSAGE_CONTENT", delta: "Нужен регион." },
        { type: "RUN_FINISHED" },
      ]);
    },
  });
  const body = JSON.parse(request.init.body);
  assert.equal(request.input, "/api/agui");
  assert.equal(request.init.credentials, "same-origin");
  assert.equal(body.forwardedProps.agentProfile, "codex-cli");
  assert.equal(body.forwardedProps.executionMode, "standard");
  assert.equal(body.state, null);
  assert.deepEqual(body.tools, []);
  assert.deepEqual(body.context, []);
  assert.equal("tenantId" in body, false);
  assert.equal(result.text, "Нужен регион.");
});

test("estimate artifact imports only the explicit fenced contract", () => {
  const text = `Подготовлен черновик.\n\n\`\`\`kolibri-estimate\n{"title":"Смета","rows":[{"name":"Монтаж","type":"Работа","unit":"м²","qty":10,"price":0,"source":""}]}\n\`\`\``;
  const artifact = extractEstimateArtifact(text, project);
  assert.equal(artifact.projectId, project.id);
  assert.equal(artifact.rows[0].price, 0);
  assert.equal(extractEstimateArtifact("обычный текст", project), null);
});

test("project prompt forbids invented prices", () => {
  const prompt = buildAgentPrompt(project, "Составь смету");
  assert.match(prompt, /Не выдумывай/);
  assert.match(prompt, /Неподтверждённую цену указывай как 0/);
  assert.match(prompt, /Одноэтажный дом 134 м²/);
});

test("durable history is sanitized and cancellation uses the run endpoint", async () => {
  const messages = sanitizeThreadMessages({
    threadId: "thread_1234567890abcdef",
    messages: [{ id: "message_1234567890", role: "assistant", content: [{ type: "text", text: "Ответ" }] }],
  }, "thread_1234567890abcdef");
  assert.equal(messages[0].text, "Ответ");
  let request;
  await cancelAgentRun("run_1234567890abcdef", {
    fetch: async (input, init) => {
      request = { input, init };
      return new Response(null, { status: 204 });
    },
  });
  assert.equal(request.input, "/api/v3/chat/runs/run_1234567890abcdef/cancel");
  assert.equal(request.init.method, "POST");
});
