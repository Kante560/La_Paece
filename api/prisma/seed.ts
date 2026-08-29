import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { todayLocal, toDbDate } from "../src/lib/dates.js";
import { STARTER_HABITS } from "../src/domain/starterHabits.js";

const prisma = new PrismaClient();

/**
 * A development convenience, not the way accounts are made any more — anyone
 * can sign up, and first-run setup offers this same catalogue. It reads from
 * the shared list so the two can never drift apart.
 */
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
      timezone: process.env.APP_TIMEZONE || "Africa/Lagos",
      onboardedAt: new Date(),
    },
    update: { passwordHash, onboardedAt: new Date() },
  });
  console.log(`user: ${user.email}`);

  const existing = await prisma.habit.count({ where: { userId: user.id } });
  if (existing > 0) {
    console.log(`habits: ${existing} already present, skipping`);
    return;
  }

  const activeFrom = toDbDate(todayLocal(user.timezone, user.dayStartHour));
  await prisma.habit.createMany({
    data: STARTER_HABITS.map((h, i) => ({
      userId: user.id,
      name: h.name,
      category: h.category,
      type: h.type,
      target: h.target ?? null,
      unit: h.unit ?? null,
      scheduleDays: [...h.scheduleDays],
      resolveWindow: h.resolveWindow ?? "SAME_DAY",
      sortOrder: i,
      activeFrom,
    })),
  });
  console.log(`habits: ${STARTER_HABITS.length} created`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
