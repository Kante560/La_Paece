import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { todayLocal, toDbDate } from "../src/lib/dates.js";

const prisma = new PrismaClient();

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [1, 2, 3, 4, 5];

/** Seeded straight from the reference page. Edit freely in the Habits screen. */
const HABITS = [
  { name: "Wake up before 6am", category: "NON_NEGOTIABLE", type: "BINARY", resolveWindow: "NEXT_MORNING", scheduleDays: EVERY_DAY },
  { name: "Cold shower", category: "NON_NEGOTIABLE", type: "BINARY", scheduleDays: EVERY_DAY },
  { name: "No phone until 11am", category: "NON_NEGOTIABLE", type: "BINARY", scheduleDays: EVERY_DAY },
  { name: "Workout", category: "NON_NEGOTIABLE", type: "BINARY", scheduleDays: [1, 2, 3, 5, 6] },
  { name: "Read", category: "NON_NEGOTIABLE", type: "QUANTITY", target: 20, unit: "pages", scheduleDays: EVERY_DAY },
  { name: "Meditate", category: "NON_NEGOTIABLE", type: "QUANTITY", target: 10, unit: "min", scheduleDays: EVERY_DAY },
  { name: "Eat clean", category: "NON_NEGOTIABLE", type: "BINARY", scheduleDays: EVERY_DAY },
  { name: "Water", category: "NON_NEGOTIABLE", type: "QUANTITY", target: 3, unit: "L", scheduleDays: EVERY_DAY },
  { name: "No alcohol", category: "NON_NEGOTIABLE", type: "BINARY", scheduleDays: EVERY_DAY },
  { name: "Sleep by 10:30pm", category: "NON_NEGOTIABLE", type: "BINARY", resolveWindow: "NEXT_MORNING", scheduleDays: EVERY_DAY },
  { name: "Journaling", category: "OTHER", type: "BINARY", scheduleDays: EVERY_DAY },
  { name: "Deep work", category: "OTHER", type: "QUANTITY", target: 90, unit: "min", scheduleDays: WEEKDAYS },
  { name: "Learn something", category: "OTHER", type: "BINARY", scheduleDays: EVERY_DAY },
  { name: "Steps", category: "OTHER", type: "QUANTITY", target: 10000, unit: "steps", scheduleDays: EVERY_DAY },
  { name: "Stretch", category: "OTHER", type: "BINARY", scheduleDays: EVERY_DAY },
] as const;

async function main() {
  const email = (process.env.APP_EMAIL || "you@example.com").toLowerCase();
  const password = process.env.APP_PASSWORD;
  if (!password) throw new Error("Set APP_PASSWORD in .env before seeding.");

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      timezone: process.env.APP_TIMEZONE || "America/Los_Angeles",
    },
    update: { passwordHash },
  });
  console.log(`user: ${user.email}`);

  const existing = await prisma.habit.count({ where: { userId: user.id } });
  if (existing > 0) {
    console.log(`habits: ${existing} already present, skipping`);
    return;
  }

  const activeFrom = toDbDate(todayLocal(user.timezone, user.dayStartHour));
  await prisma.habit.createMany({
    data: HABITS.map((h, i) => ({
      userId: user.id,
      name: h.name,
      category: h.category,
      type: h.type,
      target: "target" in h ? h.target : null,
      unit: "unit" in h ? h.unit : null,
      scheduleDays: [...h.scheduleDays],
      resolveWindow: "resolveWindow" in h ? h.resolveWindow : "SAME_DAY",
      sortOrder: i,
      activeFrom,
    })),
  });
  console.log(`habits: ${HABITS.length} created`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
