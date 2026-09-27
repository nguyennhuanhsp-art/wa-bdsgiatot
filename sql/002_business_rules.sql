BEGIN;
SET LOCAL search_path=bds,public;
-- Only the trusted backend sets app.user_id after verifying the session.
-- Never expose a database connection, this GUC, or an arbitrary SQL endpoint to browsers.
CREATE FUNCTION actor_id() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('app.user_id',true),'')::uuid
$$;
CREATE FUNCTION is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=bds,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM users WHERE id=actor_id() AND status='active' AND platform_role='admin')
$$;
CREATE FUNCTION is_editor() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=bds,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM users WHERE id=actor_id() AND status='active' AND platform_role IN ('admin','editor'))
$$;
CREATE FUNCTION is_org_admin(p_org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=bds,pg_temp AS $$
 SELECT is_admin() OR EXISTS(SELECT 1 FROM organization_members m JOIN users u ON u.id=m.user_id
 JOIN organizations o ON o.id=m.organization_id WHERE m.organization_id=p_org AND m.user_id=actor_id()
 AND m.status='active' AND m.role='org_admin' AND u.status='active' AND o.status='active')
$$;
CREATE FUNCTION is_member(p_org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=bds,pg_temp AS $$
 SELECT is_admin() OR EXISTS(SELECT 1 FROM organization_members m JOIN users u ON u.id=m.user_id
 JOIN organizations o ON o.id=m.organization_id WHERE m.organization_id=p_org AND m.user_id=actor_id()
 AND m.status='active' AND u.status='active' AND o.status='active')
$$;
CREATE FUNCTION owns_assignment(p_assignment uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=bds,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM project_assignments a JOIN organization_members m ON m.id=a.member_id
 JOIN users u ON u.id=m.user_id WHERE a.id=p_assignment AND m.user_id=actor_id()
 AND m.status='active' AND u.status='active' AND is_member(m.organization_id))
$$;
CREATE FUNCTION can_manage_listing(p_listing uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=bds,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM listings l WHERE l.id=p_listing AND
 (is_org_admin(l.organization_id) OR owns_assignment(l.assignment_id)))
$$;
CREATE FUNCTION subscription_live(p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=bds,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM subscriptions s JOIN contracts c ON c.id=s.contract_id
 JOIN organizations o ON o.id=s.organization_id WHERE s.id=p_id
 AND s.status='active' AND c.status='active' AND c.signed_at IS NOT NULL
 AND o.status='active' AND o.verification_status='verified'
 AND statement_timestamp()>=s.starts_at AND statement_timestamp()<s.ends_at
 AND statement_timestamp()>=c.effective_from AND statement_timestamp()<c.effective_until
 AND EXISTS(SELECT 1 FROM contract_documents d WHERE d.contract_id=c.id AND d.document_type='signed_contract'))
$$;
CREATE FUNCTION grant_live(p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=bds,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM subscription_projects g JOIN project_organizations po ON po.id=g.project_organization_id
 JOIN projects p ON p.id=g.project_id WHERE g.id=p_id AND g.status='active'
 AND po.verification_status='verified' AND p.status='published' AND subscription_live(g.subscription_id)
 AND statement_timestamp()>=g.valid_from AND statement_timestamp()<g.valid_until)
$$;
CREATE FUNCTION assignment_live(p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=bds,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM project_assignments a JOIN subscription_seats ss ON ss.id=a.seat_id
 JOIN organization_members m ON m.id=a.member_id JOIN users u ON u.id=m.user_id
 WHERE a.id=p_id AND a.status='active' AND ss.status='active' AND m.status='active' AND u.status='active'
 AND grant_live(a.subscription_project_id))
$$;
CREATE FUNCTION listing_live(p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=bds,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM listings l WHERE l.id=p_id AND l.status='published'
 AND l.published_at<=statement_timestamp() AND l.expires_at>statement_timestamp() AND assignment_live(l.assignment_id))
$$;
CREATE FUNCTION write_audit(p_org uuid,p_action text,p_type text,p_id text,p_details jsonb DEFAULT '{}')
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=bds,pg_temp AS $$
 INSERT INTO audit_logs(actor_user_id,organization_id,action,entity_type,entity_id,details)
 VALUES(actor_id(),p_org,p_action,p_type,p_id,p_details)
$$;

-- Composite foreign keys enforce consistent tenant/project/subscription.
-- Immutable scope keys prevent moving an existing row to another tenant.
CREATE FUNCTION immutable_scope() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE k text;
BEGIN
 FOREACH k IN ARRAY TG_ARGV LOOP
  IF (to_jsonb(NEW)->k) IS DISTINCT FROM (to_jsonb(OLD)->k) THEN
   RAISE EXCEPTION 'Immutable scope column: %', k USING ERRCODE='23514';
  END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_scope BEFORE UPDATE ON subscriptions FOR EACH ROW
 EXECUTE FUNCTION immutable_scope('id','organization_id','contract_id');
CREATE TRIGGER immutable_scope BEFORE UPDATE ON contracts FOR EACH ROW
 EXECUTE FUNCTION immutable_scope('id','organization_id');
CREATE TRIGGER immutable_scope BEFORE UPDATE ON subscription_projects FOR EACH ROW
 EXECUTE FUNCTION immutable_scope('id','organization_id','project_id','subscription_id','project_organization_id');
CREATE TRIGGER immutable_scope BEFORE UPDATE ON project_organizations FOR EACH ROW
 EXECUTE FUNCTION immutable_scope('id','organization_id','project_id');
CREATE TRIGGER immutable_scope BEFORE UPDATE ON organization_members FOR EACH ROW
 EXECUTE FUNCTION immutable_scope('id','organization_id','user_id');
CREATE TRIGGER immutable_scope BEFORE UPDATE ON subscription_seats FOR EACH ROW
 EXECUTE FUNCTION immutable_scope('id','organization_id','subscription_id','member_id');
CREATE TRIGGER immutable_scope BEFORE UPDATE ON project_assignments FOR EACH ROW
 EXECUTE FUNCTION immutable_scope('id','organization_id','project_id','subscription_id','member_id','seat_id','subscription_project_id');
CREATE TRIGGER immutable_scope BEFORE UPDATE ON listings FOR EACH ROW
 EXECUTE FUNCTION immutable_scope('id','organization_id','project_id','subscription_id','created_by','created_at');

CREATE FUNCTION check_subscription() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=bds,pg_temp AS $$
DECLARE c contracts;
BEGIN
 SELECT * INTO STRICT c FROM contracts WHERE id=NEW.contract_id;
 IF NEW.starts_at<c.effective_from OR NEW.ends_at>c.effective_until THEN
  RAISE EXCEPTION 'Combo period must fit contract' USING ERRCODE='23514'; END IF;
 IF NEW.status='active' AND (c.status<>'active' OR c.signed_at IS NULL OR NOT EXISTS(
  SELECT 1 FROM contract_documents WHERE contract_id=c.id AND document_type='signed_contract')) THEN
  RAISE EXCEPTION 'Active combo requires signed active contract and signed document' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW.sale_limit<(SELECT count(*) FROM subscription_seats WHERE subscription_id=NEW.id AND status='active') THEN
   RAISE EXCEPTION 'Seat limit is below reserved seats' USING ERRCODE='23514'; END IF;
  IF NEW.active_listing_limit<(SELECT count(*) FROM listings WHERE subscription_id=NEW.id AND status='published' AND expires_at>statement_timestamp()) THEN
   RAISE EXCEPTION 'Listing limit is below occupied slots' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER check_subscription BEFORE INSERT OR UPDATE OF sale_limit,active_listing_limit,starts_at,ends_at,status ON subscriptions
 FOR EACH ROW EXECUTE FUNCTION check_subscription();
CREATE FUNCTION check_grant() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=bds,pg_temp AS $$
DECLARE s subscriptions;
BEGIN
 SELECT * INTO STRICT s FROM subscriptions WHERE id=NEW.subscription_id;
 IF NEW.valid_from<s.starts_at OR NEW.valid_until>s.ends_at THEN
  RAISE EXCEPTION 'Project grant period must fit combo' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER check_grant BEFORE INSERT OR UPDATE ON subscription_projects FOR EACH ROW EXECUTE FUNCTION check_grant();

-- Updating revision obtains a row lock and prevents stale quota decisions even at repeatable-read.
CREATE FUNCTION allocate_seat(p_subscription uuid,p_member uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=bds,pg_temp AS $$
DECLARE s subscriptions; m organization_members; result uuid; used bigint;
BEGIN
 SELECT * INTO STRICT s FROM subscriptions WHERE id=p_subscription;
 IF NOT is_org_admin(s.organization_id) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 UPDATE subscriptions SET quota_revision=quota_revision+1 WHERE id=p_subscription RETURNING * INTO s;
 IF NOT subscription_live(s.id) THEN RAISE EXCEPTION 'Combo inactive' USING ERRCODE='23514'; END IF;
 SELECT * INTO STRICT m FROM organization_members WHERE id=p_member AND organization_id=s.organization_id;
 IF m.role<>'sale' OR m.status='blocked' THEN RAISE EXCEPTION 'Seat requires invited or active Sale' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=m.user_id AND status IN ('invited','active')) THEN
  RAISE EXCEPTION 'User blocked' USING ERRCODE='23514'; END IF;
 SELECT id INTO result FROM subscription_seats WHERE subscription_id=s.id AND member_id=m.id AND status='active';
 IF result IS NOT NULL THEN RETURN result; END IF;
 SELECT count(*) INTO used FROM subscription_seats WHERE subscription_id=s.id AND status='active';
 IF used>=s.sale_limit THEN RAISE EXCEPTION 'Sale seat quota exceeded' USING ERRCODE='23514'; END IF;
 INSERT INTO subscription_seats(organization_id,subscription_id,member_id) VALUES(s.organization_id,s.id,m.id)
 ON CONFLICT(subscription_id,member_id) DO UPDATE SET status='active' RETURNING id INTO result;
 PERFORM write_audit(s.organization_id,'allocate_seat','subscription_seat',result::text);
 RETURN result;
END $$;

CREATE FUNCTION invite_sale(p_subscription uuid,p_email text,p_display_name text,p_token_hash text,p_expires_at timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=bds,pg_temp AS $$
DECLARE s subscriptions; u uuid; m uuid;
BEGIN
 SELECT * INTO STRICT s FROM subscriptions WHERE id=p_subscription;
 IF NOT is_org_admin(s.organization_id) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 IF p_expires_at<=statement_timestamp() OR p_expires_at>statement_timestamp()+interval '7 days'
 OR length(p_token_hash)<40 THEN RAISE EXCEPTION 'Invalid invitation expiry or token hash' USING ERRCODE='23514'; END IF;
 INSERT INTO users(email,display_name) VALUES(lower(btrim(p_email)),p_display_name)
 ON CONFLICT(email) DO NOTHING;
 SELECT id INTO STRICT u FROM users WHERE email=lower(btrim(p_email)) AND status<>'blocked';
 INSERT INTO organization_members(organization_id,user_id,role) VALUES(s.organization_id,u,'sale')
 ON CONFLICT(organization_id,user_id) DO NOTHING;
 SELECT id INTO STRICT m FROM organization_members WHERE organization_id=s.organization_id AND user_id=u AND role='sale' AND status<>'blocked';
 PERFORM allocate_seat(s.id,m);
 INSERT INTO bds_private.invitation_tokens(member_id,token_hash,expires_at) VALUES(m,p_token_hash,p_expires_at);
 PERFORM write_audit(s.organization_id,'invite_sale','organization_member',m::text);
 RETURN m;
END $$;

CREATE FUNCTION revoke_seat(p_seat uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=bds,pg_temp AS $$
DECLARE ss subscription_seats;
BEGIN
 SELECT * INTO STRICT ss FROM subscription_seats WHERE id=p_seat;
 IF NOT is_org_admin(ss.organization_id) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 UPDATE subscriptions SET quota_revision=quota_revision+1 WHERE id=ss.subscription_id;
 UPDATE subscription_seats SET status='revoked' WHERE id=ss.id;
 UPDATE project_assignments SET status='revoked' WHERE seat_id=ss.id;
 UPDATE listings SET status='hidden' WHERE assignment_id IN(SELECT id FROM project_assignments WHERE seat_id=ss.id)
 AND status IN ('pending','published');
 PERFORM write_audit(ss.organization_id,'revoke_seat','subscription_seat',ss.id::text);
END $$;

CREATE FUNCTION set_sale_status(p_member uuid,p_status text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=bds,pg_temp AS $$
DECLARE m organization_members;
BEGIN
 SELECT * INTO STRICT m FROM organization_members WHERE id=p_member;
 IF NOT is_org_admin(m.organization_id) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 IF m.role<>'sale' OR p_status NOT IN ('active','blocked') OR m.status='invited' THEN
  RAISE EXCEPTION 'Use invitation acceptance for invited users' USING ERRCODE='23514'; END IF;
 UPDATE organization_members SET status=p_status WHERE id=m.id;
 PERFORM write_audit(m.organization_id,'set_sale_status','organization_member',m.id::text,jsonb_build_object('status',p_status));
 INSERT INTO outbox_events(event_type,aggregate_id) VALUES('organization.changed',m.organization_id);
END $$;

CREATE FUNCTION assign_project(p_seat uuid,p_grant uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=bds,pg_temp AS $$
DECLARE ss subscription_seats; g subscription_projects; result uuid;
BEGIN
 SELECT * INTO STRICT ss FROM subscription_seats WHERE id=p_seat;
 IF NOT is_org_admin(ss.organization_id) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 UPDATE subscriptions SET quota_revision=quota_revision+1 WHERE id=ss.subscription_id;
 SELECT * INTO STRICT ss FROM subscription_seats WHERE id=p_seat AND status='active';
 SELECT * INTO STRICT g FROM subscription_projects WHERE id=p_grant AND subscription_id=ss.subscription_id AND organization_id=ss.organization_id;
 IF NOT grant_live(g.id) THEN RAISE EXCEPTION 'Project grant inactive' USING ERRCODE='23514'; END IF;
 INSERT INTO project_assignments(organization_id,project_id,subscription_id,member_id,seat_id,subscription_project_id)
 VALUES(ss.organization_id,g.project_id,ss.subscription_id,ss.member_id,ss.id,g.id)
 ON CONFLICT(member_id,subscription_project_id) DO UPDATE SET status='active' RETURNING id INTO result;
 PERFORM write_audit(ss.organization_id,'assign_project','project_assignment',result::text);
 RETURN result;
END $$;

CREATE FUNCTION guard_listing_write() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=bds,pg_temp AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'draft' OR NEW.created_by IS DISTINCT FROM actor_id() THEN
   RAISE EXCEPTION 'New listing must be draft with current actor' USING ERRCODE='23514'; END IF;
  IF NOT (is_org_admin(NEW.organization_id) OR owns_assignment(NEW.assignment_id)) OR NOT assignment_live(NEW.assignment_id) THEN
   RAISE EXCEPTION 'No active permission to create listing' USING ERRCODE='42501'; END IF;
 ELSIF (to_jsonb(NEW)-ARRAY['status','published_at','expires_at','updated_at','assignment_id'])
     IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','published_at','expires_at','updated_at','assignment_id']) THEN
  IF OLD.status NOT IN ('draft','rejected') THEN RAISE EXCEPTION 'Reopen listing before editing content' USING ERRCODE='23514'; END IF;
  IF NOT assignment_live(NEW.assignment_id) THEN RAISE EXCEPTION 'Assignment inactive' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_listing_write BEFORE INSERT OR UPDATE ON listings FOR EACH ROW EXECUTE FUNCTION guard_listing_write();

CREATE FUNCTION record_listing_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=bds,pg_temp AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  INSERT INTO listing_revisions(listing_id,organization_id,changed_by_user_id,snapshot)
  VALUES(OLD.id,OLD.organization_id,actor_id(),to_jsonb(OLD));
 END IF;
 INSERT INTO outbox_events(event_type,aggregate_id,payload)
 VALUES('listing.changed',NEW.id,jsonb_build_object('project_id',NEW.project_id,'organization_id',NEW.organization_id));
 RETURN NEW;
END $$;
CREATE TRIGGER record_listing_change AFTER INSERT OR UPDATE ON listings FOR EACH ROW EXECUTE FUNCTION record_listing_change();

CREATE FUNCTION transition_listing(p_id uuid,p_status text,p_reason text DEFAULT NULL,p_expires_at timestamptz DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=bds,pg_temp AS $$
DECLARE l listings; s subscriptions; cutoff timestamptz; used bigint;
BEGIN
 SELECT * INTO STRICT l FROM listings WHERE id=p_id;
 IF NOT can_manage_listing(l.id) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 -- Always lock subscription before listing; serialize quota allocation.
 UPDATE subscriptions SET quota_revision=quota_revision+1 WHERE id=l.subscription_id RETURNING * INTO s;
 SELECT * INTO STRICT l FROM listings WHERE id=p_id FOR UPDATE;
 IF p_status=l.status THEN RETURN; END IF;
 IF p_status='pending' AND l.status IN ('draft','rejected') THEN
  IF NOT assignment_live(l.assignment_id) THEN RAISE EXCEPTION 'Assignment inactive' USING ERRCODE='23514'; END IF;
 ELSIF p_status='published' AND l.status='pending' THEN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Only platform admin approves' USING ERRCODE='42501'; END IF;
  IF NOT assignment_live(l.assignment_id) THEN RAISE EXCEPTION 'Assignment inactive' USING ERRCODE='23514'; END IF;
  SELECT least(s.ends_at,c.effective_until,g.valid_until) INTO cutoff FROM contracts c,
  project_assignments a JOIN subscription_projects g ON g.id=a.subscription_project_id
  WHERE c.id=s.contract_id AND a.id=l.assignment_id;
  IF p_expires_at IS NULL OR p_expires_at<=clock_timestamp() OR p_expires_at>cutoff THEN
   RAISE EXCEPTION 'Listing expiry outside entitlement period' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS(SELECT 1 FROM listing_media lm JOIN media_assets ma ON ma.id=lm.media_asset_id
   WHERE lm.listing_id=l.id AND ma.status='ready') THEN
   RAISE EXCEPTION 'At least one ready image is required' USING ERRCODE='23514'; END IF;
  SELECT count(*) INTO used FROM listings WHERE subscription_id=s.id AND status='published' AND expires_at>statement_timestamp();
  IF used>=s.active_listing_limit THEN RAISE EXCEPTION 'Listing quota exceeded' USING ERRCODE='23514'; END IF;
 ELSIF p_status='rejected' AND l.status='pending' THEN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Only platform admin rejects' USING ERRCODE='42501'; END IF;
  IF nullif(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'Rejection reason required' USING ERRCODE='23514'; END IF;
 ELSIF p_status='hidden' AND l.status IN ('pending','published') THEN NULL;
 ELSIF p_status='closed' AND l.status IN ('published','hidden','expired') THEN NULL;
 ELSIF p_status='draft' AND l.status IN ('hidden','expired','rejected') THEN
  IF NOT assignment_live(l.assignment_id) THEN RAISE EXCEPTION 'Assignment inactive' USING ERRCODE='23514'; END IF;
 ELSE RAISE EXCEPTION 'Invalid transition % -> %',l.status,p_status USING ERRCODE='23514';
 END IF;
 UPDATE listings SET status=p_status,
 published_at=CASE WHEN p_status='published' THEN clock_timestamp() ELSE published_at END,
 expires_at=CASE WHEN p_status='published' THEN p_expires_at ELSE expires_at END WHERE id=l.id;
 IF is_admin() AND p_status IN ('published','rejected','hidden') THEN
  INSERT INTO moderation_actions(listing_id,organization_id,reviewer_user_id,decision,reason)
  VALUES(l.id,l.organization_id,actor_id(),p_status,p_reason);
 END IF;
 PERFORM write_audit(l.organization_id,'listing.'||p_status,'listing',l.id::text);
END $$;

CREATE FUNCTION transfer_listing(p_listing uuid,p_assignment uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=bds,pg_temp AS $$
DECLARE l listings; a project_assignments;
BEGIN
 SELECT * INTO STRICT l FROM listings WHERE id=p_listing;
 IF NOT is_org_admin(l.organization_id) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 UPDATE subscriptions SET quota_revision=quota_revision+1 WHERE id=l.subscription_id;
 SELECT * INTO STRICT l FROM listings WHERE id=p_listing FOR UPDATE;
 SELECT * INTO STRICT a FROM project_assignments WHERE id=p_assignment
 AND organization_id=l.organization_id AND project_id=l.project_id AND subscription_id=l.subscription_id;
 IF NOT assignment_live(a.id) THEN RAISE EXCEPTION 'Target assignment inactive' USING ERRCODE='23514'; END IF;
 UPDATE listings SET assignment_id=a.id WHERE id=l.id;
 PERFORM write_audit(l.organization_id,'transfer_listing','listing',l.id::text,jsonb_build_object('old_assignment',l.assignment_id,'new_assignment',a.id));
END $$;

CREATE FUNCTION guard_listing_media() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=bds,pg_temp AS $$
DECLARE lid uuid; l listings; ma media_assets;
BEGIN
 lid=CASE WHEN TG_OP='DELETE' THEN OLD.listing_id ELSE NEW.listing_id END;
 SELECT * INTO STRICT l FROM listings WHERE id=lid;
 IF NOT can_manage_listing(l.id) OR NOT assignment_live(l.assignment_id) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 IF l.status NOT IN ('draft','rejected') THEN RAISE EXCEPTION 'Reopen listing before editing images' USING ERRCODE='23514'; END IF;
 IF TG_OP<>'DELETE' THEN
  SELECT * INTO STRICT ma FROM media_assets WHERE id=NEW.media_asset_id;
  IF ma.status<>'ready' OR ma.organization_id<>l.organization_id THEN RAISE EXCEPTION 'Image not ready or wrong tenant' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER guard_listing_media BEFORE INSERT OR DELETE ON listing_media FOR EACH ROW EXECUTE FUNCTION guard_listing_media();

CREATE FUNCTION record_contact(p_listing uuid,p_name text,p_contact text,p_message text,p_consent boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=bds,pg_temp AS $$
DECLARE result uuid; org uuid;
BEGIN
 IF p_consent IS DISTINCT FROM true OR NOT listing_live(p_listing) THEN RAISE EXCEPTION 'Listing unavailable or consent missing' USING ERRCODE='23514'; END IF;
 SELECT organization_id INTO org FROM listings WHERE id=p_listing;
 INSERT INTO contact_requests(listing_id,organization_id,customer_name,contact_detail,message,consent_at)
 VALUES(p_listing,org,p_name,p_contact,coalesce(p_message,''),clock_timestamp()) RETURNING id INTO result;
 INSERT INTO outbox_events(event_type,aggregate_id,payload) VALUES('contact.created',result,jsonb_build_object('listing_id',p_listing,'organization_id',org));
 RETURN result;
END $$;

-- Worker function: temporal checks also happen on every public query, so worker delay cannot expose expired offers.
CREATE FUNCTION expire_listings(p_batch int DEFAULT 500) RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path=bds,pg_temp AS $$
DECLARE result int;
BEGIN
 IF p_batch<1 OR p_batch>5000 THEN RAISE EXCEPTION 'Invalid batch size'; END IF;
 WITH due AS (SELECT id FROM listings WHERE status='published' AND expires_at<=statement_timestamp()
 ORDER BY expires_at FOR UPDATE SKIP LOCKED LIMIT p_batch)
 UPDATE listings l SET status='expired' FROM due WHERE l.id=due.id;
 GET DIAGNOSTICS result=ROW_COUNT; RETURN result;
END $$;

-- Public projections whitelist columns; underlying tables are NEVER public API responses.
CREATE VIEW public_listings WITH(security_barrier=true) AS
 SELECT l.id,l.public_code,l.slug,l.title,l.description,l.project_id,l.organization_id,
 l.transaction_type,l.property_type_code,l.price_amount,l.currency_code,l.price_basis,l.negotiable,
 l.area_m2,l.bedrooms,l.bathrooms,l.published_at,l.expires_at,l.updated_at,
 p.name AS project_name,p.slug AS project_slug,p.location_id,lo.country_code,
 CASE WHEN lo.country_code='VN' THEN 'domestic' ELSE 'international' END AS market_scope,
 o.legal_name AS organization_name
 FROM listings l JOIN projects p ON p.id=l.project_id JOIN locations lo ON lo.id=p.location_id
 JOIN organizations o ON o.id=l.organization_id WHERE listing_live(l.id);
CREATE VIEW public_listing_media WITH(security_barrier=true) AS
 SELECT lm.listing_id,lm.display_order,lm.alt_text,ma.public_url,ma.width,ma.height
 FROM listing_media lm JOIN media_assets ma ON ma.id=lm.media_asset_id
 WHERE ma.status='ready' AND listing_live(lm.listing_id);
CREATE VIEW public_projects WITH(security_barrier=true) AS
 SELECT p.id,p.name,p.slug,p.description,p.address,p.location_id,lo.country_code,p.meta_title,p.meta_description,
 p.updated_at FROM projects p JOIN locations lo ON lo.id=p.location_id WHERE p.status='published'
 AND EXISTS(SELECT 1 FROM public_listings l WHERE l.project_id=p.id);
CREATE VIEW public_organizations WITH(security_barrier=true) AS
 SELECT id,legal_name,slug,introduction,public_phone,public_email FROM organizations
 WHERE status='active' AND verification_status='verified';
CREATE VIEW public_agents WITH(security_barrier=true) AS
 SELECT ap.user_id,ap.slug,u.display_name,ap.bio,ap.public_phone FROM agent_profiles ap JOIN users u ON u.id=ap.user_id
 WHERE ap.is_public AND u.status='active' AND EXISTS(
 SELECT 1 FROM organization_members m JOIN organizations o ON o.id=m.organization_id
 WHERE m.user_id=u.id AND m.role='sale' AND m.status='active' AND o.status='active' AND o.verification_status='verified');
CREATE VIEW public_listing_contacts WITH(security_barrier=true) AS
 SELECT l.id AS listing_id,o.slug AS organization_slug,o.public_phone AS organization_phone,
 CASE WHEN ap.is_public THEN ap.slug END AS agent_slug,
 CASE WHEN ap.is_public THEN u.display_name END AS agent_name,
 CASE WHEN ap.is_public THEN ap.public_phone END AS agent_phone
 FROM listings l JOIN project_assignments a ON a.id=l.assignment_id
 JOIN organization_members m ON m.id=a.member_id JOIN users u ON u.id=m.user_id
 JOIN organizations o ON o.id=l.organization_id LEFT JOIN agent_profiles ap ON ap.user_id=u.id
 WHERE listing_live(l.id);
CREATE VIEW public_articles WITH(security_barrier=true) AS
 SELECT a.id,a.category,a.title,a.slug,a.body,a.meta_title,a.meta_description,a.published_at,a.updated_at,u.display_name AS author_name
 FROM articles a JOIN users u ON u.id=a.author_user_id WHERE a.status='published' AND a.published_at<=statement_timestamp();

CREATE FUNCTION record_scope_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=bds,pg_temp AS $$
DECLARE rowdata jsonb; org uuid; entity uuid;
BEGIN
 IF TG_OP='UPDATE' AND (to_jsonb(NEW)-ARRAY['quota_revision','updated_at'])=(to_jsonb(OLD)-ARRAY['quota_revision','updated_at']) THEN RETURN NEW; END IF;
 rowdata=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 entity=(rowdata->>'id')::uuid;
 org=CASE WHEN TG_TABLE_NAME='organizations' THEN entity ELSE (rowdata->>'organization_id')::uuid END;
 PERFORM write_audit(org,lower(TG_OP),TG_TABLE_NAME,entity::text,jsonb_build_object('status',rowdata->>'status'));
 INSERT INTO outbox_events(event_type,aggregate_id,payload) VALUES('scope.changed',entity,
 jsonb_build_object('table',TG_TABLE_NAME,'organization_id',org,'project_id',
 CASE WHEN TG_TABLE_NAME='projects' THEN entity ELSE (rowdata->>'project_id')::uuid END));
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['organizations','contracts','subscriptions','subscription_projects','project_organizations','projects','users','organization_members'] LOOP
  EXECUTE format('CREATE TRIGGER record_scope_change AFTER INSERT OR UPDATE ON bds.%I FOR EACH ROW EXECUTE FUNCTION bds.record_scope_change()',t);
 END LOOP;
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA bds FROM PUBLIC;
COMMIT;
