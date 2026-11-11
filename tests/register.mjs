// Lets `node --test` load lib/*.ts files that use extensionless imports (as Next.js does).
import { register } from "node:module";

register(
  "data:text/javascript," +
    encodeURIComponent(`
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (err) {
    // A directory import ("../comment" next to lib/comment/) means the sibling file comment.ts, as a bundler resolves it.
    if ((err?.code === "ERR_MODULE_NOT_FOUND" || err?.code === "ERR_UNSUPPORTED_DIR_IMPORT") && specifier.startsWith(".") && !/\\.[cm]?[jt]s$/.test(specifier)) {
      return next(specifier + ".ts", context);
    }
    throw err;
  }
}`),
);
