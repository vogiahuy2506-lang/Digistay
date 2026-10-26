-- Official codes of a property's province and ward (src/lib/vn-admin), set
-- by the address pickers. Nullable: rows saved before keep their names only.
ALTER TABLE "properties" ADD COLUMN "provinceCode" TEXT,
ADD COLUMN "wardCode" TEXT;
