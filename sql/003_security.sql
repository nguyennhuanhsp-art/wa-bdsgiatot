-- Apply with schema owner + CREATEROLE. Role names are project-specific group roles, NOLOGIN.
BEGIN;
SET LOCAL search_path=bds,public;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='bdsgiatot_api') THEN CREATE ROLE bdsgiatot_api NOLOGIN NOSUPERUSER NOBYPASSRLS; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='bdsgiatot_auth') THEN CREATE ROLE bdsgiatot_auth NOLOGIN NOSUPERUSER NOBYPASSRLS; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='bdsgiatot_worker') THEN CREATE ROLE bdsgiatot_worker NOLOGIN NOSUPERUSER NOBYPASSRLS; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('bdsgiatot_api','bdsgiatot_auth','bdsgiatot_worker') AND (rolsuper OR rolbypassrls)) THEN
  RAISE EXCEPTION 'Runtime group roles must not have SUPERUSER or BYPASSRLS'; END IF;
END $$;
GRANT USAGE ON SCHEMA bds TO bdsgiatot_api,bdsgiatot_auth,bdsgiatot_worker;
GRANT USAGE ON SCHEMA bds_private TO bdsgiatot_auth;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA bds TO bdsgiatot_api,bdsgiatot_worker;
GRANT SELECT ON ALL TABLES IN SCHEMA bds TO bdsgiatot_api;
-- RLS enabled on every base table. No policy means denied.
DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='bds' LOOP
  EXECUTE format('ALTER TABLE bds.%I ENABLE ROW LEVEL SECURITY',t.tablename);
 END LOOP;
END $$;
-- Owner is the migration account; runtime roles are never owners or members of the owner role.
GRANT EXECUTE ON FUNCTION actor_id(),is_admin(),is_editor(),is_org_admin(uuid),is_member(uuid),
 owns_assignment(uuid),can_manage_listing(uuid),subscription_live(uuid),grant_live(uuid),
 assignment_live(uuid),listing_live(uuid) TO bdsgiatot_api;

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['countries','currencies','locations','location_aliases','location_mappings','property_types'] LOOP
  EXECUTE format('CREATE POLICY lookup_read ON bds.%I FOR SELECT TO bdsgiatot_api USING(true)',t);
  EXECUTE format('CREATE POLICY lookup_admin ON bds.%I FOR ALL TO bdsgiatot_api USING(bds.is_admin()) WITH CHECK(bds.is_admin())',t);
  EXECUTE format('GRANT INSERT,UPDATE ON bds.%I TO bdsgiatot_api',t);
 END LOOP;
END $$;
CREATE POLICY users_read ON users FOR SELECT TO bdsgiatot_api USING(
 id=actor_id() OR is_admin() OR EXISTS(SELECT 1 FROM organization_members m WHERE m.user_id=users.id AND is_org_admin(m.organization_id)));
CREATE POLICY organizations_read ON organizations FOR SELECT TO bdsgiatot_api USING(is_member(id));
CREATE POLICY organizations_admin ON organizations FOR ALL TO bdsgiatot_api USING(is_admin()) WITH CHECK(is_admin());
GRANT INSERT,UPDATE ON organizations TO bdsgiatot_api;
CREATE POLICY members_read ON organization_members FOR SELECT TO bdsgiatot_api
 USING(is_org_admin(organization_id) OR (user_id=actor_id() AND is_member(organization_id)));
CREATE POLICY profile_read ON agent_profiles FOR SELECT TO bdsgiatot_api USING(user_id=actor_id() OR is_admin());
CREATE POLICY profile_write ON agent_profiles FOR ALL TO bdsgiatot_api USING(user_id=actor_id() OR is_admin())
 WITH CHECK((user_id=actor_id() AND EXISTS(SELECT 1 FROM users WHERE id=actor_id() AND status='active')) OR is_admin());
GRANT INSERT,UPDATE ON agent_profiles TO bdsgiatot_api;

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['organization_documents','contracts','contract_documents','payment_records','subscriptions','subscription_projects'] LOOP
  EXECUTE format('CREATE POLICY org_admin_read ON bds.%I FOR SELECT TO bdsgiatot_api USING(bds.is_org_admin(organization_id))',t);
  EXECUTE format('CREATE POLICY platform_write ON bds.%I FOR ALL TO bdsgiatot_api USING(bds.is_admin()) WITH CHECK(bds.is_admin())',t);
  EXECUTE format('GRANT INSERT,UPDATE ON bds.%I TO bdsgiatot_api',t);
 END LOOP;
END $$;
-- Prevent direct quota_revision or ownership edits through runtime APIs.
REVOKE UPDATE ON subscriptions FROM bdsgiatot_api;
GRANT UPDATE(sale_limit,active_listing_limit,starts_at,ends_at,status) ON subscriptions TO bdsgiatot_api;
CREATE POLICY plans_read ON combo_plans FOR SELECT TO bdsgiatot_api USING(is_admin());
CREATE POLICY plans_write ON combo_plans FOR ALL TO bdsgiatot_api USING(is_admin()) WITH CHECK(is_admin());
GRANT INSERT,UPDATE ON combo_plans TO bdsgiatot_api;
CREATE POLICY project_org_read ON project_organizations FOR SELECT TO bdsgiatot_api USING(is_member(organization_id));
CREATE POLICY project_org_write ON project_organizations FOR ALL TO bdsgiatot_api USING(is_admin()) WITH CHECK(is_admin());
GRANT INSERT,UPDATE ON project_organizations TO bdsgiatot_api;
CREATE POLICY projects_read ON projects FOR SELECT TO bdsgiatot_api USING(is_admin() OR EXISTS(
 SELECT 1 FROM project_organizations po WHERE po.project_id=projects.id AND is_member(po.organization_id)));
CREATE POLICY projects_write ON projects FOR ALL TO bdsgiatot_api USING(is_admin()) WITH CHECK(is_admin());
GRANT INSERT,UPDATE ON projects TO bdsgiatot_api;
CREATE POLICY project_type_read ON project_property_types FOR SELECT TO bdsgiatot_api USING(EXISTS(SELECT 1 FROM projects p WHERE p.id=project_id));
CREATE POLICY project_type_write ON project_property_types FOR ALL TO bdsgiatot_api USING(is_admin()) WITH CHECK(is_admin());
GRANT INSERT,DELETE ON project_property_types TO bdsgiatot_api;
CREATE POLICY seat_read ON subscription_seats FOR SELECT TO bdsgiatot_api USING(is_org_admin(organization_id) OR EXISTS(
 SELECT 1 FROM organization_members m WHERE m.id=member_id AND m.user_id=actor_id() AND is_member(m.organization_id)));
CREATE POLICY assignment_read ON project_assignments FOR SELECT TO bdsgiatot_api USING(is_org_admin(organization_id) OR owns_assignment(id));
CREATE POLICY listing_read ON listings FOR SELECT TO bdsgiatot_api USING(is_org_admin(organization_id) OR owns_assignment(assignment_id));
CREATE POLICY listing_insert ON listings FOR INSERT TO bdsgiatot_api WITH CHECK(is_org_admin(organization_id) OR owns_assignment(assignment_id));
CREATE POLICY listing_update ON listings FOR UPDATE TO bdsgiatot_api
 USING(is_org_admin(organization_id) OR owns_assignment(assignment_id))
 WITH CHECK(is_org_admin(organization_id) OR owns_assignment(assignment_id));
GRANT INSERT(organization_id,project_id,subscription_id,assignment_id,property_type_code,transaction_type,
 slug,title,description,price_amount,currency_code,price_basis,negotiable,area_m2,bedrooms,bathrooms,created_by) ON listings TO bdsgiatot_api;
GRANT UPDATE(property_type_code,transaction_type,slug,title,description,price_amount,currency_code,price_basis,
 negotiable,area_m2,bedrooms,bathrooms) ON listings TO bdsgiatot_api;
CREATE POLICY media_read ON media_assets FOR SELECT TO bdsgiatot_api USING(is_org_admin(organization_id) OR (uploaded_by=actor_id() AND is_member(organization_id)));
CREATE POLICY media_insert ON media_assets FOR INSERT TO bdsgiatot_api WITH CHECK(uploaded_by=actor_id() AND is_member(organization_id));
GRANT INSERT(organization_id,uploaded_by,storage_key,mime_type,byte_size,width,height) ON media_assets TO bdsgiatot_api;
CREATE POLICY listing_media_read ON listing_media FOR SELECT TO bdsgiatot_api USING(can_manage_listing(listing_id));
CREATE POLICY listing_media_write ON listing_media FOR ALL TO bdsgiatot_api USING(can_manage_listing(listing_id)) WITH CHECK(can_manage_listing(listing_id));
GRANT INSERT,DELETE ON listing_media TO bdsgiatot_api;
CREATE POLICY revisions_read ON listing_revisions FOR SELECT TO bdsgiatot_api USING(can_manage_listing(listing_id));
CREATE POLICY moderation_read ON moderation_actions FOR SELECT TO bdsgiatot_api USING(can_manage_listing(listing_id));
CREATE POLICY contacts_read ON contact_requests FOR SELECT TO bdsgiatot_api USING(can_manage_listing(listing_id));
CREATE POLICY audit_read ON audit_logs FOR SELECT TO bdsgiatot_api USING(is_org_admin(organization_id) OR is_admin());
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['articles','article_projects','seo_pages','redirects'] LOOP
  EXECUTE format('CREATE POLICY editor_access ON bds.%I FOR ALL TO bdsgiatot_api USING(bds.is_editor()) WITH CHECK(bds.is_editor())',t);
  EXECUTE format('GRANT INSERT,UPDATE,DELETE ON bds.%I TO bdsgiatot_api',t);
 END LOOP;
END $$;
-- Public pages only through explicit views; these execute using owner rights with explicit filters.
CREATE VIEW public_seo_pages WITH(security_barrier=true) AS SELECT path,meta_title,meta_description,introduction,
 transaction_type,market_scope,country_code,location_id,property_type_code FROM seo_pages WHERE indexable;
CREATE VIEW public_redirects WITH(security_barrier=true) AS SELECT source_path,target_path,status_code FROM redirects;
GRANT SELECT ON public_seo_pages,public_redirects TO bdsgiatot_api;

GRANT EXECUTE ON FUNCTION allocate_seat(uuid,uuid),invite_sale(uuid,text,text,text,timestamptz),revoke_seat(uuid),
 set_sale_status(uuid,text),assign_project(uuid,uuid),transition_listing(uuid,text,text,timestamptz),
 transfer_listing(uuid,uuid),record_contact(uuid,text,text,text,boolean) TO bdsgiatot_api;

-- Auth pool is backend-only; it can read credential hashes to verify passwords.
-- Do not grant this role to the API pool or frontend.
GRANT SELECT ON users TO bdsgiatot_auth;
CREATE POLICY auth_read ON users FOR SELECT TO bdsgiatot_auth USING(true);
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA bds_private TO bdsgiatot_auth;

CREATE FUNCTION provision_org_admin(p_org uuid,p_email text,p_name text,p_token_hash text,p_expires timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=bds,pg_temp AS $$
DECLARE u uuid; m uuid;
BEGIN
 IF NOT is_admin() THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 IF p_expires<=statement_timestamp() OR p_expires>statement_timestamp()+interval '7 days' OR length(p_token_hash)<40 THEN
  RAISE EXCEPTION 'Invalid token or expiry' USING ERRCODE='23514'; END IF;
 INSERT INTO users(email,display_name) VALUES(lower(btrim(p_email)),p_name) ON CONFLICT(email) DO NOTHING;
 SELECT id INTO STRICT u FROM users WHERE email=lower(btrim(p_email)) AND status<>'blocked';
 INSERT INTO organization_members(organization_id,user_id,role) VALUES(p_org,u,'org_admin');
 SELECT id INTO m FROM organization_members WHERE organization_id=p_org AND user_id=u;
 INSERT INTO bds_private.invitation_tokens(member_id,token_hash,expires_at) VALUES(m,p_token_hash,p_expires);
 PERFORM write_audit(p_org,'invite_org_admin','organization_member',m::text); RETURN m;
END $$;
-- Auth service verifies existing-user session first and sets app.user_id accordingly.
-- New invited user may activate using token + new Argon2id password hash.
CREATE FUNCTION accept_invitation(p_token_hash text,p_password_hash text DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=bds,pg_temp AS $$
DECLARE tok bds_private.invitation_tokens; m organization_members; u users;
BEGIN
 SELECT * INTO STRICT tok FROM bds_private.invitation_tokens WHERE token_hash=p_token_hash FOR UPDATE;
 IF tok.consumed_at IS NOT NULL OR tok.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Invitation expired or used' USING ERRCODE='23514'; END IF;
 SELECT * INTO STRICT m FROM organization_members WHERE id=tok.member_id FOR UPDATE;
 SELECT * INTO STRICT u FROM users WHERE id=m.user_id FOR UPDATE;
 IF m.status='blocked' OR u.status='blocked' THEN RAISE EXCEPTION 'Account blocked' USING ERRCODE='42501'; END IF;
 IF u.status='active' AND actor_id() IS DISTINCT FROM u.id THEN RAISE EXCEPTION 'Sign in to accept invitation' USING ERRCODE='42501'; END IF;
 IF u.status='invited' THEN
  IF p_password_hash IS NULL OR p_password_hash NOT LIKE '$argon2id$%' THEN RAISE EXCEPTION 'Argon2id password hash required' USING ERRCODE='23514'; END IF;
  INSERT INTO bds_private.auth_credentials(user_id,password_hash) VALUES(u.id,p_password_hash);
  UPDATE users SET status='active' WHERE id=u.id;
 END IF;
 UPDATE organization_members SET status='active' WHERE id=m.id;
 UPDATE bds_private.invitation_tokens SET consumed_at=clock_timestamp() WHERE id=tok.id;
 PERFORM write_audit(m.organization_id,'accept_invitation','organization_member',m.id::text);
 RETURN u.id;
END $$;
REVOKE ALL ON FUNCTION provision_org_admin(uuid,text,text,text,timestamptz),accept_invitation(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION provision_org_admin(uuid,text,text,text,timestamptz) TO bdsgiatot_api;
GRANT EXECUTE ON FUNCTION accept_invitation(text,text),actor_id() TO bdsgiatot_auth;

GRANT SELECT,UPDATE ON outbox_events TO bdsgiatot_worker;
CREATE POLICY worker_outbox ON outbox_events FOR ALL TO bdsgiatot_worker USING(true) WITH CHECK(true);
GRANT SELECT ON media_assets TO bdsgiatot_worker;
GRANT UPDATE(status,public_url,width,height,byte_size) ON media_assets TO bdsgiatot_worker;
CREATE POLICY worker_media ON media_assets FOR ALL TO bdsgiatot_worker USING(true) WITH CHECK(true);
GRANT SELECT ON public_listings,public_listing_media,public_projects,public_articles TO bdsgiatot_worker;
GRANT EXECUTE ON FUNCTION expire_listings(int) TO bdsgiatot_worker;

-- Function EXECUTE is a global default; schema-only REVOKE cannot subtract it.
-- Use a dedicated migration owner for this database.
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
COMMIT;
