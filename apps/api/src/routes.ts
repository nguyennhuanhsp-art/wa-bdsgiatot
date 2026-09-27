import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Query,
  Param,
  Req,
  Res,
  Inject,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  HttpException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request, Response } from "express";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import argon2 from "argon2";
import sharp from "sharp";
import { z } from "zod";
import { Database, ROOT } from "./database";
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
const uuid = z.string().uuid();
const parse = <T>(s: z.ZodType<T>, v: unknown): T => {
  const r = s.safeParse(v);
  if (!r.success)
    throw new BadRequestException(
      r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    );
  return r.data;
};
@Controller()
export class ApiController {
  constructor(@Inject(Database) private db: Database) {}
  async user(req: Request, required = true) {
    const token = req.cookies?.bds_session;
    const u = token
      ? await this.db.auth(
          null,
          async (q) =>
            (
              await q.query(
                "SELECT u.id,u.email,u.display_name,u.platform_role FROM bds_private.user_tokens t JOIN bds.users u ON u.id=t.user_id WHERE t.token_hash=$1 AND t.purpose='refresh' AND t.consumed_at IS NULL AND t.expires_at>now() AND u.status='active'",
                [digest(token)],
              )
            ).rows[0],
        )
      : null;
    if (!u && required) throw new UnauthorizedException("Vui lòng đăng nhập.");
    return u || null;
  }
  async session(id: string, res: Response) {
    const token = randomBytes(32).toString("base64url");
    await this.db.auth(null, (q) =>
      q.query(
        "INSERT INTO bds_private.user_tokens(user_id,purpose,token_hash,expires_at) VALUES($1,'refresh',$2,now()+interval '12 hours')",
        [id, digest(token)],
      ),
    );
    res.cookie("bds_session", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.COOKIE_SECURE === "true",
      maxAge: 12 * 60 * 60 * 1000,
      path: "/",
    });
    return { ok: true };
  }
  @Get("health") health() {
    return { ok: true, demo: this.db.demo };
  }
  @Get("catalog") catalog() {
    return this.db.api(null, async (q) => ({
      countries: (await q.query("SELECT * FROM bds.countries ORDER BY name"))
        .rows,
      types: (await q.query("SELECT * FROM bds.property_types")).rows,
    }));
  }
  @Get("listings") listings(@Query() f: any) {
    return this.db.api(null, async (q) => {
      const p: any[] = [];
      const where: string[] = [];
      const add = (sql: string, v: any) => {
        p.push(v);
        where.push(sql.replace("?", `$${p.length}`));
      };
      if (f.transaction && ["sale", "rent"].includes(f.transaction))
        add("l.transaction_type=?", f.transaction);
      if (f.market && ["domestic", "international"].includes(f.market))
        add("l.market_scope=?", f.market);
      if (f.country) add("l.country_code=?", String(f.country).slice(0, 2));
      if (f.type) add("l.property_type_code=?", f.type);
      if (f.project) add("l.project_slug=?", String(f.project).slice(0, 200));
      if (f.q)
        add(
          "(l.project_name||' '||l.title||' '||COALESCE(loc.name,'')) ILIKE ?",
          `%${String(f.q)
            .slice(0, 100)
            .replace(/[%_\\]/g, "")}%`,
        );
      const sort =
        f.sort === "price_asc"
          ? "l.price_amount ASC NULLS LAST"
          : f.sort === "price_desc"
            ? "l.price_amount DESC NULLS LAST"
            : "l.published_at DESC,l.public_code DESC";
      const page = Math.max(1, Math.min(100, Number(f.page) || 1));
      const base = `FROM bds.public_listings l LEFT JOIN bds.locations loc ON loc.id=l.location_id ${where.length ? "WHERE " + where.join(" AND ") : ""}`;
      const total = Number(
        (await q.query(`SELECT count(*) ${base}`, p)).rows[0].count,
      );
      const rows = (
        await q.query(
          `SELECT l.*,loc.name city,(SELECT public_url FROM bds.public_listing_media m WHERE m.listing_id=l.id ORDER BY display_order LIMIT 1) image ${base} ORDER BY ${sort} LIMIT 12 OFFSET ${(page - 1) * 12}`,
          p,
        )
      ).rows;
      return { rows, total, page };
    });
  }
  @Get("projects") projects() {
    return this.db.api(
      null,
      async (q) =>
        (
          await q.query(
            "SELECT p.*,loc.name city,c.name country_name,(SELECT public_url FROM bds.public_listing_media m JOIN bds.public_listings l ON l.id=m.listing_id WHERE l.project_id=p.id ORDER BY l.public_code,m.display_order LIMIT 1) image,(SELECT count(*) FROM bds.public_listings l WHERE l.project_id=p.id) listing_count FROM bds.public_projects p JOIN bds.locations loc ON loc.id=p.location_id JOIN bds.countries c ON c.code=p.country_code ORDER BY CASE WHEN p.country_code='VN' THEN 0 ELSE 1 END,p.name",
          )
        ).rows,
    );
  }
  @Get("projects/:slug") project(@Param("slug") slug: string) {
    return this.db.api(null, async (q) => {
      const row = (
        await q.query(
          "SELECT p.*,loc.name city FROM bds.public_projects p JOIN bds.locations loc ON loc.id=p.location_id WHERE p.slug=$1",
          [slug],
        )
      ).rows[0];
      if (!row) throw new NotFoundException();
      return row;
    });
  }
  @Get("listings/:code") listing(@Param("code") code: string) {
    return this.db.api(null, async (q) => {
      if (!/^\d+$/.test(code)) throw new NotFoundException();
      const row = (
        await q.query(
          "SELECT l.*,loc.name city FROM bds.public_listings l JOIN bds.locations loc ON loc.id=l.location_id WHERE public_code=$1",
          [code],
        )
      ).rows[0];
      if (!row) throw new NotFoundException();
      return {
        ...row,
        images: (
          await q.query(
            "SELECT * FROM bds.public_listing_media WHERE listing_id=$1 ORDER BY display_order",
            [row.id],
          )
        ).rows,
        contact: (
          await q.query(
            "SELECT * FROM bds.public_listing_contacts WHERE listing_id=$1",
            [row.id],
          )
        ).rows[0],
      };
    });
  }
  @Get("articles") articles(@Query("category") category: string) {
    return this.db.api(
      null,
      async (q) =>
        (
          await q.query(
            "SELECT * FROM bds.public_articles WHERE ($1::text IS NULL OR category=$1) ORDER BY published_at DESC",
            [category || null],
          )
        ).rows,
    );
  }
  @Get("articles/:slug") article(@Param("slug") slug: string) {
    return this.db.api(null, async (q) => {
      const r = (
        await q.query("SELECT * FROM bds.public_articles WHERE slug=$1", [slug])
      ).rows[0];
      if (!r) throw new NotFoundException();
      return r;
    });
  }
  @Get("directory") directory() {
    return this.db.api(null, async (q) => ({
      organizations: (
        await q.query(
          "SELECT * FROM bds.public_organizations ORDER BY legal_name",
        )
      ).rows,
      agents: (
        await q.query("SELECT * FROM bds.public_agents ORDER BY display_name")
      ).rows,
    }));
  }
  @Post("contact") contact(@Body() body: any) {
    if(this.db.hostedDemo) throw new BadRequestException("Bản demo chia sẻ không tiếp nhận thông tin liên hệ. Vui lòng chỉ trải nghiệm bằng dữ liệu mẫu.");
    const d = parse(
      z.object({
        listing_id: uuid,
        name: z.string().trim().min(2).max(100),
        contact: z.string().trim().min(7).max(150),
        message: z.string().trim().max(2000),
        consent: z.literal(true),
      }),
      body,
    );
    return this.db.api(null, async (q) => {
      await q.query("SELECT bds.record_contact($1,$2,$3,$4,$5)", [
        d.listing_id,
        d.name,
        d.contact,
        d.message,
        d.consent,
      ]);
      return { ok: true };
    });
  }
  @Post("auth/login") async login(
    @Body() body: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const d = parse(
      z.object({ email: z.email(), password: z.string().min(1).max(200) }),
      body,
    );
    const u = await this.db.auth(
      null,
      async (q) =>
        (
          await q.query(
            "SELECT u.id,c.password_hash FROM bds.users u JOIN bds_private.auth_credentials c ON c.user_id=u.id WHERE u.email=lower($1) AND u.status='active'",
            [d.email],
          )
        ).rows[0],
    );
    if (!u || !(await argon2.verify(u.password_hash, d.password)))
      throw new UnauthorizedException("Email hoặc mật khẩu chưa đúng.");
    return this.session(u.id, res);
  }
  @Post("auth/demo") async demo(
    @Body() body: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!this.db.demo) throw new NotFoundException();
    const role = parse(
      z.enum(["sale", "company", "admin", "other"]),
      body.role,
    );
    const u = await this.db.auth(
      null,
      async (q) =>
        (
          await q.query("SELECT id FROM bds.users WHERE email=$1", [
            `${role}@bdsgiatot.test`,
          ])
        ).rows[0],
    );
    return this.session(u.id, res);
  }
  @Post("auth/logout") async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (req.cookies?.bds_session)
      await this.db.auth(null, (q) =>
        q.query(
          "UPDATE bds_private.user_tokens SET consumed_at=now() WHERE token_hash=$1",
          [digest(req.cookies.bds_session)],
        ),
      );
    res.clearCookie("bds_session", { path: "/" });
    return { ok: true };
  }
  @Get("me") async me(@Req() req: Request) {
    const u = await this.user(req, false);
    if (!u) return { user: null, demo: this.db.demo };
    return this.db.api(u.id, async (q) => ({
      user: u,
      demo: this.db.demo,
      memberships: (
        await q.query(
          "SELECT m.*,o.legal_name FROM bds.organization_members m JOIN bds.organizations o ON o.id=m.organization_id WHERE m.user_id=$1",
          [u.id],
        )
      ).rows,
    }));
  }
  @Get("workspace") async workspace(@Req() req: Request) {
    const u = await this.user(req);
    return this.db.api(u.id, async (q) => ({
      listings: (
        await q.query(
          "SELECT l.*,p.name project_name,(SELECT count(*) FROM bds.listing_media m WHERE m.listing_id=l.id) image_count FROM bds.listings l JOIN bds.projects p ON p.id=l.project_id ORDER BY l.created_at DESC LIMIT 100",
        )
      ).rows,
      assignments: (
        await q.query(
          "SELECT a.*,p.name project_name FROM bds.project_assignments a JOIN bds.projects p ON p.id=a.project_id WHERE a.status='active' AND bds.assignment_live(a.id)",
        )
      ).rows,
      subscriptions: (
        await q.query(
          "SELECT * FROM bds.subscriptions ORDER BY created_at DESC",
        )
      ).rows,
      members: (
        await q.query(
          "SELECT m.*,u.display_name,u.email FROM bds.organization_members m JOIN bds.users u ON u.id=m.user_id ORDER BY m.created_at",
        )
      ).rows,
      seats: (await q.query("SELECT * FROM bds.subscription_seats")).rows,
      grants: (
        await q.query(
          "SELECT g.*,p.name project_name FROM bds.subscription_projects g JOIN bds.projects p ON p.id=g.project_id",
        )
      ).rows,
      leads: (
        await q.query(
          "SELECT c.*,l.title listing_title FROM bds.contact_requests c JOIN bds.listings l ON l.id=c.listing_id ORDER BY c.created_at DESC LIMIT 100",
        )
      ).rows,
    }));
  }
  @Post("workspace/listings") async create(
    @Req() req: Request,
    @Body() body: any,
  ) {
    const u = await this.user(req);
    const d = parse(
      z.object({
        assignment_id: uuid,
        title: z.string().trim().min(10).max(200),
        description: z.string().trim().min(30).max(20000),
        property_type_code: z.enum(["townhouse", "villa", "shophouse"]),
        transaction_type: z.enum(["sale", "rent"]),
        price_amount: z.coerce.number().positive(),
        area_m2: z.coerce.number().positive(),
        currency_code: z.enum(["VND", "USD"]),
        bedrooms: z.coerce.number().int().min(0).max(100),
      }),
      body,
    );
    return this.db.api(u.id, async (q) => {
      const a = (
        await q.query(
          "SELECT * FROM bds.project_assignments WHERE id=$1 AND bds.assignment_live(id)",
          [d.assignment_id],
        )
      ).rows[0];
      if (!a)
        throw new BadRequestException("Chưa có quyền đăng tin cho dự án này.");
      return (
        await q.query(
          "INSERT INTO bds.listings(organization_id,project_id,subscription_id,assignment_id,property_type_code,transaction_type,slug,title,description,price_amount,currency_code,price_basis,area_m2,bedrooms,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *",
          [
            a.organization_id,
            a.project_id,
            a.subscription_id,
            a.id,
            d.property_type_code,
            d.transaction_type,
            `tin-${randomUUID()}`,
            d.title,
            d.description,
            d.price_amount,
            d.currency_code,
            d.transaction_type === "sale" ? "total" : "per_month",
            d.area_m2,
            d.bedrooms,
            u.id,
          ],
        )
      ).rows[0];
    });
  }
  @Get("workspace/listings/:id") async privateListing(
    @Req() req: Request,
    @Param("id") id: string,
  ) {
    const u = await this.user(req);
    parse(uuid, id);
    return this.db.api(u.id, async (q) => {
      const l = (await q.query("SELECT * FROM bds.listings WHERE id=$1", [id]))
        .rows[0];
      if (!l) throw new NotFoundException();
      return {
        ...l,
        images: (
          await q.query(
            "SELECT m.public_url,lm.alt_text FROM bds.listing_media lm JOIN bds.media_assets m ON m.id=lm.media_asset_id WHERE lm.listing_id=$1 ORDER BY lm.display_order",
            [id],
          )
        ).rows,
        moderation: (
          await q.query(
            "SELECT * FROM bds.moderation_actions WHERE listing_id=$1 ORDER BY created_at DESC LIMIT 5",
            [id],
          )
        ).rows,
      };
    });
  }
  @Post("workspace/listings/:id/edit") async edit(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: any,
  ) {
    const u = await this.user(req);
    parse(uuid, id);
    const d = parse(
      z.object({
        title: z.string().trim().min(10).max(200),
        description: z.string().trim().min(30).max(20000),
        price_amount: z.coerce.number().positive(),
        area_m2: z.coerce.number().positive(),
        bedrooms: z.coerce.number().int().min(0).max(100),
      }),
      body,
    );
    return this.db.api(u.id, async (q) => {
      const r = await q.query(
        "UPDATE bds.listings SET title=$2,description=$3,price_amount=$4,area_m2=$5,bedrooms=$6 WHERE id=$1 AND status='draft' RETURNING id",
        [id, d.title, d.description, d.price_amount, d.area_m2, d.bedrooms],
      );
      if (!r.rows.length)
        throw new BadRequestException(
          "Chỉ có thể sửa bản nháp trong phạm vi được giao.",
        );
      return { ok: true };
    });
  }
  @Post("workspace/listings/:id/status") async status(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: any,
  ) {
    const u = await this.user(req);
    parse(uuid, id);
    const d = parse(
      z.object({
        status: z.enum([
          "draft",
          "pending",
          "published",
          "rejected",
          "hidden",
          "closed",
        ]),
        reason: z.string().max(1000).optional(),
      }),
      body,
    );
    return this.db.api(u.id, async (q) => {
      await q.query(
        "SELECT bds.transition_listing($1,$2,$3,CASE WHEN $2='published' THEN LEAST(now()+interval '30 days',(SELECT s.ends_at FROM bds.listings l JOIN bds.subscriptions s ON s.id=l.subscription_id WHERE l.id=$1),(SELECT g.valid_until FROM bds.listings l JOIN bds.project_assignments a ON a.id=l.assignment_id JOIN bds.subscription_projects g ON g.id=a.subscription_project_id WHERE l.id=$1)) ELSE NULL END)",
        [id, d.status, d.reason || null],
      );
      return { ok: true };
    });
  }
  @Post("workspace/listings/:id/image")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 8 * 1024 * 1024, files: 1 },
    }),
  )
  async upload(
    @Req() req: Request,
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const u = await this.user(req);
    parse(uuid, id);
    if (!file) throw new BadRequestException("Chọn ảnh JPEG, PNG hoặc WebP.");
    const listing = await this.db.api(
      u.id,
      async (q) =>
        (
          await q.query(
            "SELECT * FROM bds.listings WHERE id=$1 AND status='draft'",
            [id],
          )
        ).rows[0],
    );
    if (!listing)
      throw new BadRequestException(
        "Chỉ thêm ảnh vào bản nháp có quyền quản lý.",
      );
    let data: Buffer;
    let info: sharp.OutputInfo;
    try {
      const result = await sharp(file.buffer, { limitInputPixels: 40000000 })
        .rotate()
        .resize({
          width: 1600,
          height: 1200,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 82 })
        .toBuffer({ resolveWithObject: true });
      data = result.data;
      info = result.info;
    } catch {
      throw new BadRequestException(
        "Tệp không phải ảnh hợp lệ hoặc ảnh quá lớn.",
      );
    }
    const key = randomUUID() + ".webp";
    const folder = path.join(ROOT, ".local", "uploads");
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, key), data);
    const media = await this.db.api(
      u.id,
      async (q) =>
        (
          await q.query(
            "INSERT INTO bds.media_assets(organization_id,uploaded_by,storage_key,mime_type,byte_size,width,height) VALUES($1,$2,$3,'image/webp',$4,$5,$6) RETURNING id",
            [
              listing.organization_id,
              u.id,
              key,
              data.length,
              info.width,
              info.height,
            ],
          )
        ).rows[0],
    );
    await this.db.using(null, "bdsgiatot_worker", (q) =>
      q.query(
        "UPDATE bds.media_assets SET status='ready',public_url=$2 WHERE id=$1",
        [media.id, `/api/v1/media/file/${media.id}`],
      ),
    );
    await this.db.api(u.id, (q) =>
      q.query(
        "INSERT INTO bds.listing_media(listing_id,media_asset_id,organization_id,display_order,alt_text) SELECT $1,$2,$3,COALESCE(max(display_order),-1)+1,$4 FROM bds.listing_media WHERE listing_id=$1",
        [id, media.id, listing.organization_id, listing.title],
      ),
    );
    return { ok: true };
  }
  @Get("media/file/:id") async media(
    @Req() req: Request,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    parse(uuid, id);
    const url = `/api/v1/media/file/${id}`;
    const publicRow = await this.db.api(
      null,
      async (q) =>
        (
          await q.query(
            "SELECT 1 FROM bds.public_listing_media WHERE public_url=$1 LIMIT 1",
            [url],
          )
        ).rows[0],
    );
    const u = publicRow ? null : await this.user(req, false);
    const allowed =
      publicRow ||
      (u &&
        (await this.db.api(
          u.id,
          async (q) =>
            (await q.query("SELECT id FROM bds.media_assets WHERE id=$1", [id]))
              .rows[0],
        )));
    if (!allowed) throw new NotFoundException();
    const m = await this.db.using(
      null,
      "bdsgiatot_worker",
      async (q) =>
        (
          await q.query(
            "SELECT storage_key FROM bds.media_assets WHERE id=$1 AND status='ready'",
            [id],
          )
        ).rows[0],
    );
    if (!m || !/^[-a-f0-9]+\.webp$/.test(m.storage_key))
      throw new NotFoundException();
    return res.sendFile(path.join(ROOT, ".local", "uploads", m.storage_key), {
      dotfiles: "allow",
    });
  }
  @Post("workspace/invite") async invite(
    @Req() req: Request,
    @Body() body: any,
  ) {
    const u = await this.user(req);
    const d = parse(
      z.object({
        subscription_id: uuid,
        email: z.email(),
        name: z.string().trim().min(2).max(100),
      }),
      body,
    );
    if (!this.db.demo)
      throw new BadRequestException(
        "Cần cấu hình dịch vụ gửi thư trước khi mời tài khoản trên môi trường thật.",
      );
    const token = randomBytes(32).toString("base64url");
    await this.db.api(u.id, (q) =>
      q.query("SELECT bds.invite_sale($1,$2,$3,$4,now()+interval '2 days')", [
        d.subscription_id,
        d.email,
        d.name,
        digest(token),
      ]),
    );
    return {
      ok: true,
      activation_url: `/kich-hoat?token=${token}`,
      message: "Đường dẫn kích hoạt thử nghiệm; hệ thống chưa gửi email.",
    };
  }
  @Post("auth/activate") async activate(
    @Req() req: Request,
    @Body() body: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const d = parse(
      z.object({
        token: z.string().min(40).max(100),
        password: z.string().min(12).max(128),
      }),
      body,
    );
    const u = await this.user(req, false);
    const hash = await argon2.hash(d.password);
    const r = await this.db.auth(
      u?.id || null,
      async (q) =>
        (
          await q.query("SELECT bds.accept_invitation($1,$2) id", [
            digest(d.token),
            hash,
          ])
        ).rows[0],
    );
    return this.session(r.id, res);
  }
  @Post("workspace/assign") async assign(
    @Req() req: Request,
    @Body() body: any,
  ) {
    const u = await this.user(req);
    const d = parse(z.object({ seat_id: uuid, grant_id: uuid }), body);
    await this.db.api(u.id, (q) =>
      q.query("SELECT bds.assign_project($1,$2)", [d.seat_id, d.grant_id]),
    );
    return { ok: true };
  }
  @Post("workspace/revoke") async revoke(
    @Req() req: Request,
    @Body() body: any,
  ) {
    const u = await this.user(req);
    const d = parse(z.object({ seat_id: uuid }), body);
    await this.db.api(u.id, (q) =>
      q.query("SELECT bds.revoke_seat($1)", [d.seat_id]),
    );
    return { ok: true };
  }
}

