import { copyFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Fan the root .env out to the workspaces that need their own copy.
 *
 * npm workspaces don't share env files, and two of our tools only look beside
 * their own package: the Prisma CLI reads .env from its cwd (api/), and Next
 * only picks up .env.local under web/. Keeping one authored file at the root
 * and copying it here means there's a single place to edit a secret, instead
 * of three that drift apart until something fails for a non-obvious reason.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, ".env");

if (!existsSync(source)) {
  console.error("[env] No .env at the repo root. Copy .env.example to .env first.");
  process.exit(1);
}

for (const target of [path.join(root, "api", ".env"), path.join(root, "web", ".env.local")]) {
  copyFileSync(source, target);
  console.log(`[env] ${path.relative(root, target)}`);
}
