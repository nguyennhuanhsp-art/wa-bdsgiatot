import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PGlite } from "@electric-sql/pglite";
import { postgis } from "@electric-sql/pglite-postgis";
import { Pool } from "pg";
import fs from "node:fs";
import path from "node:path";
import { seedDemo } from "./seed";
export const ROOT = path.resolve(__dirname, "../../..");
export type Runner = {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>;
};
export type DBRole = "bdsgiatot_api" | "bdsgiatot_auth" | "bdsgiatot_worker";
@Injectable()
export class Database implements OnModuleInit, OnModuleDestroy {
  local?: PGlite;
  pools: Partial<Record<DBRole, Pool>> = {};
  readonly demo = !process.env.DATABASE_API_URL;
  readonly hostedDemo = process.env.APP_MODE === 'hosted-demo';
  async onModuleInit() {
    if (this.hostedDemo) {
      if (!this.demo) throw new Error('Hosted demo must never connect to a production database.');
      if (!process.env.DEMO_ACCESS_USER || (process.env.DEMO_ACCESS_PASSWORD?.length || 0) < 32) throw new Error('Hosted demo requires strong access credentials.');
      if (!process.env.APP_ORIGIN?.startsWith('https://') || process.env.COOKIE_SECURE !== 'true') throw new Error('Hosted demo requires HTTPS origin and Secure cookies.');
    }
    if (this.demo) {
      if (
        process.env.NODE_ENV === "production" &&
        process.env.APP_MODE !== "local-demo" && !this.hostedDemo
      )
        throw new Error(
          "Production requires separate PostgreSQL API/auth/worker connection URLs.",
        );
      fs.mkdirSync(path.join(ROOT, ".local"), { recursive: true });
      const { pg_trgm } = await import("@electric-sql/pglite/contrib/pg_trgm");
      this.local = new PGlite(path.join(ROOT, ".local", "app-db"), {
        extensions: { postgis, pg_trgm },
      });
      await this.local.waitReady;
      const exists = await this.local.query(
        "SELECT 1 FROM pg_namespace WHERE nspname='bds'",
      );
      if (!exists.rows.length)
        for (const f of [
          "001_schema.sql",
          "002_business_rules.sql",
          "003_security.sql",
          "004_seed_catalogs.sql",
        ])
          await this.local.exec(
            fs.readFileSync(path.join(ROOT, "sql", f), "utf8"),
          );
      if (
        !(await this.local.query("SELECT id FROM bds.users LIMIT 1")).rows
          .length
      )
        await this.local.transaction(async (t) => seedDemo(t as any));
    } else {
      for (const [role, key] of [
        ["bdsgiatot_api", "DATABASE_API_URL"],
        ["bdsgiatot_auth", "DATABASE_AUTH_URL"],
        ["bdsgiatot_worker", "DATABASE_WORKER_URL"],
      ] as const) {
        if (!process.env[key]) throw new Error(`Missing ${key}`);
        this.pools[role] = new Pool({
          connectionString: process.env[key],
          max: 10,
        });
        const check = await this.pools[role]!.query('SELECT current_user,rolsuper,rolbypassrls,pg_has_role(current_user,$1,\'member\') AS correct_role FROM pg_roles WHERE rolname=current_user',[role]);
        const current = check.rows[0];
        if (!current || current.rolsuper || current.rolbypassrls || !current.correct_role) throw new Error(`Unsafe database runtime role for ${role}`);
      }
    }
    console.log(
      this.demo
        ? "Local demo database ready (persistent on disk)."
        : "PostgreSQL connections ready.",
    );
  }
  async using<T>(
    actor: string | null,
    role: DBRole,
    fn: (db: Runner) => Promise<T>,
  ): Promise<T> {
    if (this.local)
      return this.local.transaction(async (tx) => {
        await tx.exec(`SET LOCAL ROLE ${role}`);
        await tx.query("SELECT set_config('app.user_id',$1,true)", [
          actor || "",
        ]);
        return fn(tx as any);
      });
    const c = await this.pools[role]!.connect();
    try {
      await c.query("BEGIN");
      await c.query("SELECT set_config('app.user_id',$1,true)", [actor || ""]);
      const r = await fn(c);
      await c.query("COMMIT");
      return r;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
  api<T>(actor: string | null, fn: (db: Runner) => Promise<T>) {
    return this.using(actor, "bdsgiatot_api", fn);
  }
  auth<T>(actor: string | null, fn: (db: Runner) => Promise<T>) {
    return this.using(actor, "bdsgiatot_auth", fn);
  }
  async onModuleDestroy() {
    await this.local?.close();
    await Promise.all(Object.values(this.pools).map((p) => p.end()));
  }
}
