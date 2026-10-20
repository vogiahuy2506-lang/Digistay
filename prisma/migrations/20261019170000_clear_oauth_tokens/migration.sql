-- Part 4e: Google is only used to sign in and the app never calls a Google
-- API, so src/lib/auth/adapter.ts stops storing OAuth tokens. This clears
-- the ones already stored. The columns stay: the NextAuth Prisma adapter's
-- schema expects them, and the previous release keeps writing them until
-- this deploy swaps it out.
UPDATE "accounts"
SET "access_token" = NULL, "refresh_token" = NULL, "id_token" = NULL
WHERE "access_token" IS NOT NULL OR "refresh_token" IS NOT NULL OR "id_token" IS NOT NULL;
