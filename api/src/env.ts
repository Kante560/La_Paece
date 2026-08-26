import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Load .env explicitly, before anything reads process.env.
 *
 * Nothing here loaded env files on purpose — it worked only because Prisma
 * Client happens to load one when it initialises, so every other variable was
 * a side effect of module evaluation order. `JWT_SECRET` is read at the top of
 * auth.ts, and if that module evaluated before Prisma's, it silently fell back
 * to the hardcoded default. A secret that changes between boots invalidates
 * every cookie signed with the previous one, which reads to the user as being
 * randomly logged out.
 *
 * Import this first in any entrypoint.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const candidates = [
  path.resolve(here, "../.env"), // api/.env
  path.resolve(here, "../../.env"), // repo root .env
];

for (const file of candidates) {
  if (!existsSync(file)) continue;
  try {
    // Node 20.12+ / 22+. Later files must not clobber earlier ones, and
    // loadEnvFile does not overwrite variables that are already set.
    process.loadEnvFile(file);
  } catch (err) {
    console.warn(`[api] could not read ${file}:`, err);
  }
}

if (!process.env.DATABASE_URL) {
  console.error("[api] DATABASE_URL is not set — copy .env.example to .env first.");
  process.exit(1);
}

/*
 * The session cookie's SameSite/Secure pair is chosen off NODE_ENV (see
 * auth.ts). Railway does not reliably set it, and getting it wrong is invisible
 * at boot: the API answers every request happily while the browser quietly
 * refuses to store or return the cookie. An https WEB_ORIGIN means we are
 * deployed, so a non-production NODE_ENV there is almost certainly a mistake.
 */
if (process.env.WEB_ORIGIN?.startsWith("https://") && process.env.NODE_ENV !== "production") {
  console.warn(
    "[api] WEB_ORIGIN is https but NODE_ENV is not 'production'. The session\n" +
      "      cookie is then issued SameSite=Lax without Secure, which the browser\n" +
      "      will not send back cross-site — every login will look like an\n" +
      "      instant logout. Set NODE_ENV=production on the host.",
  );
}

if (!process.env.JWT_SECRET) {
  console.error(
    "[api] JWT_SECRET is not set. Refusing to start on a default secret: every\n" +
      "      restart would sign cookies differently and log you straight back out.\n" +
      "      Add a long random string to .env as JWT_SECRET.",
  );
  process.exit(1);
}
