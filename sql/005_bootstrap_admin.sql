-- Manual one-time bootstrap. Set psql variable admin_email and admin_name first.
-- Uses an activation/reset token flow, never a hard-coded default password.
BEGIN;
INSERT INTO bds.users(email,display_name,platform_role,status)
VALUES(lower(btrim(:'admin_email')),:'admin_name','admin','invited')
RETURNING id,email;
COMMIT;
-- Auth bootstrap CLI must hash a one-time random activation token and send it privately.
-- The CLI runs as migration owner only for first admin; it sets Argon2id credential + active status atomically.
-- Do not expose bootstrap on an HTTP route. See docs/02-tao-app.md step 4.
