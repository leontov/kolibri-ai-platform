# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Kolibri V4 desktop direction

- The supplied Codex desktop screenshots are the visual source of truth for both expanded and collapsed sidebar states.
- Keep the product chat-first: a quiet central prompt, four action cards, and a bottom composer on one axis.
- The desktop sidebar pushes the workspace; below 900px it becomes an overlay.
- Use Kolibri product language and restrained pale-blue navigation, thin borders, subtle shadows, and no dashboard widgets or gradients.
- Codex supplies interaction density and shell behavior only. Product entities must remain Kolibri-native: universal projects and chat in Core; estimates, price evidence, revisions, KС-2/KС-3, and exports in the construction vertical.
- Never label an estimate verified without sufficient inputs and source coverage. Show honest `needs input`, preliminary, source-backed, or verified states.
- Estimate editing must recalculate totals deterministically and expose autosave, source coverage, assumptions, questions, revisions, and export from a saved revision.
