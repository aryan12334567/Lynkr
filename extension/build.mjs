/** Build the extension using the project's existing TypeScript compiler. */
import ts from "typescript";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = dirname(fileURLToPath(import.meta.url));
const out = join(root, "dist");
mkdirSync(out, { recursive: true });
for (const name of ["background", "sidepanel", "insert"]) {
  const source = readFileSync(join(root, "src", `${name}.ts`), "utf8");
  const result = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020 }, reportDiagnostics: true });
  const errors = result.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error) ?? [];
  if (errors.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(errors, { getCurrentDirectory: () => root, getCanonicalFileName: x => x, getNewLine: () => "\n" }));
  writeFileSync(join(out, `${name}.js`), result.outputText);
}
for (const name of ["manifest.json", "sidepanel.html"]) copyFileSync(join(root, name), join(out, name));
console.log("Extension built to extension/dist");
