-- One custom domain, one property site (src/lib/custom-domain.ts).
-- If two sites already hold the same value this fails on purpose: which
-- hotel keeps the domain is a human decision, not this migration's. Check
-- first (RUNBOOK "Tên miền riêng"). An empty string was never a domain (the
-- old settings form could save one), so it becomes NULL.
UPDATE "website_settings" SET "customDomain" = NULL WHERE btrim("customDomain") = '';

-- CreateIndex
CREATE UNIQUE INDEX "website_settings_customDomain_key" ON "website_settings"("customDomain");
