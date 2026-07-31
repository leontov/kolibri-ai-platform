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

## Verification

- Compared the running start screen and settings screen side by side with the supplied references.
- Verified sidebar, right panel, settings, plugins, scheduled tasks, action cards, composer submission, and toggles in the browser.
- Verified responsive overlay behavior below 900px.
- Production build passed.
- Sites worker tests passed: 4/4.

## Design notes

- Preserved the quiet Codex-like hierarchy, pale navigation surface, thin borders, restrained shadows, and chat-first layout.
- Replaced Codex-specific copy with Kolibri AI workflows for estimates, construction documents, projects, and automation.
