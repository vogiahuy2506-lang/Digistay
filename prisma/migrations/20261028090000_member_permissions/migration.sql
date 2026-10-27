-- Member permissions like UKNOW's (src/lib/auth/permissions.ts): a role is a
-- preset, an admin may tick a member's own set, limit them to some
-- properties and lock them. New columns have defaults that keep everyone's
-- access as it was (their role's preset, every property, not locked), so
-- the previous release runs on it.

-- AlterEnum
ALTER TYPE "InvitationStatus" ADD VALUE 'REVOKED';

-- AlterTable
ALTER TABLE "workspace_members" ADD COLUMN     "allProperties" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "customPermissions" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "disabledAt" TIMESTAMP(3),
ADD COLUMN     "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "invitations" ADD COLUMN     "allProperties" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "customPermissions" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "propertyIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "member_properties" (
    "memberId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,

    CONSTRAINT "member_properties_pkey" PRIMARY KEY ("memberId","propertyId")
);

-- CreateIndex
CREATE INDEX "member_properties_propertyId_idx" ON "member_properties"("propertyId");

-- AddForeignKey
ALTER TABLE "member_properties" ADD CONSTRAINT "member_properties_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "workspace_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_properties" ADD CONSTRAINT "member_properties_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
