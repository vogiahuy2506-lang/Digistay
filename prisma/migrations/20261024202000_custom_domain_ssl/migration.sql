-- A hotel's own domain gets its HTTPS certificate from the VPS's
-- docker/certbot/custom-domains.sh (every minute): asked for when the domain is
-- verified (sslRequestedAt), the last attempt (sslCheckedAt) and its failure (sslError).
ALTER TABLE "website_settings" ADD COLUMN "sslRequestedAt" TIMESTAMP(3);
ALTER TABLE "website_settings" ADD COLUMN "sslCheckedAt" TIMESTAMP(3);
ALTER TABLE "website_settings" ADD COLUMN "sslError" TEXT;
