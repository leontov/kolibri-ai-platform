# Kolibri V4 desktop — functional vertical slice

This slice replaces the static construction mock with a modular, executable path:

1. Account session, login, registration and logout use the existing same-origin V3 BFF.
2. Chat sends the latest user turn to `/api/agui`, consumes the AG-UI event stream and cancels accepted runs through `/api/v3/chat/runs/{runId}/cancel`.
3. MiMo Code and Codex connections are read and started through the existing super-admin provider endpoints. The browser never asks for or stores a provider secret.
4. The initial 134 m² house project contains only the brief supplied by the product owner. Its estimate is empty until the user or an actual agent adds rows.
5. Estimate rows are editable, autosaved locally and recalculated deterministically. Status is derived from row completeness and price-source coverage.
6. An agent may return an explicit fenced `kolibri-estimate` JSON artifact. The UI validates and imports it; ordinary prose is never interpreted as a document.
7. Project, source and document surfaces use actual saved data. Fake schedules, plugins and pre-generated documents were removed and replaced with honest empty states.

## Runtime boundary

For local development, set `KOLIBRI_V4_API_PROXY_TARGET` to the running V3 web/BFF origin, for example `http://127.0.0.1:3103`. In production, the hosting edge must route `/api/*` to the same V3 BFF origin as the V4 frontend.

## Verification

- `npm run test:unit`: API, data, artifact, security and source contracts.
- `npm run build`: Vite production bundle plus the retained Sites packaging step.
- `npm run test:sites`: retained Worker/hosting contract.
- `.github/workflows/kolibri-v4-desktop.yml`: repeats all three gates on pull requests and `main` changes that touch V4 desktop.
