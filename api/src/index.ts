// Must come first: everything below reads process.env at module scope.
import "./env.js";

import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { prisma } from "./db.js";
import { startRolloverJob } from "./jobs/rollover.js";
import { catchAsync } from "./lib/asyncRoutes.js";
import { authRouter } from "./routes/auth.js";
import { daysRouter } from "./routes/days.js";
import { entriesRouter } from "./routes/entries.js";
import { habitsRouter } from "./routes/habits.js";
import { todosRouter } from "./routes/todos.js";
import { viewsRouter } from "./routes/views.js";
import { weekRouter } from "./routes/week.js";

const app = express();
const PORT = Number(process.env.PORT || 4000);
const WEB_ORIGIN = process.env.WEB_ORIGIN || "http://localhost:3000";

app.use(cors({ origin: WEB_ORIGIN.split(",").map((s) => s.trim()), credentials: true }));
app.use(express.json({ limit: "256kb" }));
app.use(cookieParser());

app.get("/health", (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// catchAsync wraps each router's handlers so a rejected await becomes a 500
// through the error middleware below, instead of an unhandled rejection that
// takes the process down.
app.use("/auth", catchAsync(authRouter));
app.use("/habits", catchAsync(habitsRouter));
app.use("/entries", catchAsync(entriesRouter));
app.use("/days", catchAsync(daysRouter));
app.use("/todos", catchAsync(todosRouter));
app.use("/week", catchAsync(weekRouter));
app.use("/views", catchAsync(viewsRouter));

app.use((_req, res) => res.status(404).json({ error: "Not found" }));

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[api]", err);
  res.status(500).json({ error: "Something went wrong" });
});

/*
 * Last line of defence. Node exits on an unhandled rejection by default, so
 * anything that slips past catchAsync — a background job, a stray floating
 * promise — would otherwise end the process. A tracker that silently stops
 * answering is worse than one that logs and carries on.
 */
process.on("unhandledRejection", (reason) => {
  console.error("[api] unhandled rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[api] uncaught exception:", err);
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}  (CORS: ${WEB_ORIGIN})`);

  /*
   * Open the pool now rather than on the first request. Railway's public proxy
   * needs several seconds for a cold connection, and paying that on someone's
   * first tap looks like the app is broken.
   */
  const t = Date.now();
  prisma
    .$connect()
    .then(() => console.log(`[api] database connected in ${Date.now() - t}ms`))
    .catch((err) => console.error("[api] initial database connect failed:", err.message));

  startRolloverJob();
});
