/** Build the extension using the project's existing TypeScript compiler. */
import ts from "typescript";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = dirname(fileURLToPath(import.meta.url));
const out = join(root, "dist");
mkdirSync(out, { recursive: true });
for (const name of ["background", "sidepanel", "insert", "api"]) {
  const source = readFileSync(join(root, "src", `${name}.ts`), "utf8");
  const result = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020 }, reportDiagnostics: true });
  const errors = result.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error) ?? [];
  if (errors.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(errors, { getCurrentDirectory: () => root, getCanonicalFileName: x => x, getNewLine: () => "\n" }));
  writeFileSync(join(out, `${name}.js`), result.outputText);
}
for (const name of ["manifest.json", "sidepanel.html"]) copyFileSync(join(root, name), join(out, name));
// Tester builds: LYNKR_EXT_EXTRA_ORIGINS="https://lynkr-preview.onrender.com" lets the extension talk to, and be paired from, a preview.
// Only https origins are accepted. The committed manifest stays as it is, so a store build never carries a preview address.
const extra = (process.env.LYNKR_EXT_EXTRA_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean).map((s) => {
  let u;
  try { u = new URL(s); } catch { throw new Error("LYNKR_EXT_EXTRA_ORIGINS: not a URL: " + s); }
  if (u.protocol !== "https:" || u.pathname !== "/" || u.search || u.hash) throw new Error("LYNKR_EXT_EXTRA_ORIGINS: use a bare https origin, got " + s);
  return u.origin + "/*";
});
if (extra.length) {
  const path = join(out, "manifest.json");
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  manifest.host_permissions = [...new Set([...manifest.host_permissions, ...extra])];
  manifest.externally_connectable.matches = [...new Set([...manifest.externally_connectable.matches, ...extra])];
  writeFileSync(path, JSON.stringify(manifest, null, 2) + "\n");
  console.log("Added origins for this build:", extra.join(", "));
}
console.log("Extension built to extension/dist");
