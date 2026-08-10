/**
 * Copies the Deno edge functions into the Railway Node service.
 *
 * The bot logic itself stays 100% identical — only the Deno-specific header
 * (std/http `serve`, supabase-js client) is swapped for the Node/Postgres shim.
 *
 * Run from the project root:  node railway/scripts/sync-from-supabase.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), "../..");

const FUNCTIONS = [
  ["supabase/functions/telegram-webhook/index.ts", "railway/src/generated/telegram-webhook.ts"],
  ["supabase/functions/process-scheduled-posts/index.ts", "railway/src/generated/process-scheduled-posts.ts"],
  ["supabase/functions/process-auto-deletes/index.ts", "railway/src/generated/process-auto-deletes.ts"],
  ["supabase/functions/daily-summary/index.ts", "railway/src/generated/daily-summary.ts"],
];

const HEADER = `// AUTO-GENERATED from the Supabase edge function. Do not edit directly.
// Regenerate with: node railway/scripts/sync-from-supabase.mjs
import { supabase } from "../db.js";

let _handler: (req: Request) => Promise<Response>;
function serve(fn: (req: Request) => Promise<Response>) { _handler = fn; }
export function getHandler() { return _handler; }
export async function invoke(req?: Request) {
  return _handler(req ?? new Request("http://localhost/internal", { method: "POST" }));
}

`;

for (const [src, dest] of FUNCTIONS) {
  let code = readFileSync(resolve(ROOT, src), "utf8");

  // strip Deno-only imports
  code = code.replace(/^import .*deno\.land.*$\n?/gm, "");
  code = code.replace(/^import .*esm\.sh\/@supabase.*$\n?/gm, "");
  // strip the supabase client construction (single or multi-line)
  code = code.replace(/const supabase = createClient\([\s\S]*?\);\n/, "");
  // Deno.env -> process.env
  code = code.replace(/Deno\.env\.get\(/g, "process.env_get(");
  code = code.replace(/process\.env_get\(([^)]*)\)!?/g, "(process.env[$1] as string)");

  mkdirSync(dirname(resolve(ROOT, dest)), { recursive: true });
  writeFileSync(resolve(ROOT, dest), HEADER + code.trimStart() + "\n");
  console.log(`generated ${dest}`);
}
