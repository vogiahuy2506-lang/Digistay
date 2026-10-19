-- Added in afbb04e (auth flow: login by username) without a migration.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
