# Code Companion · Luna

A featherweight desktop pet for people who spend their days waiting on
builds. Luna is a tiny pixel cat who sits on her desk under a moonlit sky —
pet her, drag her ball of yarn, feed her, and she purrs right back. That's
the whole app: no landing page, no workspace, no login, no backend.

## What it is

- **A desktop pet, not a website.** Built with [Tauri v2](https://tauri.app),
  so it runs inside your OS's own webview — a few MB on disk, near-zero idle
  CPU, and it shares the browser engine you already have instead of bundling
  a second one (that's what keeps it light while your memory is busy with
  builds and editors).
- **It floats over your desktop.** The window is frameless and transparent,
  docks to the bottom-center of your screen above the taskbar, and stays on
  top of everything — just a little card with Luna on it, like ComNyang or
  any classic desktop pet. No chrome, no taskbar entry, no squaring off
  against your editor.
- **Drag her anywhere.** Grab the title bar or the footer and move the card
  wherever you like — she'll stay there.
- **Ghost mode.** Click the ghost button (or press **Ctrl+Alt+L** anywhere)
  and Luna stops catching clicks entirely: she floats over your code without
  blocking a single click. Press Ctrl+Alt+L again to bring her back.
- **Companion only.** There is no chat, no dashboard, no accounts. She opens
  and Luna is already there.
- **Play while you wait.** Pet her (she squishes, purrs, and says something
  sweet), drag the yarn ball and she fetches it, tap her bowl to feed her.
  Leave her alone for a couple of minutes and she dozes off — click to wake
  her.
- **It remembers you.** Affection hearts build up as you play and slowly fade
  while she's away, stored locally on your machine (`localStorage`). No
  servers, nothing leaves your computer.
- **Tiny voice.** Her meows, purrs, and munching are synthesized with the Web
  Audio API — no sound files, no assets, ~1 KB of code. Mute her with the
  speaker button in the header.

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

The window opens as a small transparent card (380×440) docked at the
bottom-center of your screen, always on top of your editor — that's the
point. To change the size, position, or always-on-top behavior, edit
`src-tauri/tauri.conf.json` and the `dock_bottom_center` function in
`src-tauri/src/lib.rs`.

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
compositor, and the app falls back to interactive if the OS refuses.

### As a web preview (sandbox)

```bash
bun run dev
```

The same single screen renders in the browser — good for iterating on the
scene and Luna's behavior without a Rust toolchain.

## Project layout

```
src/
  main.tsx                     — bootstrap (no router, no auth, no backend)
  pages/Companion.tsx          — the pet window shell (header, hearts, sound)
  components/luna/Luna.tsx     — the pixel-cat sprite (idle / sleeping / eating)
  components/luna/LunaRoom.tsx — the room: sky, desk, fetch, feeding, sleep
  components/luna/useLunaSounds.ts — synthesized meow/purr/eat/chirp
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
- No backend at all: the Convex server from the earlier web prototype was
  removed, so the pet runs fully offline and holds onto nothing.
