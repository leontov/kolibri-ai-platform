import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("V4 desktop is modular and contains no hardcoded estimate prices", async () => {
  const [app, estimate, chat, provider, projects] = await Promise.all([
    read("src/App.jsx"),
    read("src/features/estimate/EstimateWorkspace.jsx"),
    read("src/features/chat/agent-client.js"),
    read("src/features/providers/provider-client.js"),
    read("src/features/workspaces/project-store.js"),
  ]);
  assert.ok(app.split("\n").length < 300, "App.jsx must remain an orchestration shell");
  assert.match(app, /ChatWorkspace/);
  assert.match(app, /EstimateWorkspace/);
  assert.doesNotMatch(app, /27800|1150|14500|1 842 560/);
  assert.doesNotMatch(estimate, /Монтаж стропильной|Пиломатериал хвойный|Утеплитель минераловатный/);
  assert.match(chat, /["']\/api\/agui["']/);
  assert.match(chat, /state:\s*null/);
  assert.match(provider, /provider-connections\/\$\{providerId\}\/enrollments/);
  assert.doesNotMatch(provider, /apiKey|password|localStorage/);
  assert.match(projects, /Одноэтажный дом 134 м²/);
});

test("all visible fake catalogs and schedules are replaced by explicit empty states", async () => {
  const source = await read("src/features/workspaces/ProjectWorkspaces.jsx");
  assert.match(source, /Фиктивные расписания удалены/);
  assert.match(source, /Фиктивный каталог удалён/);
  assert.doesNotMatch(source, /Проверка новых заявок|Еженедельная сводка|Резервная копия проектов/);
});
