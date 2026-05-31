# Mobile Player-First UX (A1)

## Goal

Make the mobile experience feel uncluttered and “player-first” by separating playback controls from metadata + timestamps. Reduce cramped UI and accidental overlaps on small screens.

## Scope

- Applies to the static frontend in:
  - `public/index.html`
  - `index.html`
- Mobile breakpoint target: `max-width: 520px`.
- Desktop/tablet behavior remains close to current behavior (no major layout rewrite in this spec).

## Non-Goals

- New design system or framework migration.
- Rebuilding the entire homepage visual style.
- Advanced gesture scrubbing / YouTube-style autohide controls (explicitly not desired).

## UX Decisions (Confirmed)

- **Overall direction:** Player-first modal.
- **Controls visibility:** Controls do **not** auto-hide. User taps to show/hide.
- **Always-visible controls (mobile):** Play/Pause, Seek, Time, Fullscreen, ✕ Close.
- **Extras placement (mobile):** Quality / rate / mute / PiP are moved into the sheet (or behind a “More” affordance inside the sheet).
- **Bottom sheet:** 2 snap points:
  - Collapsed: title row + grab handle (minimal height)
  - Expanded: full content
- **Panels inside sheet:** Info ⇄ Timestamps switch via **horizontal swipe** (no visible tabs).
- **Close:** ✕ only (no swipe-down-to-close, no tap-outside-to-close on mobile).

## Layout (Mobile)

### Modal container

- On mobile, modal becomes full-screen to avoid nested overflow issues:
  - `position: fixed; inset: 0; width: 100vw; height: 100vh;`
  - `border-radius: 0;`
- Body scroll stays locked while modal is open.

### Player area

- Top section is a dedicated player surface:
  - 16:9 video region sized by width (so the player is predictable).
  - `#playerOverlay` covers the video region for tap + double-tap gestures.
- Playback controls live directly under (or overlay on) the video region and are minimal.

### Bottom sheet

- A dedicated sheet container sits at the bottom of the modal:
  - Uses `transform: translateY(...)` for collapsed/expanded positions.
  - Has a “grab handle” affordance.
  - Expanded state allows vertical scrolling within sheet content.
  - Includes safe-area padding (`env(safe-area-inset-bottom)`).

### Sheet content

- **Collapsed:** shows only title row (title + date/views) and a small hint (“Swipe up for details”).
- **Expanded:** shows one of two panels:
  - **Info panel:** title, date/views, optional “More” actions (quality, rate, mute, PiP if supported).
  - **Timestamps panel:** timestamps list + submit form, all inside the sheet; the old timestamps section below the modal is hidden on mobile.

## Interactions (Mobile)

### Player controls

- Tap video toggles control visibility:
  - Tap when controls visible → hide controls.
  - Tap when hidden → show controls.
- Double-tap seeks:
  - Left third: `-10s`
  - Right third: `+10s`
  - Center third: play/pause

### Sheet snapping

- Dragging the grab handle:
  - Up → expand
  - Down → collapse
- Only 2 snap points (no intermediate state).

### Sheet panel switching

- Horizontal swipe inside the sheet switches panels:
  - Info ⇄ Timestamps
- Gesture constraints:
  - Horizontal swipe should not trigger when user is primarily scrolling vertically (use thresholding).

### Close

- ✕ button is always visible on mobile in the top area (not inside the sheet).
- Pressing Escape (desktop keyboard) remains supported where applicable, but mobile relies on ✕.

## Technical Design

### DOM changes (mobile only)

- Introduce a dedicated sheet container in the modal (new elements) while keeping the existing hook IDs:
  - `#playerOverlay`, `#playerSeek`, `#playerCenterPlay`, `#playerTime`, `#playerFullscreenBtn`, `#playerPipBtn`
- Move timestamps UI into the sheet for mobile:
  - On mobile, hide `.m-ts` outside the modal and render timestamps list/form inside the sheet panel instead.
  - Keep existing IDs (`tsList`, `tsForm`, `tsTime`, `tsDesc`, `tsMsg`) to avoid breaking backend/API assumptions.

### State model (frontend)

- Add a `mobileUi` sub-state:
  - `isMobile` (based on matchMedia)
  - `controlsVisible`
  - `sheetState` = `collapsed | expanded`
  - `sheetPanel` = `info | timestamps`
- Existing playback state (HLS, quality, resume, PiP) remains, but “extra controls” are re-homed into the sheet on mobile.

### Event handling

- Use Pointer Events (`pointerdown/move/up`) for the sheet handle drag and swipe detection.
- Avoid high-frequency layout reads; compute sheet snap positions from viewport height once on open + on resize/orientationchange.

## Accessibility

- Ensure ✕ close is keyboard-focusable and has `aria-label="Close"`.
- Sheet handle should be reachable by keyboard focus (desktop) even if primary target is mobile.
- Maintain tap targets ≥ 44px.

## Testing

- Update/extend `src/frontend.integration.test.ts` to assert presence of new sheet container hook(s) once implemented.
- Keep existing hook tests intact.
- Add a small Playwright/mobile screenshot regression harness (optional) for:
  - Modal open on 390×844 viewport
  - Sheet collapsed vs expanded

## Rollout

- Implement in `public/index.html`, then mirror into root `index.html`.
- Verify on:
  - iPhone-sized viewport (390×844)
  - Android-sized viewport (360×800)
- Deploy via Wrangler Pages deploy.

