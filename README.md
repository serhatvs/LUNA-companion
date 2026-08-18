# Code Companion · Luna

A featherweight desktop pet for people who spend their days waiting on
builds. Luna is a tiny pixel cat who **lives on your screen** like a classic
screen pet (think Shimeji or ComNyang): she wanders around over your windows,
you can grab her and throw her, she purrs when you pet her, and she dozes off
if you ignore her. That's the whole app: no chat, no dashboard, no login, no
backend.

## What it is

- **A desktop pet, not a window.** Built with [Tauri v2](https://tauri.app),
  so it runs inside your OS's own webview — a few MB on disk, near-zero idle
  CPU, and it shares the browser engine you already have instead of bundling
  a second one (that's what keeps it light while your memory is busy with
  builds and editors).
- **She walks around your screen.** The window is a tiny transparent,
  frameless, always-on-top square — barely bigger than Luna herself — and it
  glides across your monitor above the taskbar. No title bar, no taskbar
  entry, no focus steal: she never pulls focus away from your editor.
- **Grab her and throw her.** Click and drag Luna — she dangles upside down
  from your cursor, squeaking. Flick her and she tumbles through the air,
  bounces off the edges, and lands with a puff of dust and an "oomph!".
- **Pet her.** A plain click (no drag) is a pat: she lights up happy, says
  something sweet, and purrs.
- **She has a life of her own.** She wanders back and forth along the bottom
  of your screen, sits down, watches your cursor as it passes, blinks, and
  mutters idle lines. Leave her alone for a couple of minutes and she dozes
  off with floating z's — click her to wake her up.
- **Ghost mode.** Right-click her (or press **Ctrl+Alt+L** from anywhere,
  even mid-build) and she stops catching clicks entirely: she floats over
  your code without blocking a single click. Press Ctrl+Alt+L again to bring
  her back.
- **Right-click menu.** Toggle ghost mode, mute/unmute her, or close her.
- **Tiny voice.** Her meows, purrs, squeaks, and thuds are synthesized with
  the Web Audio API — no sound files, no assets, ~1 KB of code. Mute her
  from the right-click menu; the preference is stored locally.

## Controls

| Action | What happens |
| --- | --- |
| Click Luna (no drag) | She's petted: happy pose, purr, sweet bubble |
| Drag + flick Luna | She dangles, then flies — bounces, lands, dust puff |
| Click her while asleep | She wakes up grumpy ("mrr?!") |
| Right-click her | Menu: ghost mode, mute, close |
| **Ctrl+Alt+L** | Toggle ghost mode (click-through) from anywhere |

## Running it

### As a desktop app (what it's for)

Prerequisites: [Bun](https://bun.sh), Rust (stable), and your OS's webview
dependencies (WebKitGTK on Linux, WebView2 on Windows — usually already
present on macOS/Windows).

```bash
bun install
bun run tauri:dev       # run in a real desktop window
bun run tauri:build     # produce the app binary
```

Luna opens as a tiny transparent square (150×180) parked at the
bottom-center of your screen, always on top of your editor, and starts
wandering — that's the point. To change the window size or behavior, edit
`src-tauri/tauri.conf.json` and `src-tauri/src/lib.rs`.

### Downloading / installing the app

There are two ways to get an installer, depending on whether you want to
build on your own machine or have GitHub do it for you:

**Option A — build it yourself.** Requires [Bun](https://bun.sh) and Rust
(stable). On your machine:

```bash
bun install
bun run tauri:build
```

The installer lands in `src-tauri/target/release/bundle/` — a `.msi`/
`.exe` on Windows, a `.dmg` on macOS, or a `.deb`/`.AppImage` on Linux.
Double-click it and Luna is installed.

**Option B — let GitHub Actions build it.** Push this repo to GitHub, then
open the **Actions** tab → **Build desktop app** → **Run workflow**. A few
minutes later, download your platform's installer from the run's
**Artifacts** section. (For a formal release, push a tag like `v0.1.0` and
the workflow drafts a GitHub Release with the installers attached.)

Note: installers are unsigned, so Windows SmartScreen and macOS
Gatekeeper will show a warning on first run — click through, it's your own
app. Bundling/notarization can be added later if you want to share it
beyond your team.

Transparency notes: on Linux the transparent window needs a compositor
(any modern desktop has one); on Windows it just works. Ghost mode
(click-through) is best on Windows/macOS — on Linux it depends on the
compositor, and Luna falls back to interactive if the OS refuses.

### As a web preview (sandbox)

```bash
bun run dev
```

The same pet behavior renders in the browser — she wanders around the
page, you can grab and throw her, pet her, wake her, right-click her.
Good for iterating without a Rust toolchain. (On the real desktop, the
page is the pet window; in the preview she just walks around the tab.)

## Project layout

```
src/
  main.tsx                     — bootstrap (no router, no auth, no backend)
  pages/Companion.tsx          — the screen-pet brain: walking, grab/throw
                                 physics, sleep, bubbles, right-click menu
  components/luna/Luna.tsx     — the pixel-cat sprite (walk / sit / sleep /
                                 dangle / fly / happy poses)
  components/luna/useLunaSounds.ts — synthesized meow/purr/squeak/whee/thud
  lib/desktop.ts               — Tauri bridge (monitor bounds, window move,
                                 ghost mode, close)
src-tauri/                     — Tauri v2 desktop shell
```

### App icon

`src-tauri/icons/` is generated from Luna's own pixel art — no designer
needed. To regenerate it after tweaking her sprite:

```bash
bun run tauri:icons
```

## Keeping it featherweight

- One React screen, no router, no state library, no images — Luna is
  hand-drawn SVG rectangles and everything else is plain DOM.
- Sounds are generated, not loaded: zero network requests at runtime.
- No backend at all — the pet runs fully offline and holds onto nothing.
  The only thing she remembers is your sound preference (`localStorage`).
