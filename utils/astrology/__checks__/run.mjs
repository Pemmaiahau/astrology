/**
 * Dev-only TypeScript runner for the files in this directory.
 *
 * The checks are plain `.ts` with `@/…` path aliases, which bare `node` cannot
 * resolve. `jiti` can, and it is already present in `node_modules` as a Next.js
 * transitive dependency — so this adds no package to `package.json` and works
 * offline, unlike `npx tsx`.
 *
 *   node utils/astrology/__checks__/run.mjs verify
 *   node utils/astrology/__checks__/run.mjs golden
 *   node utils/astrology/__checks__/run.mjs golden --write
 *
 * Any argument that is not a known shorthand is treated as a path to a `.ts`
 * file, so one-off scripts in this directory run the same way. Arguments after
 * the target are forwarded to the script on `process.argv`.
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");

const SHORTHANDS = {
  verify: path.join(here, "verify.ts"),
  golden: path.join(here, "golden.ts"),
  rectify: path.join(here, "rectifyDemo.ts"),
  lifeEvents: path.join(here, "lifeEventsDemo.ts"),
  adult: path.join(here, "adultSectionsDemo.ts"),
};

const [target, ...rest] = process.argv.slice(2);
if (!target) {
  console.error(`Usage: node ${path.relative(repoRoot, fileURLToPath(import.meta.url))} <${Object.keys(SHORTHANDS).join("|")}|path/to/file.ts> [args…]`);
  process.exit(2);
}

const entry = SHORTHANDS[target] ?? path.resolve(repoRoot, target);

// The script reads its own flags off argv; keep argv[0]/argv[1] shaped like a
// normal node invocation so `process.argv.slice(2)` means the same thing there.
process.argv = [process.argv[0], entry, ...rest];

const jiti = createJiti(import.meta.url, {
  alias: { "@": repoRoot },
  interopDefault: true,
});

await jiti.import(entry);
