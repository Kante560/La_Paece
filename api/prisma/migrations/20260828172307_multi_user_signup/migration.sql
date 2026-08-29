-- Multi-user signup: mark when an account has finished first-run setup.
-- Nullable and additive, so existing rows are untouched; accounts that predate
-- this column are treated as set up when they already have habits (see
-- GET /auth/me), and are never dragged back through the picker.
ALTER TABLE "User" ADD COLUMN "onboardedAt" TIMESTAMP(3);
