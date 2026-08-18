# Luna

A featherweight desktop cat who waits for your builds.

Luna is not a web app in a window. She is a tiny pixel cat who lives *on* your
desktop — above your editor, walking across your monitors, sleeping when you
ignore her, and, when you point the `luna` CLI at a build, sitting very still
until it finishes and then either dancing or sulking.

No chat, no dashboard, no login, no backend, no account. One window, one tray
icon, one small JSON file with her mood in it.

```
luna watch "npm run build"
```

---

## What she does

**She waits with you.** `luna watch <command>` runs your command exactly as your
shell would — same output, same exit code — and tells Luna about it. She sits up
with her ears forward, wears a live timer above her head (`42s / ~1m 10s`, once
she has seen that command before), then either does a victory hop with the build
time, or slumps with the first real-looking error line from the output.

**She has a life.** Energy, hunger, boredom and a craving for attention all move
in real time and shape what she does next. Ignore her for an afternoon and she
follows your cursor around; leave her alone entirely and she naps and gets
hungry. Pet her, feed her, play with her, and she grows a bond stat and levels
up. All of it survives a restart, including the hours she spent alone while the
app was closed.

**She is a real screen pet.** She turns side-on and walks on four legs when
she is going somewhere, and faces you when she sits. Grab her and throw her — she has weight, bounces,
squashes on landing, and grabs the edge of your screen on the way past. She
climbs the side of a monitor, dangles from the top, wanders between displays,
chases a laser dot when you double-click her, grooms, stretches after a nap, and
flicks her tail while she waits.

**She knows when to disappear.** Ghost mode makes her click-through and faint.
Auto-ghost does it for you whenever a fullscreen app takes over (games,
presentations). Quiet hours put her to bed and shut her up. She can start with
your computer, and she never steals focus from your editor when you pet her.

## Controls

| Action | What happens |
| --- | --- |
| Move the cursor back and forth over her | pets her — hearts, purring, a happier cat |
| Click and drag | picks her up; let go to throw |
| Double-click | laser pointer |
| Right-click | her settings card |
| Tray icon | summon, ghost mode, nap, settings, quit |

## The CLI

The `luna` binary is installed next to the app.

```
luna watch <command...>   run a command; Luna waits, then cheers or sulks
luna say <text>           make her say something
luna ghost [on|off]       click-through mode
luna summon               bring her to your cursor
luna sleep                tell her to take a nap
luna status               print how she's doing
```

Put it on your PATH and it becomes a prefix you can leave in front of anything
slow:

```bash
luna watch cargo test
luna watch "bun run build"
luna say "back in 10"
```

It talks to the running app over loopback with a token that is rewritten every
launch, so nothing else on the machine can drive your cat.

## Why it is small

- **No framework.** No React, no Tailwind, no UI kit — the whole frontend is a
  few kilobytes of plain TypeScript.
- **One image.** All eleven poses live in a single 240 KB PNG, packed by
  `scripts/extract-sprites.py` from the hand-drawn sheet. Other coats are not
  extra artwork: her fur has no hue to rotate, so a tint remaps brightness
  through a colour ramp at runtime and leaves her eyes, ears and nose alone.
- **Almost nothing repaints.** Her window is one transparent sheet across all
  your monitors, but only her own small box is ever drawn into, and moving her
  is a compositor transform rather than a repaint.
- **The heavy lifting is Rust.** Hit testing, click-through, the tray, the
  overlay and the CLI channel are all native; the webview just draws a cat.

## Building

You need [Node 18+](https://nodejs.org) and a
[Rust toolchain](https://rustup.rs), plus the usual Tauri prerequisites for
your platform (MSVC build tools on Windows, Xcode CLI tools on macOS,
`libwebkit2gtk-4.1-dev` and friends on Linux).

```bash
npm install
npm run tauri dev      # run her
npm run tauri build    # installers in src-tauri/target/release/bundle
```

`npm run cli:pack` builds the `luna` CLI as a sidecar; the dev and build
commands already do this for you.

Installers for Windows, macOS (Intel and Apple silicon) and Linux are built by
GitHub Actions on every push to `main` — grab them from the run's artifacts, or
tag `v*` to cut a release.

## Where she keeps her things

| | |
| --- | --- |
| Windows | `%APPDATA%\com.luna.companion` |
| macOS | `~/Library/Application Support/com.luna.companion` |
| Linux | `~/.local/share/com.luna.companion` |

`luna.json` is her settings, stats and build memory. `diary.jsonl` is one line
per build she has watched. Delete either and she starts fresh.

## Next

Real AI chat (an API key and she can read a failing test back to you in her own
words), machine awareness (CPU, git status, lock/unlock), outfits and
achievements, a Pomodoro she runs on her own head, TTS, and a shareable
`luna.toml` so a teammate can clone your exact cat.
