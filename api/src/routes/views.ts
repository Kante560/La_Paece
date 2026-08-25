import { Router } from "express";
import { requireAuth } from "../auth.js";
import { isValidLocalDate, todayLocal } from "../lib/dates.js";
import { getDayView, getGridView, getWeekView } from "../services/tracker.js";

export const viewsRouter = Router();
viewsRouter.use(requireAuth);

viewsRouter.get("/today", async (req, res) => {
  const user = req.user!;
  const today = todayLocal(user.timezone, user.dayStartHour);
  const date = typeof req.query.date === "string" && isValidLocalDate(req.query.date)
    ? req.query.date
    : today;
  res.json(await getDayView(user, date, today));
});

viewsRouter.get("/week", async (req, res) => {
  const user = req.user!;
  const today = todayLocal(user.timezone, user.dayStartHour);
  const anchor = typeof req.query.date === "string" && isValidLocalDate(req.query.date)
    ? req.query.date
    : today;
  res.json(await getWeekView(user, anchor, today));
});

viewsRouter.get("/grid", async (req, res) => {
  const user = req.user!;
  const today = todayLocal(user.timezone, user.dayStartHour);
  const month = typeof req.query.month === "string" && /^\d{4}-\d{2}$/.test(req.query.month)
    ? `${req.query.month}-01`
    : today;
  res.json(await getGridView(user, month, today));
});
