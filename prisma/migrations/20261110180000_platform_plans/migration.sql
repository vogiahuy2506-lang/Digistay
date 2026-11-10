-- CreateTable
CREATE TABLE "platform_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "properties" INTEGER NOT NULL,
    "rooms" INTEGER NOT NULL,
    "staff" INTEGER NOT NULL,
    "invoices" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_plans_pkey" PRIMARY KEY ("id")
);

-- Seed default plans
INSERT INTO "platform_plans" ("id", "name", "price", "properties", "rooms", "staff", "invoices", "isActive", "updatedAt", "createdAt")
VALUES
  ('starter', 'Starter', 199000, 1, 15, 3, 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('growth', 'Growth', 399000, 3, 60, 10, 100, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('business', 'Business', 799000, 10, 300, 30, 500, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

