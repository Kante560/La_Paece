/**
 * Form rules shared by the sign-in and sign-up screens.
 *
 * These mirror the API's schemas rather than replace them — the server is still
 * the only thing that decides. What they buy is telling someone their password
 * is too short before they wait on a round trip to hear it.
 */

/** Mirrors MIN_PASSWORD in api/src/routes/auth.ts. */
export const MIN_PASSWORD = 8;

/*
 * Deliberately permissive. The full grammar for an address allows more than
 * anyone expects, and every clever regex that tries to enforce it ends up
 * rejecting somebody's real email. This catches the actual mistakes — a missing
 * @, a trailing space, no dot in the domain — and leaves the rest to the server
 * and, ultimately, to whether mail arrives.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailError(value: string): string | null {
  if (!value.trim()) return "Email is required";
  if (!EMAIL.test(value.trim())) return "That doesn't look like an email address";
  return null;
}

export function newPasswordError(value: string): string | null {
  if (!value) return "Password is required";
  if (value.length < MIN_PASSWORD) {
    const short = MIN_PASSWORD - value.length;
    return `${short} more character${short === 1 ? "" : "s"} to go`;
  }
  return null;
}

/** Sign-in only checks presence: an old password may predate any current rule. */
export function currentPasswordError(value: string): string | null {
  return value ? null : "Password is required";
}
