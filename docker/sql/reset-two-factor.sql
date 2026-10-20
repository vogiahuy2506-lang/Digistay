-- Turns off two-factor sign-in for one account whose owner lost both the
-- phone and the recovery codes. Run ONLY after confirming who is asking:
-- docs/RUNBOOK.md, "Đặt lại xác thực hai lớp". Logs who did it and how the
-- person was verified (activity_logs, action TWO_FACTOR_RESET_BY_OPERATOR).
--
--   sudo docker compose exec -T postgres psql -U digistay -d digistay \
--     -v email='nguoi@example.com' -v by='<ai làm>' -v via='<xác minh bằng cách nào>' \
--     < docker/sql/reset-two-factor.sql
\set ON_ERROR_STOP on
BEGIN;
SELECT u.email, t."enabledAt" FROM users u JOIN user_two_factor t ON t."userId" = u.id
WHERE u.email = :'email';
INSERT INTO activity_logs (id, "userId", action, "entityType", "entityId", metadata, "createdAt")
SELECT 'op_' || md5(random()::text), t."userId", 'TWO_FACTOR_RESET_BY_OPERATOR', 'USER', t."userId",
       jsonb_build_object('by', :'by', 'verifiedVia', :'via'), NOW()
FROM user_two_factor t JOIN users u ON u.id = t."userId" WHERE u.email = :'email';
DELETE FROM user_two_factor WHERE "userId" = (SELECT id FROM users WHERE email = :'email');
COMMIT;
