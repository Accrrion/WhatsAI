// Shared HTTP + tenancy helpers. All business data is scoped to the authenticated
// Qoder user (owner_user_id) or, for the public WhatsApp webhook, to the business
// that owns the receiving phone number. Client-supplied ids are never trusted.
import { requireUser, getUser, UserContextError } from "./auth.mjs";

export { requireUser, getUser, UserContextError };

export const nowIso = () => new Date().toISOString();
export const newId = () => crypto.randomUUID();

const NO_STORE = { "cache-control": "no-store" };

export function ok(data = {}) {
  return Response.json({ ok: true, ...data }, { headers: NO_STORE });
}

export function fail(code, status = 400, extra = {}) {
  return Response.json({ ok: false, error: code, ...extra }, { status, headers: NO_STORE });
}

// Wrap a route handler: maps thrown UserContextError + known app errors to safe
// responses, and never leaks raw provider/DB details.
export function route(fn) {
  return async (ctx) => {
    try {
      return await fn(ctx);
    } catch (error) {
      if (error instanceof UserContextError) return fail(error.code, error.status);
      if (error && error.appError) return fail(error.appError, error.status || 400);
      // Unknown failures become a fixed 503 without raw details.
      return fail("service_unavailable", 503);
    }
  };
}

export function appError(code, status = 400) {
  const e = new Error(code);
  e.appError = code;
  e.status = status;
  return e;
}

export async function readJson(request, maxBytes = 256 * 1024) {
  if (request.method === "GET" || request.method === "HEAD") return {};
  const length = Number(request.headers.get("content-length") || 0);
  if (length && length > maxBytes) throw appError("payload_too_large", 413);
  let text;
  try {
    text = await request.text();
  } catch {
    throw appError("invalid_body", 400);
  }
  if (!text) return {};
  if (text.length > maxBytes) throw appError("payload_too_large", 413);
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw appError("invalid_body", 400);
    return parsed;
  } catch (e) {
    if (e.appError) throw e;
    throw appError("invalid_body", 400);
  }
}

// ---- validation primitives -------------------------------------------------
export function str(value, { max = 500, required = false, fallback = "" } = {}) {
  if (value === undefined || value === null) {
    if (required) throw appError("invalid_field", 400);
    return fallback;
  }
  if (typeof value !== "string") throw appError("invalid_field", 400);
  const trimmed = value.trim();
  if (required && !trimmed) throw appError("invalid_field", 400);
  if (trimmed.length > max) throw appError("invalid_field", 400);
  return trimmed;
}

export function optStr(value, max = 2000) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw appError("invalid_field", 400);
  const trimmed = value.trim();
  if (trimmed.length > max) throw appError("invalid_field", 400);
  return trimmed;
}

export function int(value, { min = -1e15, max = 1e15, required = false, fallback = 0 } = {}) {
  if (value === undefined || value === null) {
    if (required) throw appError("invalid_field", 400);
    return fallback;
  }
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isSafeInteger(n) || n < min || n > max) throw appError("invalid_field", 400);
  return n;
}

export function bool(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  throw appError("invalid_field", 400);
}

export function oneOf(value, allowed, { required = false, fallback = null } = {}) {
  if (value === undefined || value === null) {
    if (required) throw appError("invalid_field", 400);
    return fallback;
  }
  if (typeof value !== "string" || !allowed.includes(value)) throw appError("invalid_field", 400);
  return value;
}

export function uuid(value, field = "id") {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw appError("invalid_field", 400);
  }
  return value;
}

export function json(value, fallback = null) {
  if (value === undefined) return fallback;
  if (value === null) return null;
  if (typeof value !== "object") throw appError("invalid_field", 400);
  return value;
}

// ---- tenancy ---------------------------------------------------------------
const BUSINESS_COLUMNS = "id,owner_user_id,name,business_type,description,location,phone,email,website,social_links,currency,onboarding_step,created_at,updated_at";

// Resolve the single business owned by the authenticated user. Returns null when
// the user has not created one yet. Never accepts a client-supplied business id.
export async function getBusinessForUser(supabase, userId) {
  const { data, error } = await supabase
    .from("businesses")
    .select(BUSINESS_COLUMNS)
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw appError("db_error", 503);
  return data && data.length ? data[0] : null;
}

// Require an owned business or 404. Used by every tenant-scoped route.
export async function requireBusiness(supabase, userId) {
  const business = await getBusinessForUser(supabase, userId);
  if (!business) throw appError("business_not_found", 404);
  return business;
}

export async function getBusinessById(supabase, businessId) {
  const { data, error } = await supabase
    .from("businesses")
    .select(BUSINESS_COLUMNS)
    .eq("id", businessId)
    .maybeSingle();
  if (error) throw appError("db_error", 503);
  return data || null;
}

// Verify a child record belongs to the business; returns the row or throws 404.
export async function ownedRecord(supabase, table, id, businessId, columns = "*") {
  const { data, error } = await supabase
    .from(table)
    .select(columns)
    .eq("id", id)
    .eq("business_id", businessId)
    .maybeSingle();
  if (error) throw appError("db_error", 503);
  if (!data) throw appError("not_found", 404);
  return data;
}

export function parseSocialLinks(value) {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) throw appError("invalid_field", 400);
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof k !== "string" || k.length > 40) continue;
    if (typeof v === "string" && v.length <= 500) out[k] = v.trim();
  }
  return out;
}
