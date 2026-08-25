import type { NextFunction, Request, Response } from "express";
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

export function issueSession(res: Response, userId: string): void {
  const token = jwt.sign({ sub: userId }, SECRET, { expiresIn: "30d" });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: THIRTY_DAYS,
    path: "/",
  });
}

export function clearSession(res: Response): void {
  res.clearCookie(COOKIE, { path: "/" });
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
