/**
 * Minimal Supabase-compatible query builder backed by Railway Postgres (node-postgres).
 *
 * It implements only the subset of the supabase-js API used by this project so the
 * existing bot code can run unchanged on Railway:
 *   .from().select().eq().neq().gt().gte().lt().lte().in().is().ilike()
 *   .order().limit().single().maybeSingle()
 *   .insert().upsert().update().delete()
 *   .select("*, systems!inner(col)")  → inner join embed
 *   .select("id", { count: "exact", head: true })
 */
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Add the Railway Postgres connection string.");
}

// SSL: honour ?sslmode= / PGSSLMODE, otherwise enable it for non-local hosts.
const sslMode = (connectionString.match(/[?&]sslmode=([^&]+)/)?.[1] || process.env.PGSSLMODE || "").toLowerCase();
const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])|\.railway\.internal|host=\/|@\//.test(connectionString);
const needsSsl = sslMode ? sslMode !== "disable" : !isLocal;

export const pool = new pg.Pool({
  connectionString,
  max: Number(process.env.PG_POOL_MAX || 8),
  ssl: needsSsl ? { rejectUnauthorized: false } : false,
});


pool.on("error", (err) => console.error("pg pool error:", err.message));

// Maps an embedded table name to the foreign key column on the base table.
const FK_MAP: Record<string, string> = {
  systems: "system_id",
};

type Filter = { col: string; op: string; val: any };

function ident(name: string) {
  return '"' + name.replace(/"/g, "") + '"';
}

class QueryBuilder<T = any> implements PromiseLike<{ data: any; error: any; count?: number | null }> {
  private op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private selectStr = "*";
  private hasSelect = false;
  private filters: Filter[] = [];
  private orderBy: { col: string; asc: boolean }[] = [];
  private limitN: number | null = null;
  private rows: any[] = [];
  private patch: any = null;
  private conflictCols: string[] = [];
  private wantSingle = false;
  private allowNull = false;
  private countMode = false;
  private headMode = false;

  constructor(private table: string) {}

  select(cols = "*", opts?: { count?: string; head?: boolean }) {
    this.selectStr = cols || "*";
    this.hasSelect = true;
    if (opts?.count) this.countMode = true;
    if (opts?.head) this.headMode = true;
    return this;
  }
  insert(values: any) {
    this.op = "insert";
    this.rows = Array.isArray(values) ? values : [values];
    return this;
  }
  upsert(values: any, opts?: { onConflict?: string }) {
    this.op = "upsert";
    this.rows = Array.isArray(values) ? values : [values];
    this.conflictCols = (opts?.onConflict || "")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    return this;
  }
  update(patch: any) {
    this.op = "update";
    this.patch = patch;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }

  eq(col: string, val: any) { this.filters.push({ col, op: "=", val }); return this; }
  neq(col: string, val: any) { this.filters.push({ col, op: "<>", val }); return this; }
  gt(col: string, val: any) { this.filters.push({ col, op: ">", val }); return this; }
  gte(col: string, val: any) { this.filters.push({ col, op: ">=", val }); return this; }
  lt(col: string, val: any) { this.filters.push({ col, op: "<", val }); return this; }
  lte(col: string, val: any) { this.filters.push({ col, op: "<=", val }); return this; }
  like(col: string, val: any) { this.filters.push({ col, op: "LIKE", val }); return this; }
  ilike(col: string, val: any) { this.filters.push({ col, op: "ILIKE", val }); return this; }
  is(col: string, val: any) { this.filters.push({ col, op: "IS", val }); return this; }
  in(col: string, vals: any[]) { this.filters.push({ col, op: "IN", val: vals }); return this; }

  order(col: string, opts?: { ascending?: boolean }) {
    this.orderBy.push({ col, asc: opts?.ascending !== false });
    return this;
  }
  limit(n: number) { this.limitN = n; return this; }
  single() { this.wantSingle = true; this.allowNull = false; return this; }
  maybeSingle() { this.wantSingle = true; this.allowNull = true; return this; }

  private buildWhere(params: any[], alias = "t") {
    if (this.filters.length === 0) return "";
    const parts = this.filters.map((f) => {
      const col = `${alias}.${ident(f.col)}`;
      if (f.op === "IS") return `${col} IS ${f.val === null ? "NULL" : f.val ? "TRUE" : "FALSE"}`;
      if (f.op === "IN") {
        params.push(f.val);
        return `${col} = ANY($${params.length})`;
      }
      params.push(f.val);
      return `${col} ${f.op} $${params.length}`;
    });
    return " WHERE " + parts.join(" AND ");
  }

  private buildSelectSql(params: any[]) {
    const raw = this.selectStr;
    const embedRe = /(\w+)!inner\(([^)]*)\)/g;
    const embeds: { table: string; cols: string[] }[] = [];
    let m: RegExpExecArray | null;
    while ((m = embedRe.exec(raw))) {
      embeds.push({ table: m[1], cols: m[2].split(",").map((c) => c.trim()).filter(Boolean) });
    }
    const baseCols = raw
      .replace(embedRe, "")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);

    if (this.headMode || this.countMode) {
      let sql = `SELECT count(*)::int AS count FROM ${ident(this.table)} t`;
      embeds.forEach((e, i) => {
        const fk = FK_MAP[e.table] || `${e.table.replace(/s$/, "")}_id`;
        sql += ` INNER JOIN ${ident(e.table)} j${i} ON j${i}.id = t.${ident(fk)}`;
      });
      sql += this.buildWhere(params);
      return sql;
    }

    const cols: string[] = [];
    if (baseCols.length === 0 || baseCols.includes("*")) cols.push("t.*");
    for (const c of baseCols) if (c !== "*") cols.push(`t.${ident(c)}`);

    let joins = "";
    embeds.forEach((e, i) => {
      const fk = FK_MAP[e.table] || `${e.table.replace(/s$/, "")}_id`;
      joins += ` INNER JOIN ${ident(e.table)} j${i} ON j${i}.id = t.${ident(fk)}`;
      const obj = e.cols.length
        ? e.cols.map((c) => `'${c}', j${i}.${ident(c)}`).join(", ")
        : null;
      cols.push(obj ? `json_build_object(${obj}) AS ${ident(e.table)}` : `to_jsonb(j${i}.*) AS ${ident(e.table)}`);
    });

    let sql = `SELECT ${cols.join(", ")} FROM ${ident(this.table)} t${joins}`;
    sql += this.buildWhere(params);
    if (this.orderBy.length) {
      sql += " ORDER BY " + this.orderBy.map((o) => `t.${ident(o.col)} ${o.asc ? "ASC" : "DESC"}`).join(", ");
    }
    if (this.limitN != null) sql += ` LIMIT ${Number(this.limitN)}`;
    return sql;
  }

  private buildSql(): { sql: string; params: any[] } {
    const params: any[] = [];

    if (this.op === "select") {
      return { sql: this.buildSelectSql(params), params };
    }

    if (this.op === "insert" || this.op === "upsert") {
      const keys = Array.from(new Set(this.rows.flatMap((r) => Object.keys(r))));
      const values = this.rows
        .map(
          (r) =>
            "(" +
            keys
              .map((k) => {
                params.push(r[k] === undefined ? null : r[k]);
                return `$${params.length}`;
              })
              .join(", ") +
            ")",
        )
        .join(", ");
      let sql = `INSERT INTO ${ident(this.table)} (${keys.map(ident).join(", ")}) VALUES ${values}`;
      if (this.op === "upsert") {
        const conflict = this.conflictCols.length ? this.conflictCols : ["id"];
        const updates = keys.filter((k) => !conflict.includes(k));
        sql += ` ON CONFLICT (${conflict.map(ident).join(", ")}) DO ${
          updates.length
            ? "UPDATE SET " + updates.map((k) => `${ident(k)} = EXCLUDED.${ident(k)}`).join(", ")
            : "NOTHING"
        }`;
      }
      return { sql: sql + " RETURNING *", params };
    }

    if (this.op === "update") {
      const keys = Object.keys(this.patch || {});
      const sets = keys
        .map((k) => {
          params.push(this.patch[k] === undefined ? null : this.patch[k]);
          return `${ident(k)} = $${params.length}`;
        })
        .join(", ");
      const sql = `UPDATE ${ident(this.table)} t SET ${sets}${this.buildWhere(params)} RETURNING *`;
      return { sql, params };
    }

    const sql = `DELETE FROM ${ident(this.table)} t${this.buildWhere(params)} RETURNING *`;
    return { sql, params };
  }

  async run() {
    const { sql, params } = this.buildSql();
    try {
      const res = await pool.query(sql, params);

      if (this.op === "select" && (this.headMode || this.countMode)) {
        const count = res.rows[0]?.count ?? 0;
        return { data: this.headMode ? null : res.rows, error: null, count };
      }

      let rows = res.rows;
      // JSON columns coming back from json_build_object are already objects.
      if (this.wantSingle) {
        if (rows.length === 0) {
          if (this.allowNull) return { data: null, error: null, count: null };
          return { data: null, error: { message: "No rows found" }, count: null };
        }
        return { data: rows[0], error: null, count: rows.length };
      }
      if ((this.op === "insert" || this.op === "upsert" || this.op === "update" || this.op === "delete") && !this.hasSelect) {
        return { data: null, error: null, count: rows.length };
      }
      return { data: rows, error: null, count: rows.length };
    } catch (err: any) {
      console.error(`[db] ${this.table} ${this.op} failed: ${err.message}\nSQL: ${sql}`);
      return { data: null, error: { message: err.message }, count: null };
    }
  }

  then<TR1 = any, TR2 = never>(
    onfulfilled?: ((value: { data: any; error: any; count?: number | null }) => TR1 | PromiseLike<TR1>) | null,
    onrejected?: ((reason: any) => TR2 | PromiseLike<TR2>) | null,
  ): PromiseLike<TR1 | TR2> {
    return this.run().then(onfulfilled as any, onrejected as any);
  }
}

export const supabase = {
  from(table: string) {
    return new QueryBuilder(table);
  },
  async rpc(fn: string, args: Record<string, any> = {}) {
    const keys = Object.keys(args);
    const params = keys.map((k) => args[k]);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
    try {
      const res = await pool.query(`SELECT * FROM ${ident(fn)}(${placeholders})`, params);
      return { data: res.rows, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message } };
    }
  },
};

export default supabase;
