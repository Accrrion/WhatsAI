-- WhatsAI initial schema (Qoder Sites migration subset).
-- Constraints: uuid/text/boolean/integer/bigint/timestamptz/jsonb only.
-- No foreign keys, no DEFAULT/CHECK, no arrays. IDs/timestamps set in the Function.
-- Tenant isolation is enforced in the Function (owner_user_id / business_id scoping);
-- access policies grant the anonymous Function adapter the CRUD it needs.

CREATE TABLE app.businesses (
  id uuid PRIMARY KEY,
  owner_user_id text NOT NULL UNIQUE,
  name text NOT NULL,
  business_type text,
  description text,
  location text,
  phone text,
  email text,
  website text,
  social_links jsonb,
  currency text,
  onboarding_step integer,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE INDEX businesses_owner_idx ON app.businesses (owner_user_id);

CREATE TABLE app.business_hours (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL,
  day text NOT NULL,
  is_open boolean NOT NULL,
  open_time text,
  close_time text
);
CREATE INDEX business_hours_biz_idx ON app.business_hours (business_id);

CREATE TABLE app.policies (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL,
  kind text NOT NULL,
  body text
);
CREATE INDEX policies_biz_idx ON app.policies (business_id);

CREATE TABLE app.faqs (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE INDEX faqs_biz_idx ON app.faqs (business_id);

CREATE TABLE app.products (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  price bigint,
  currency text,
  category text,
  stock_status text,
  sku text,
  image_url text,
  variants jsonb,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE INDEX products_biz_idx ON app.products (business_id);

CREATE TABLE app.services (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  price bigint,
  currency text,
  duration_minutes integer,
  availability text,
  created_at timestamptz NOT NULL
);
CREATE INDEX services_biz_idx ON app.services (business_id);

CREATE TABLE app.ai_configs (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL UNIQUE,
  assistant_name text,
  tone text,
  language text,
  welcome_message text,
  fallback_message text,
  response_length text,
  handoff_behavior text,
  is_active boolean NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE app.whatsapp_accounts (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL UNIQUE,
  phone_number_id text,
  waba_id text,
  display_phone text,
  status text NOT NULL,
  connected_at timestamptz,
  updated_at timestamptz NOT NULL
);
CREATE INDEX whatsapp_phone_idx ON app.whatsapp_accounts (phone_number_id);

CREATE TABLE app.customers (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL,
  dedupe_key text NOT NULL UNIQUE,
  wa_id text,
  name text,
  phone text,
  email text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE INDEX customers_biz_idx ON app.customers (business_id);

CREATE TABLE app.conversations (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  status text NOT NULL,
  mode text NOT NULL,
  tags jsonb,
  last_message text,
  last_message_at timestamptz,
  unread integer,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE INDEX conversations_biz_idx ON app.conversations (business_id);
CREATE INDEX conversations_customer_idx ON app.conversations (customer_id);

CREATE TABLE app.messages (
  id uuid PRIMARY KEY,
  conversation_id uuid NOT NULL,
  business_id uuid NOT NULL,
  direction text NOT NULL,
  sender text NOT NULL,
  body text NOT NULL,
  status text,
  wa_message_id text,
  created_at timestamptz NOT NULL
);
CREATE INDEX messages_conv_idx ON app.messages (conversation_id);
CREATE INDEX messages_biz_idx ON app.messages (business_id);
CREATE INDEX messages_wamid_idx ON app.messages (wa_message_id);

CREATE TABLE app.conversation_notes (
  id uuid PRIMARY KEY,
  conversation_id uuid NOT NULL,
  business_id uuid NOT NULL,
  author text,
  body text NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE INDEX conversation_notes_conv_idx ON app.conversation_notes (conversation_id);

CREATE TABLE app.leads (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL,
  customer_id uuid,
  name text,
  phone text,
  email text,
  interest text,
  product text,
  source text,
  status text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE INDEX leads_biz_idx ON app.leads (business_id);

CREATE TABLE app.orders (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL,
  customer_id uuid,
  status text NOT NULL,
  total bigint,
  currency text,
  delivery_address text,
  payment_status text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE INDEX orders_biz_idx ON app.orders (business_id);

CREATE TABLE app.order_items (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL,
  business_id uuid NOT NULL,
  product_id uuid,
  name text NOT NULL,
  quantity integer NOT NULL,
  unit_price bigint
);
CREATE INDEX order_items_order_idx ON app.order_items (order_id);

CREATE TABLE app.webhook_events (
  id uuid PRIMARY KEY,
  business_id uuid,
  event_id text NOT NULL UNIQUE,
  kind text,
  payload jsonb,
  processed boolean NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE app.ai_interactions (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL,
  conversation_id uuid,
  intent text,
  mode text,
  model text,
  prompt_tokens integer,
  completion_tokens integer,
  estimated_cost_micro integer,
  created_at timestamptz NOT NULL
);
CREATE INDEX ai_interactions_biz_idx ON app.ai_interactions (business_id);
