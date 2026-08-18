/**
 * Builds the `luna` CLI and drops it where Tauri expects a sidecar.
 *
 * The cargo target is `luna-cli` but it ships as `luna`, because Windows
 * filenames are case-insensitive and the app itself is `LunaApp.exe` - two
 * binaries called some spelling of "luna" in one folder is a collision.
 *
 * The CLI has to be its own console-subsystem binary: the app itself is a
 * windowed process, and a windowed process launched from a terminal does not
 * hold the prompt - which would make `luna watch npm run build` return
 * instantly and print into nowhere.
 */

import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, existsSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const tauriDir = join(rootDir, "src-tauri");

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { stdio: "inherit", cwd: tauriDir, ...opts });

const hostTriple = () => {
  const out = execFileSync("rustc", ["-vV"], { encoding: "utf8" });
  const match = out.match(/^host:\s*(\S+)$/m);
  if (!match) throw new Error("could not read the host triple from `rustc -vV`");
  return match[1];
};

const host = hostTriple();
const target = process.env.TAURI_ENV_TARGET_TRIPLE || host;
const debug = process.env.TAURI_ENV_DEBUG === "true";

const exe = target.includes("windows") ? ".exe" : "";
const outDir = join(tauriDir, "binaries");
const dest = join(outDir, `luna-${target}${exe}`);

// tauri-build refuses to build *anything* in this package while a declared
// sidecar is missing - including the sidecar itself. A placeholder breaks the
// bootstrap loop on a fresh checkout; it is either overwritten below or
// removed again, so a failed build never leaves an empty binary behind.
mkdirSync(outDir, { recursive: true });
const placeholder = !existsSync(dest);
if (placeholder) writeFileSync(dest, "");

const args = ["build", "--bin", "luna-cli"];
if (!debug) args.push("--release");
if (target !== host) args.push("--target", target);

console.log(`luna: building CLI for ${target}${debug ? " (debug)" : ""}`);
try {
  run("cargo", args);
} catch (err) {
  if (placeholder) rmSync(dest, { force: true });
  throw err;
}

const profile = debug ? "debug" : "release";
const built = join(tauriDir, "target", target === host ? "" : target, profile, `luna-cli${exe}`);

if (!existsSync(built)) {
  if (placeholder) rmSync(dest, { force: true });
  throw new Error(`luna: expected the CLI at ${built}`);
}

copyFileSync(built, dest);
console.log(`luna: CLI ready at ${dest}`);
