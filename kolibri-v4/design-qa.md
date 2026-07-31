# Kolibri V4 mobile design QA

## Comparison target

- Source visual truth: `/workspace/scratch/b197cf64601c/upload/aba7fd79-86f8-4ca5-8f69-a2f4e4d1195c.png`
- Browser-rendered implementation: `/workspace/scratch/kolibri-v4-chat-implementation-final.png`
- State: signed-in empty chat, light theme, iPhone runtime, keyboard closed.
- Source pixels: `944 × 2048` (high-density screenshot).
- Implementation capture: `360 × 781` pixels from the app viewport; the protected mobile runtime represents a `393 × 852` CSS-pixel iPhone screen and was scaled to `0.917` by the cloud preview stage.
- Normalization: equal-aspect app-only captures were compared proportionally. Device status chrome was excluded from fidelity findings because it is template-owned and live.

## Full-view comparison evidence

The final browser capture preserves the source composition: sparse white canvas, centered chat title, circular edge controls, a large uninterrupted conversation area, contextual actions immediately above the bottom composer, and an outlined pill composer. Kolibri-specific action labels intentionally replace ChatGPT-specific labels without changing hierarchy.

## Focused comparison evidence

The header, quick-action cluster, and composer were readable in the full-view pair, so a separate crop was not required. Icons use one vector icon family with consistent stroke weight. The source profile mark is intentionally replaced by the product account affordance; no image asset was approximated with CSS art.

## Required fidelity surfaces

- Fonts and typography: system UI stack, bold section/action labels, muted placeholders, and truncation match the reference hierarchy. Long project names truncate safely.
- Spacing and layout rhythm: header and composer positions match the source proportions; action placement was corrected during iteration 2. Touch controls are at least 48 px in the unscaled CSS viewport.
- Colors and tokens: white canvas, near-black ink, neutral grays, red notification badge, blue voice action, and restrained green Kolibri response mark are coherent with the source.
- Image quality and assets: the screen contains no raster content requiring generation. Runtime device chrome uses the template's native assets. UI icons come from Radix Icons; there are no handcrafted SVG/CSS substitutes.
- Copy and content: labels are product-specific and concise. Estimate and KS-2/KS-3 actions are shown as optional chat prompts, not as dashboard modules.

## Interaction and browser evidence

- Tested: open/close navigation drawer, open projects, search projects, open project, switch Chats/Sources, return to projects, open/close settings, enter and submit a chat request.
- Build/runtime: protected runtime integrity check passed; production build passed; Sites worker tests passed.
- Console: no application-origin console errors. The cloud browser reported only unrelated extension metadata errors from a `chrome-extension://` URL.
- Responsive: iPhone preview verified. The same runtime retains the protected Pixel 10 device preset; no app-owned horizontal overflow was observed.

## Comparison history

### Iteration 1

- [P2] Quick actions were too high in the empty canvas, leaving an oversized gap above the composer.
- Fix: reduced the chat canvas bottom reserve from `240px` to `130px` and matched the compact-height rule.
- Post-fix evidence: `kolibri-v4-chat-implementation-final.png` shows the action group anchored immediately above the composer, matching the source's lower-screen rhythm.

### Iteration 2

- No actionable P0/P1/P2 differences remain.
- [P3] The blue voice button uses the closest available mixer icon rather than the source product's proprietary waveform mark.

## Implementation checklist

- [x] Match the empty-chat composition.
- [x] Add Kolibri product actions without dashboard clutter.
- [x] Implement drawer, projects, project detail, sources, settings, and chat submission states.
- [x] Verify runtime integrity, build, browser interactions, and console output.

final result: passed
