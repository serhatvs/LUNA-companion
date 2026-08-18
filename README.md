# Code Companion · Luna

A featherweight desktop pet for people who spend their days waiting on
builds. Luna is a tiny pixel cat who sits on her desk under a moonlit sky —
pet her, drag her ball of yarn, feed her, and she purrs right back. That's
the whole app: no landing page, no workspace, no login, no backend.

## What it is

- **A desktop app, not a website.** Built with [Tauri v2](https://tauri.app),
  so it runs inside your OS's own webview — a few MB on disk, near-zero idle
  CPU, and it shares the browser engine you already have instead of bundling
  a second one (that's what keeps it light while your memory is busy with
  builds and editors).
- **Companion only.** There is no chat, no dashboard, no accounts. The window
  opens and Luna is already there.
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

The window opens small (420×660) and stays on top of your editor — that's
the point. To change the size or turn off always-on-top, edit
`src-tauri/tauri.conf.json`.

> Packaging note: installer icons aren't committed yet. When you want to ship
> installers, drop a 1024×1024 PNG at `src-tauri/icons/icon.png`, run
> `bunx tauri icon`, and set `bundle.active` to `true` in
> `src-tauri/tauri.conf.json`.

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

## Keeping it featherweight

- One React screen, no router, no state library, no images — Luna is
  hand-drawn SVG rectangles and everything else is plain DOM.
- Sounds are generated, not loaded: zero network requests at runtime.
- The `src/convex/` folder from the earlier prototype is still in the repo
  but is **not imported anywhere** — the desktop pet runs fully offline.
  Delete it whenever you're ready.
