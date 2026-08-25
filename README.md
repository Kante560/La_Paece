# Discipline — behavioural & progress tracker

A paper-inspired, mobile-first PWA for tracking daily habits, weekly targets, and
the behavioural data behind both.

**Stack:** Next.js 15 (PWA) · Express + Node · Postgres + Prisma · TypeScript
**Deploy target:** Railway (all four services in one project, private networking)

---

## Run it

```bash
cp .env.example .env          # set APP_EMAIL, APP_PASSWORD, DATABASE_URL
npm install
npm run db:migrate            # creates the schema
npm run db:seed               # creates your user + the starter habits
npm run dev                   # api :4000, web :3000
```

Need a database first:

```bash
docker run -d --name pt-db -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=progress_tracker -p 5432:5432 postgres:16
```

Then open `http://localhost:3000` and log in with `APP_EMAIL` / `APP_PASSWORD`.

**On your phone:** run `next dev -H 0.0.0.0`, set `NEXT_PUBLIC_API_URL` and
`WEB_ORIGIN` to your machine's LAN IP, and open it in Safari/Chrome.
iOS only delivers PWA push notifications once the app is added to the home
screen — so "Add to Home Screen" is a required step, not a nicety.

---

## Screens

| Route | What it is |
|---|---|
| `/` | Today. Intention, three todos, habit checkoff, evening close-out. |
| `/week` | The weekly commitment and live pace. |
| `/grid` | The month matrix from the notebook page. |
| `/habits` | Manage habits, targets, and which weekdays each is scheduled. |
| `/settings` | Theme, day boundary, non-negotiable weight, timezone. |

---

## The decisions worth knowing

These are the places where the obvious implementation is wrong.

**The day ends at 4am, not midnight.** If you log at 12:40am you mean
*yesterday*. `dayStartHour` is configurable per user. This is the single most
common source of bugs in trackers.

**Entries store a number, not a boolean.** `1`/`0` for binary habits, the actual
amount for quantity habits. Partial credit is proportional and capped at 100% —
drinking 4.2L of a 3L target is not a 140% day.

**The daily % is weighted.** Non-negotiables count `nonNegotiableWeight`× (default
2×) a normal habit. At 1× the headline number lets "stretch" paper over a missed
workout, which makes the number meaningless.

**There are two numbers, not one.** Today's % and month-to-date average. The
reference page's single ambiguous 67% is a design flaw.

**Unscheduled ≠ missed.** A rest day renders as `–` and is excluded from the
denominator. So are days before a habit was created. Habits are archived, never
deleted, so history is never silently rewritten.

**Streaks forgive one miss, break on two.** Hard-reset streaks are the biggest
cause of tracker abandonment — one bad day invalidates months and people quit
rather than restart at zero. An unresolved today is never counted as a miss.

**Backfill is allowed but marked.** Today and yesterday are freely editable.
Anything older needs an explicit confirmation and carries a dot, so the grid
never quietly becomes fiction.

**Three todos. Hard cap.** A list of twelve is a wish, not a plan. Unfinished
ones roll forward with a counter; 3+ days is a signal the task was never a
one-day job.

**Weekly targets anchor to your trailing average and warn on big jumps.** The
goal field is pre-filled from your 4-week baseline +3.5 points. Setting anything
more than +10 requires acknowledging a warning — leaping 51% → 90% is exactly how
week one fails and the app gets deleted.

**Rebaselining down is a first-class action.** A target that only ratchets upward
eventually guarantees failure. When a target becomes mathematically unreachable
the app says so on Thursday and offers a still-achievable number, rather than
letting the week limp silently to Sunday.

**Why you missed is captured.** Energy 1–5, mood 1–5, and a one-tap reason on any
missed non-negotiable. This is ~10 seconds a day and it's the only data a
checkbox can't give you. Insights are out of scope for v1 — but you cannot
retroactively generate data you never collected.

**Night mode is a designed theme, not an inversion.** You close out the day in a
dark room at 10:30pm; a full-brightness cream page there is hostile.

---

## Layout

```
api/
  prisma/schema.prisma     data model
  prisma/seed.ts           your user + starter habits
  src/domain/              pure logic — progress, streaks, weekly pace
  src/domain/domain.test.ts  17 tests, no DB required
  src/services/tracker.ts  Prisma -> domain
  src/routes/              habits · entries · days · todos · week · views · auth
  src/jobs/rollover.ts     hourly todo carry-forward
  src/lib/dates.ts         timezone + day-boundary helpers
web/
  app/                     the five screens
  components/              Check · Ring · Nav · HabitRow
  lib/                     api client, types, autosave hook
  public/                  manifest, service worker, icons
```

`npm test` runs the domain suite — the progress, streak, and pace math all
verify without a database.

---

## Next, in rough order of value

1. **Push notifications** at your two ritual times (6:00am / 9:30pm). Needs VAPID
   keys, a push handler in `sw.js`, and home-screen install on iOS.
2. **Insights.** You'll have the data. Correlations between energy/mood and habit
   completion, miss-reason frequency, best and worst weekdays.
3. **Export.** JSON dump endpoint. Do this before you care about it.
4. **Auto-logging.** Steps and sleep would remove the two highest-friction manual
   entries. Note: a PWA cannot read Apple Health — that path needs native.
