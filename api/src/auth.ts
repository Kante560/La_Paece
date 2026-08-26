import type { CookieOptions, NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "./db.js";

const COOKIE = "pt_session";
// env.ts refuses to boot without this, so there's no default to drift back to.
const SECRET = process.env.JWT_SECRET as string;
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

export interface AuthedUser {
  id: string;
  email: string;
  timezone: string;
  dayStartHour: number;
  nonNegotiableWeight: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}

/*
 * In production the web app and this API sit on different domains (Vercel and
 * Railway), which makes every API call a cross-site request. A SameSite=Lax
 * cookie is simply not sent on those: the browser accepts it at login and then
 * withholds it on everything after, so the very next call 401s and the client
 * bounces you back to /login. It reads as "logging in logs me out". None is the
 * only value that survives the trip, and browsers only honour None together
 * with Secure — hence the pair moving as one.
 *
 * Locally both sides are localhost, so Lax is correct and Secure would break
 * plain http. env.ts warns if NODE_ENV leaves this on the wrong branch.
 */
const CROSS_SITE = process.env.NODE_ENV === "production";

/*
 * Shared by issue and clear on purpose. A cookie is only cleared when the
 * attributes match the ones it was set with, so a clearCookie that forgets
 * sameSite/secure silently leaves the session in place and logout does nothing.
 */
const cookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: CROSS_SITE ? "none" : "lax",
  secure: CROSS_SITE,
  path: "/",
};

export function issueSession(res: Response, userId: string): void {
  const token = jwt.sign({ sub: userId }, SECRET, { expiresIn: "30d" });
  res.cookie(COOKIE, token, { ...cookieOptions, maxAge: THIRTY_DAYS });
}

export function clearSession(res: Response): void {
  res.clearCookie(COOKIE, cookieOptions);
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.[COOKIE];
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  // Verify the token first, and *only* treat token problems as auth failures.
  let payload: { sub: string };
  try {
    payload = jwt.verify(token, SECRET) as { sub: string };
  } catch {
    res.status(401).json({ error: "Session expired" });
    return;
  }

  /*
   * Everything below is infrastructure. A database that's slow or briefly
   * unreachable is not an expired session — answering 401 here is what made
   * the app throw you back to the login screen at random, because the client
   * treats any 401 as "your session is gone". Let it surface as a 5xx so the
   * client can retry against a session that is still perfectly valid.
   */
  try {
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    req.user = {
      id: user.id,
      email: user.email,
      timezone: user.timezone,
      dayStartHour: user.dayStartHour,
      nonNegotiableWeight: user.nonNegotiableWeight,
    };
    next();
  } catch (err) {
    next(err);
  }
}
