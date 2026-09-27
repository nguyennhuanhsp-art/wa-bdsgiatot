-- bdsgiatot.vn | PostgreSQL 17+ / PostGIS 3.5+ | 2026-09-25
-- Apply once to a NEW database. No DROP, no destructive reset.
BEGIN;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE SCHEMA bds;
CREATE SCHEMA bds_private;
REVOKE ALL ON SCHEMA bds_private FROM PUBLIC;
SET LOCAL search_path = bds, public;

CREATE TABLE countries (
  code char(2) PRIMARY KEY CHECK (code ~ '^[A-Z]{2}$'), name text NOT NULL
);
CREATE TABLE currencies (
  code char(3) PRIMARY KEY CHECK (code ~ '^[A-Z]{3}$'), name text NOT NULL,
  minor_units smallint NOT NULL DEFAULT 2 CHECK (minor_units BETWEEN 0 AND 4)
);
CREATE TABLE locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), country_code char(2) NOT NULL REFERENCES countries,
  parent_id uuid, name text NOT NULL, slug text NOT NULL,
  location_type text NOT NULL CHECK (location_type IN ('region','province','district','ward','city','other')),
  active boolean NOT NULL DEFAULT true,
  UNIQUE(id,country_code), FOREIGN KEY(parent_id,country_code) REFERENCES locations(id,country_code),
  CHECK (parent_id IS DISTINCT FROM id)
);
CREATE TABLE location_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), location_id uuid NOT NULL REFERENCES locations,
  alias text NOT NULL, UNIQUE(location_id,alias)
);
-- Merges/splits need many-to-many mappings, not only aliases.
CREATE TABLE location_mappings (
  old_location_id uuid NOT NULL REFERENCES locations, new_location_id uuid NOT NULL REFERENCES locations,
  effective_on date NOT NULL, PRIMARY KEY(old_location_id,new_location_id,effective_on),
  CHECK(old_location_id <> new_location_id)
);
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL,
  display_name text NOT NULL, platform_role text NOT NULL DEFAULT 'member'
    CHECK(platform_role IN ('member','admin','editor')),
  status text NOT NULL DEFAULT 'invited' CHECK(status IN ('invited','active','blocked')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(email = lower(btrim(email)) AND position('@' IN email)>1)
);
CREATE UNIQUE INDEX users_email_uq ON users(email);
CREATE TABLE bds_private.auth_credentials (
  user_id uuid PRIMARY KEY REFERENCES users, password_hash text NOT NULL,
  password_changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE bds_private.user_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users,
  purpose text NOT NULL CHECK(purpose IN ('activation','password_reset','refresh')),
  token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), CHECK(expires_at > created_at)
);
CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), legal_name text NOT NULL, slug text NOT NULL UNIQUE,
  registration_number text NOT NULL, registration_country char(2) NOT NULL REFERENCES countries,
  introduction text, public_phone text, public_email text,
  verification_status text NOT NULL DEFAULT 'pending' CHECK(verification_status IN ('pending','verified','rejected')),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','suspended','closed')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(registration_country,registration_number)
);
CREATE TABLE organization_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations,
  document_type text NOT NULL, private_storage_key text NOT NULL UNIQUE,
  uploaded_by uuid NOT NULL REFERENCES users, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations,
  user_id uuid NOT NULL REFERENCES users,
  role text NOT NULL CHECK(role IN ('org_admin','sale')),
  status text NOT NULL DEFAULT 'invited' CHECK(status IN ('invited','active','blocked')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,user_id), UNIQUE(id,organization_id)
);
CREATE TABLE agent_profiles (
  user_id uuid PRIMARY KEY REFERENCES users, slug text NOT NULL UNIQUE,
  bio text, public_phone text, is_public boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE bds_private.invitation_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), member_id uuid NOT NULL REFERENCES organization_members,
  token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), CHECK(expires_at>created_at)
);
CREATE TABLE property_types (
  code text PRIMARY KEY CHECK(code IN ('townhouse','villa','shophouse')), name text NOT NULL
);
CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), location_id uuid NOT NULL REFERENCES locations,
  name text NOT NULL, slug text NOT NULL UNIQUE, description text NOT NULL DEFAULT '', address text NOT NULL,
  coordinates public.geography(Point,4326),
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','suspended','archived')),
  meta_title text, meta_description text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE project_property_types (
  project_id uuid NOT NULL REFERENCES projects, property_type_code text NOT NULL REFERENCES property_types,
  PRIMARY KEY(project_id,property_type_code)
);
CREATE TABLE project_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects,
  organization_id uuid NOT NULL REFERENCES organizations,
  role text NOT NULL CHECK(role IN ('owner','developer','distributor')),
  verification_status text NOT NULL DEFAULT 'pending' CHECK(verification_status IN ('pending','verified','revoked')),
  UNIQUE(project_id,organization_id), UNIQUE(id,organization_id,project_id)
);
CREATE TABLE contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations,
  contract_number text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','suspended','expired','terminated')),
  effective_from timestamptz NOT NULL, effective_until timestamptz NOT NULL, signed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,organization_id), CHECK(effective_until > effective_from),
  CHECK(status <> 'active' OR signed_at IS NOT NULL)
);
CREATE TABLE contract_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), contract_id uuid NOT NULL,
  organization_id uuid NOT NULL, document_type text NOT NULL CHECK(document_type IN ('draft','signed_contract','appendix')),
  private_storage_key text NOT NULL UNIQUE, version int NOT NULL CHECK(version>0),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(contract_id,organization_id) REFERENCES contracts(id,organization_id),
  UNIQUE(contract_id,document_type,version)
);
CREATE TABLE payment_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), contract_id uuid NOT NULL, organization_id uuid NOT NULL,
  amount numeric(20,4) NOT NULL CHECK(amount>0), currency_code char(3) NOT NULL REFERENCES currencies,
  provider text NOT NULL, reference text NOT NULL,
  status text NOT NULL CHECK(status IN ('pending','confirmed','failed','refunded')),
  paid_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider,reference), FOREIGN KEY(contract_id,organization_id) REFERENCES contracts(id,organization_id),
  CHECK(status <> 'confirmed' OR paid_at IS NOT NULL)
);
CREATE TABLE combo_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
  default_sale_limit int NOT NULL CHECK(default_sale_limit>0),
  default_listing_limit int NOT NULL CHECK(default_listing_limit>0), active boolean NOT NULL DEFAULT true
);
CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), contract_id uuid NOT NULL, organization_id uuid NOT NULL,
  combo_plan_id uuid NOT NULL REFERENCES combo_plans,
  sale_limit int NOT NULL CHECK(sale_limit>0), active_listing_limit int NOT NULL CHECK(active_listing_limit>0),
  starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','suspended','expired','cancelled')),
  quota_revision bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(contract_id,organization_id) REFERENCES contracts(id,organization_id),
  UNIQUE(id,organization_id), CHECK(ends_at>starts_at)
);
CREATE TABLE subscription_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), subscription_id uuid NOT NULL, organization_id uuid NOT NULL,
  project_id uuid NOT NULL, project_organization_id uuid NOT NULL,
  valid_from timestamptz NOT NULL, valid_until timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),
  FOREIGN KEY(subscription_id,organization_id) REFERENCES subscriptions(id,organization_id),
  FOREIGN KEY(project_organization_id,organization_id,project_id)
    REFERENCES project_organizations(id,organization_id,project_id),
  UNIQUE(subscription_id,project_id), UNIQUE(id,organization_id,project_id,subscription_id),
  CHECK(valid_until>valid_from)
);
-- Reserved seats count toward the limit even while the invited user has not activated.
CREATE TABLE subscription_seats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL,
  subscription_id uuid NOT NULL, member_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(subscription_id,organization_id) REFERENCES subscriptions(id,organization_id),
  FOREIGN KEY(member_id,organization_id) REFERENCES organization_members(id,organization_id),
  UNIQUE(subscription_id,member_id), UNIQUE(id,organization_id,subscription_id,member_id)
);
CREATE TABLE project_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, project_id uuid NOT NULL,
  subscription_id uuid NOT NULL, member_id uuid NOT NULL, seat_id uuid NOT NULL,
  subscription_project_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(seat_id,organization_id,subscription_id,member_id)
    REFERENCES subscription_seats(id,organization_id,subscription_id,member_id),
  FOREIGN KEY(subscription_project_id,organization_id,project_id,subscription_id)
    REFERENCES subscription_projects(id,organization_id,project_id,subscription_id),
  UNIQUE(member_id,subscription_project_id), UNIQUE(id,organization_id,project_id,subscription_id)
);
CREATE TABLE listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), public_code bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  organization_id uuid NOT NULL, project_id uuid NOT NULL, subscription_id uuid NOT NULL,
  assignment_id uuid NOT NULL, property_type_code text NOT NULL,
  transaction_type text NOT NULL CHECK(transaction_type IN ('sale','rent')),
  slug text NOT NULL CHECK(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text NOT NULL CHECK(char_length(title) BETWEEN 10 AND 200),
  description text NOT NULL CHECK(char_length(description)>=30),
  price_amount numeric(20,4), currency_code char(3) NOT NULL REFERENCES currencies,
  price_basis text NOT NULL CHECK(price_basis IN ('total','per_m2','per_month','per_year')),
  negotiable boolean NOT NULL DEFAULT false, area_m2 numeric(12,2) NOT NULL CHECK(area_m2>0),
  bedrooms smallint CHECK(bedrooms>=0), bathrooms smallint CHECK(bathrooms>=0),
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','pending','published','rejected','hidden','expired','closed')),
  published_at timestamptz, expires_at timestamptz,
  created_by uuid NOT NULL REFERENCES users, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(assignment_id,organization_id,project_id,subscription_id)
    REFERENCES project_assignments(id,organization_id,project_id,subscription_id),
  FOREIGN KEY(project_id,property_type_code) REFERENCES project_property_types,
  UNIQUE(id,organization_id),
  CHECK((negotiable AND price_amount IS NULL) OR (NOT negotiable AND price_amount IS NOT NULL AND price_amount>0)),
  CHECK(transaction_type <> 'sale' OR price_basis IN ('total','per_m2')),
  CHECK(transaction_type <> 'rent' OR price_basis IN ('per_month','per_year')),
  CHECK(status <> 'published' OR (published_at IS NOT NULL AND expires_at IS NOT NULL AND expires_at>published_at))
);
CREATE TABLE media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations,
  uploaded_by uuid NOT NULL REFERENCES users, storage_key text NOT NULL UNIQUE,
  public_url text, mime_type text NOT NULL CHECK(mime_type IN ('image/jpeg','image/png','image/webp','image/avif')),
  byte_size bigint NOT NULL CHECK(byte_size>0), width int NOT NULL CHECK(width>0), height int NOT NULL CHECK(height>0),
  status text NOT NULL DEFAULT 'processing' CHECK(status IN ('processing','ready','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,organization_id),
  CHECK(status <> 'ready' OR public_url IS NOT NULL)
);
CREATE TABLE listing_media (
  listing_id uuid NOT NULL, media_asset_id uuid NOT NULL, organization_id uuid NOT NULL,
  display_order int NOT NULL CHECK(display_order>=0), alt_text text NOT NULL DEFAULT '',
  PRIMARY KEY(listing_id,media_asset_id), UNIQUE(listing_id,display_order),
  FOREIGN KEY(listing_id,organization_id) REFERENCES listings(id,organization_id),
  FOREIGN KEY(media_asset_id,organization_id) REFERENCES media_assets(id,organization_id)
);
CREATE TABLE listing_revisions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, listing_id uuid NOT NULL REFERENCES listings,
  organization_id uuid NOT NULL REFERENCES organizations, changed_by_user_id uuid REFERENCES users,
  snapshot jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE moderation_actions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, listing_id uuid NOT NULL REFERENCES listings,
  organization_id uuid NOT NULL REFERENCES organizations, reviewer_user_id uuid NOT NULL REFERENCES users,
  decision text NOT NULL CHECK(decision IN ('published','rejected','hidden')), reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE contact_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), listing_id uuid NOT NULL, organization_id uuid NOT NULL,
  customer_name text NOT NULL CHECK(char_length(customer_name) BETWEEN 1 AND 120),
  contact_detail text NOT NULL CHECK(char_length(contact_detail) BETWEEN 5 AND 200),
  message text NOT NULL DEFAULT '' CHECK(char_length(message)<=2000),
  consent_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(listing_id,organization_id) REFERENCES listings(id,organization_id)
);
CREATE TABLE articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), author_user_id uuid NOT NULL REFERENCES users,
  category text NOT NULL CHECK(category IN ('news','market_analysis')),
  title text NOT NULL, slug text NOT NULL UNIQUE, body text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
  meta_title text, meta_description text, published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(status <> 'published' OR published_at IS NOT NULL)
);
CREATE TABLE article_projects (
  article_id uuid NOT NULL REFERENCES articles, project_id uuid NOT NULL REFERENCES projects,
  PRIMARY KEY(article_id,project_id)
);
CREATE TABLE seo_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), path text NOT NULL UNIQUE CHECK(path LIKE '/%'),
  transaction_type text CHECK(transaction_type IN ('sale','rent')),
  market_scope text CHECK(market_scope IN ('domestic','international')),
  country_code char(2) REFERENCES countries, location_id uuid,
  property_type_code text REFERENCES property_types,
  meta_title text NOT NULL, meta_description text NOT NULL, introduction text NOT NULL DEFAULT '',
  indexable boolean NOT NULL DEFAULT false,
  FOREIGN KEY(location_id,country_code) REFERENCES locations(id,country_code),
  CHECK(location_id IS NULL OR country_code IS NOT NULL),
  CHECK(market_scope IS DISTINCT FROM 'domestic' OR country_code IS NULL OR country_code='VN'),
  CHECK(market_scope IS DISTINCT FROM 'international' OR country_code IS NULL OR country_code<>'VN')
);
CREATE TABLE redirects (
  source_path text PRIMARY KEY CHECK(source_path LIKE '/%'), target_path text NOT NULL CHECK(target_path LIKE '/%'),
  status_code smallint NOT NULL DEFAULT 301 CHECK(status_code IN (301,308)), CHECK(source_path<>target_path)
);
CREATE TABLE audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor_user_id uuid REFERENCES users,
  organization_id uuid REFERENCES organizations, action text NOT NULL,
  entity_type text NOT NULL, entity_id text NOT NULL, details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE outbox_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, event_type text NOT NULL,
  aggregate_id uuid NOT NULL, payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz,
  attempts int NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(), last_error text
);

CREATE INDEX locations_parent_idx ON locations(parent_id);
CREATE INDEX locations_country_idx ON locations(country_code);
CREATE INDEX aliases_search_idx ON location_aliases USING gin(alias public.gin_trgm_ops);
CREATE INDEX members_user_idx ON organization_members(user_id,organization_id,status);
CREATE INDEX projects_location_idx ON projects(location_id,status);
CREATE INDEX projects_name_idx ON projects USING gin(name public.gin_trgm_ops);
CREATE INDEX projects_geo_idx ON projects USING gist(coordinates);
CREATE INDEX project_org_org_idx ON project_organizations(organization_id);
CREATE INDEX subs_org_status_idx ON subscriptions(organization_id,status,ends_at);
CREATE INDEX grants_project_idx ON subscription_projects(project_id,status);
CREATE INDEX seats_quota_idx ON subscription_seats(subscription_id) WHERE status='active';
CREATE INDEX assignments_member_idx ON project_assignments(member_id,status);
CREATE INDEX assignments_seat_idx ON project_assignments(seat_id);
CREATE INDEX listings_search_idx ON listings(project_id,transaction_type,property_type_code,published_at DESC,id)
  WHERE status='published';
CREATE INDEX listings_quota_idx ON listings(subscription_id,expires_at) WHERE status='published';
CREATE INDEX listings_tenant_idx ON listings(organization_id,status,created_at DESC);
CREATE INDEX listings_assignment_idx ON listings(assignment_id);
CREATE INDEX listings_price_idx ON listings(currency_code,price_basis,price_amount) WHERE status='published';
CREATE INDEX media_org_idx ON media_assets(organization_id,uploaded_by);
CREATE INDEX contacts_org_idx ON contact_requests(organization_id,created_at DESC);
CREATE INDEX contacts_listing_idx ON contact_requests(listing_id);
CREATE INDEX revisions_listing_idx ON listing_revisions(listing_id,created_at DESC);
CREATE INDEX articles_public_idx ON articles(category,published_at DESC) WHERE status='published';
CREATE INDEX outbox_pending_idx ON outbox_events(available_at,id) WHERE processed_at IS NULL;
CREATE INDEX tokens_expiry_idx ON bds_private.user_tokens(expires_at) WHERE consumed_at IS NULL;

CREATE FUNCTION touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at=clock_timestamp(); RETURN NEW; END $$;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['users','organizations','organization_members','agent_profiles','projects','contracts','subscriptions','listings','articles'] LOOP
    EXECUTE format('CREATE TRIGGER touch_updated_at BEFORE UPDATE ON bds.%I FOR EACH ROW EXECUTE FUNCTION bds.touch_updated_at()',t);
  END LOOP;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA bds,bds_private FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA bds FROM PUBLIC;
COMMIT;
