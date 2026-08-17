# Code Companion-luna

A featherweight coding companion that lives on your desktop — just a chat with
Luna, a tiny pixel cat who answers code questions and plays fetch while your
builds run. That's the whole app: no landing page, no workspace, no login
screen.

## What it is

- **One screen.** Open it and Luna is already there. Ask a question, paste an
  error, get a clean answer with copy-ready code.
- **Play while you wait.** Pat Luna, or drag the ball of yarn and she fetches
  it. The playpen pops open automatically whenever Luna is thinking.
- **Private.** Your conversation belongs to you. The app quietly signs itself
  in as a guest on first launch — the session persists per machine, so there
  is never a login form to fill out.
- **Lightweight.** The UI is a single React screen (no heavy routing, no
  dashboards). Packaged with Tauri it runs inside your OS's own webview, so
  the app itself uses almost no memory while you work.

## Tech stack

- Vite + React 19 + TypeScript
- Tailwind CSS v4 + shadcn/ui + Framer Motion
- Convex (backend + database) with Convex Auth (anonymous sessions)
- Tauri v2 (`src-tauri/`) for the desktop shell

## Running it

### As a desktop app (what it's for)

Prerequisites: [Bun](https://bun.sh), Rust (stable), and your OS's webview
dependencies (WebKitGTK on Linux).

```bash
bun install
bunx tauri dev        # run in a real desktop window
bunx tauri build      # produce the app binary
```

Notes:

- `VITE_CONVEX_URL` is read at build time — keep the same value you already
  use in this project (it's set for you in the sandbox; on your machine,
  create a `.env` with it or export it).
- The AI replies go through the project's Convex deployment, so the app needs
  internet to answer questions. Everything else — chat history, Luna, the
  playpen — works off the same backend.
- Installer icons are not committed yet. When you want to ship installers,
  put a 1024×1024 PNG at `src-tauri/icon.png` and run `bunx tauri icon`, then
  set `bundle.active` to `true` in `src-tauri/tauri.conf.json`.
- Want to swap in your own AI provider later? The model call lives in
  `src/convex/chat.ts` — one function, easy to point elsewhere.

### As a web preview (sandbox)

```bash
bun run dev
```

The `/` route is the companion itself; any other path redirects back to it.

## Project layout

```
src/
  main.tsx                     — single-route bootstrap
  pages/Companion.tsx          — the whole app (silent guest sign-in + chat)
  components/companion/        — chat, message rendering
  components/luna/             — Luna the pixel cat, and her playpen
  convex/                      — backend: messages, chat action, auth
src-tauri/                     — Tauri desktop shell
```

## Backend notes

- `src/convex/messages.ts` — one private thread per user (capped at 200
  messages so it stays featherweight). `send`, `list`, `clear`.
- `src/convex/chat.ts` — the AI action: builds recent context, calls the
  model gateway, saves Luna's reply. `src/convex/_messages.ts` holds the
  internal queries/mutations it uses.
- Auth files (`src/convex/auth.ts`, `auth.config.ts`, `auth/emailOtp.ts`,
  `src/convex/users.ts`) are managed by the platform — don't modify them.

## Environment variables

`VITE_CONVEX_URL` — the Convex deployment URL (frontend). Server-side auth
keys live in the Convex deployment's environment, not in `.env` files.
