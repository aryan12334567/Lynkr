/**
 * Zip extension/dist for testers: `npm run ext:build && npm run ext:zip`. Testers unzip it, open chrome://extensions,
 * switch on Developer mode and choose "Load unpacked". It is not a Chrome Web Store upload.
 * For a preview build set LYNKR_EXT_EXTRA_ORIGINS when building (see build.mjs). No dependency: system tar or zip.
 */
import { existsSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, "dist");
const out = join(root, "lynkr-extension-tester.zip");
if (!existsSync(join(dist, "manifest.json"))) throw new Error("Run npm run ext:build first: extension/dist/manifest.json is missing.");
const files = readdirSync(dist).filter((f) => !f.startsWith("."));
if (existsSync(out)) rmSync(out);
// Files are listed by name so manifest.json sits at the top of the archive, which is what Chrome expects.
// On Windows the system tar.exe (bsdtar) is called by full path: a Git Bash tar earlier on PATH reads "C:" as a remote host and cannot write zip.
const tar = process.platform === "win32" ? join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe") : "tar";
const [cmd, args] = process.platform === "linux" ? ["zip", ["-q", out, ...files]] : [tar, ["-a", "-c", "-f", out, ...files]];
const r = spawnSync(cmd, args, { cwd: dist });
if (r.error || r.status !== 0) throw new Error(`Could not zip with ${cmd}: ${r.error?.message ?? r.stderr?.toString()}`);
console.log(`Wrote ${out} (${files.length} files)`);
