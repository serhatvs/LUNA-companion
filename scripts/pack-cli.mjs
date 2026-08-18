/**
 * Builds the `luna` CLI and drops it where Tauri expects a sidecar.
 *
 * The CLI has to be its own console-subsystem binary: the app itself is a
 * windowed process, and a windowed process launched from a terminal does not
 * hold the prompt - which would make `luna watch bun run build` return
 * instantly and print into nowhere.
 */

import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
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

const args = ["build", "--bin", "luna"];
if (!debug) args.push("--release");
if (target !== host) args.push("--target", target);

console.log(`luna: building CLI for ${target}${debug ? " (debug)" : ""}`);
run("cargo", args);

const exe = target.includes("windows") ? ".exe" : "";
const profile = debug ? "debug" : "release";
const built = join(tauriDir, "target", target === host ? "" : target, profile, `luna${exe}`);

if (!existsSync(built)) {
  throw new Error(`luna: expected the CLI at ${built}`);
}

const outDir = join(tauriDir, "binaries");
mkdirSync(outDir, { recursive: true });
const dest = join(outDir, `luna-${target}${exe}`);
copyFileSync(built, dest);
console.log(`luna: CLI ready at ${dest}`);
