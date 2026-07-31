# Kolibri V4 desktop — design QA

Status: passed

## Reference coverage

- Expanded and collapsed desktop sidebar
- Central welcome prompt with four product actions
- Project context composer and submitted-message state
- Right work panel with review, terminal, browser, and files shortcuts
- Project context menu
- Settings navigation, general settings, appearance, and assistants
- Plugins catalog
- Scheduled tasks
- Kolibri-native projects overview
- Editable construction estimate with deterministic totals and autosave feedback
- Separate works, materials, services/delivery, reserve, and total summary
- Price evidence coverage and honest preliminary status
- Saved-revision document slots for estimate, commercial proposal, KС-2, KС-3, and contract

## Verification

- Compared the running start screen and settings screen side by side with the supplied references.
- Verified sidebar, right panel, settings, plugins, scheduled tasks, action cards, composer submission, and toggles in the browser.
- Verified estimate row editing, deterministic recalculation, autosave feedback, project navigation, documents, and price-source screens.
- Verified responsive overlay behavior below 900px.
- Production build passed.
- Sites worker tests passed: 4/4.

## Design notes

- Preserved the quiet Codex-like hierarchy, pale navigation surface, thin borders, restrained shadows, and chat-first layout.
- Used Codex only as the shell and density reference. Navigation, actions, project state, estimate editor, evidence, documents, statuses, and terminology are Kolibri-native.
