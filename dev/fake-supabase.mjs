// In-memory Supabase fake for LOCAL logic testing only. Supports the query
// patterns used by the Function. Not a database, not deployed, no credentials.
const UNIQUE = new Set(["webhook_events.event_id", "customers.dedupe_key", "businesses.owner_user_id"]);

function matchesFilters(row, filters) {
  for (const f of filters) {
    const v = row[f.col];
    if (f.op === "eq" && v !== f.val) return false;
    if (f.op === "in" && !f.val.includes(v)) return false;
    if (f.op === "gte" && !(v >= f.val)) return false;
  }
  return true;
}

class Builder {
  constructor(store, table) { this.store = store; this.table = table; this.filters = []; this.op = "select"; this.orderCol = null; this.orderAsc = false; this.limitN = null; this.mode = null; this.countMode = false; this.patch = null; this.rows = null; }
  select(cols, opts) { if (opts && opts.count === "exact") this.countMode = true; return this; }
  insert(rows) { this.op = "insert"; this.rows = Array.isArray(rows) ? rows : [rows]; return this; }
  update(patch) { this.op = "update"; this.patch = patch; return this; }
  delete() { this.op = "delete"; return this; }
  eq(col, val) { this.filters.push({ col, op: "eq", val }); return this; }
  in(col, val) { this.filters.push({ col, op: "in", val }); return this; }
  gte(col, val) { this.filters.push({ col, op: "gte", val }); return this; }
  order(col, opts) { this.orderCol = col; this.orderAsc = opts?.ascending !== false; return this; }
  limit(n) { this.limitN = n; return this; }
  single() { this.mode = "single"; return this; }
  maybeSingle() { this.mode = "maybeSingle"; return this; }
  then(resolve, reject) { return Promise.resolve(this._exec()).then(resolve, reject); }
  _table() { if (!this.store.has(this.table)) this.store.set(this.table, []); return this.store.get(this.table); }
  _exec() {
    const t = this._table();
    if (this.op === "insert") {
      const inserted = [];
      for (const r of this.rows) {
        for (const u of UNIQUE) {
          const [tb, col] = u.split(".");
          if (tb === this.table && t.some((x) => x[col] === r[col])) return { data: null, error: { code: "23505", message: "duplicate key" } };
        }
        t.push(r); inserted.push(r);
      }
      return this._result(inserted);
    }
    const idx = [];
    t.forEach((row, i) => { if (matchesFilters(row, this.filters)) idx.push(i); });
    if (this.op === "update") {
      const updated = [];
      for (const i of idx) { t[i] = { ...t[i], ...this.patch }; updated.push(t[i]); }
      return this._result(updated);
    }
    if (this.op === "delete") {
      const deleted = [];
      for (const i of [...idx].reverse()) { deleted.push(t[i]); t.splice(i, 1); }
      return this._result(deleted.reverse());
    }
    let rows = idx.map((i) => t[i]);
    if (this.orderCol) rows = [...rows].sort((a, b) => (a[this.orderCol] > b[this.orderCol] ? 1 : -1) * (this.orderAsc ? 1 : -1));
    const total = rows.length;
    if (this.limitN != null) rows = rows.slice(0, this.limitN);
    if (this.countMode) return { data: rows, error: null, count: total };
    return this._result(rows);
  }
  _result(rows) {
    if (this.mode === "single") {
      if (rows.length !== 1) return { data: null, error: { code: "PGRST116", message: "expected 1 row" } };
      return { data: rows[0], error: null };
    }
    if (this.mode === "maybeSingle") return { data: rows.length ? rows[0] : null, error: null };
    return { data: rows, error: null };
  }
}

export function createFakeSupabase() {
  const store = new Map();
  return { from: (table) => new Builder(store, table), _store: store };
}
