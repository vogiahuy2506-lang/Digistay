# Browser tests (Playwright)

Run nightly by `.github/workflows/e2e.yml` against the production build. PayOS, Mắt Bão and
SMTP are faked by `fakes.ts`; `global-setup.ts` empties and reseeds a database whose name must
end in `_e2e`. How to run them locally: `docs/RUNBOOK.md`, "Kiểm thử trình duyệt (e2e)".
