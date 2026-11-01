-- Marketing, conversion & Mini CRM (tasks 41-50): coupons, leads, blog,
-- customer profiles, reviews; coupon + automation markers on bookings;
-- pixel/tag + exit-intent config on website settings.
-- New tables and nullable columns only: the previous release never reads them.

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'FIXED_AMOUNT');

-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "discountType" "DiscountType" NOT NULL DEFAULT 'PERCENT',
    "discountValue" DOUBLE PRECISION NOT NULL,
    "maxDiscount" DOUBLE PRECISION,
    "minOrderAmount" DOUBLE PRECISION,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "usageLimit" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "name" TEXT,
    "source" TEXT NOT NULL DEFAULT 'EXIT_POPUP',
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_posts" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "content" TEXT NOT NULL,
    "coverImage" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "authorName" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "translations" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_profiles" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "tags" TEXT[] NOT NULL DEFAULT '{}',
    "totalStays" INTEGER NOT NULL DEFAULT 0,
    "totalSpent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastStayAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "bookingId" TEXT,
    "guestName" TEXT NOT NULL,
    "guestEmail" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "comment" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "reviewToken" TEXT,
    "tokenUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- AlterTable: bookings gains coupon + automation markers
ALTER TABLE "bookings" ADD COLUMN     "couponId" TEXT,
ADD COLUMN     "couponCode" TEXT,
ADD COLUMN     "abandonedEmailSentAt" TIMESTAMP(3),
ADD COLUMN     "postStayEmailSentAt" TIMESTAMP(3);

-- AlterTable: website settings gains tracking + exit-intent config
ALTER TABLE "website_settings" ADD COLUMN     "facebookPixelId" TEXT,
ADD COLUMN     "googleTagId" TEXT,
ADD COLUMN     "exitIntentEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "exitIntentCouponId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "coupons_propertyId_code_key" ON "coupons"("propertyId", "code");

-- CreateIndex
CREATE INDEX "coupons_propertyId_isActive_startDate_endDate_idx" ON "coupons"("propertyId", "isActive", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "leads_propertyId_email_idx" ON "leads"("propertyId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_propertyId_slug_key" ON "blog_posts"("propertyId", "slug");

-- CreateIndex
CREATE INDEX "blog_posts_propertyId_isPublished_publishedAt_idx" ON "blog_posts"("propertyId", "isPublished", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "customer_profiles_propertyId_email_phone_key" ON "customer_profiles"("propertyId", "email", "phone");

-- CreateIndex
CREATE INDEX "customer_profiles_propertyId_email_idx" ON "customer_profiles"("propertyId", "email");

-- CreateIndex
CREATE INDEX "customer_profiles_propertyId_phone_idx" ON "customer_profiles"("propertyId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_bookingId_key" ON "reviews"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_reviewToken_key" ON "reviews"("reviewToken");

-- CreateIndex
CREATE INDEX "reviews_propertyId_isPublished_rating_idx" ON "reviews"("propertyId", "isPublished", "rating");

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
