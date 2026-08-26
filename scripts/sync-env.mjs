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

/*
 * On a host there is no .env file — Railway and Vercel inject the variables
 * straight into process.env — and there never will be, because .env is
 * gitignored. Exiting non-zero here failed the build before a single file was
 * compiled. Locally the file is the source of truth and its absence is a real
 * mistake, so say so; either way this script has nothing left to copy.
 */
if (!existsSync(source)) {
  const hosted = process.env.CI || process.env.RAILWAY_ENVIRONMENT || process.env.VERCEL;
  console.log(
    hosted
      ? "[env] No root .env — using the environment variables from the host."
      : "[env] No .env at the repo root. Create one before running locally.",
  );
  process.exit(0);
}

for (const target of [path.join(root, "api", ".env"), path.join(root, "web", ".env.local")]) {
  copyFileSync(source, target);
  console.log(`[env] ${path.relative(root, target)}`);
}
