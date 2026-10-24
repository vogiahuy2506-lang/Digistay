-- The hotel's button and heading colors on its website (the builder's Style tab).
-- NULL: Digistay's ink for buttons, the text color for headings.
ALTER TABLE "website_settings" ADD COLUMN "buttonColor" TEXT;
ALTER TABLE "website_settings" ADD COLUMN "headingColor" TEXT;
