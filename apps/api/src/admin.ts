import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  Res,
  Inject,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request, Response } from "express";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { Database, ROOT } from "./database";
const uuid = z.string().uuid(),
  text = z.string().trim().min(2).max(200),
  slug = z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .max(180);
function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const r = schema.safeParse(body);
  if (!r.success)
    throw new BadRequestException(
      r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    );
  return r.data;
}
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
@Controller("admin")
export class AdminController {
  constructor(@Inject(Database) private db: Database) {}
  async actor(req: Request, admin = true) {
    const token = req.cookies?.bds_session;
    if (!token) throw new UnauthorizedException("Vui lòng đăng nhập.");
    const u = await this.db.auth(
      null,
      async (q) =>
        (
          await q.query(
            "SELECT u.id,u.platform_role FROM bds.users u JOIN bds_private.user_tokens t ON t.user_id=u.id WHERE t.token_hash=$1 AND t.purpose='refresh' AND t.consumed_at IS NULL AND t.expires_at>now() AND u.status='active'",
            [hash(token)],
          )
        ).rows[0],
    );
    if (!u) throw new UnauthorizedException();
    if (admin && u.platform_role !== "admin")
      throw new ForbiddenException("Chỉ quản trị nền tảng được thao tác.");
    return u;
  }
  @Get("overview") async overview(@Req() req: Request) {
    const u = await this.actor(req);
    return this.db.api(u.id, async (q) => {
      const all = async (sql: string) => (await q.query(sql)).rows;
      return {
        demo: this.db.demo,
        organizations: await all(
          "SELECT * FROM bds.organizations ORDER BY created_at DESC",
        ),
        projects: await all(
          "SELECT p.*,l.country_code,l.name city,ARRAY(SELECT property_type_code FROM bds.project_property_types t WHERE t.project_id=p.id) types FROM bds.projects p JOIN bds.locations l ON l.id=p.location_id ORDER BY p.created_at DESC",
        ),
        contracts: await all(
          "SELECT c.*,o.legal_name FROM bds.contracts c JOIN bds.organizations o ON o.id=c.organization_id ORDER BY c.created_at DESC",
        ),
        documents: (
          await all(
            "SELECT id,contract_id,document_type,version,created_at,private_storage_key FROM bds.contract_documents",
          )
        ).map(({ private_storage_key, ...d }: any) => ({
          ...d,
          available:
            /^[-a-f0-9]+\.pdf$/.test(private_storage_key) &&
            fs.existsSync(
              path.join(
                ROOT,
                ".local",
                "private-documents",
                private_storage_key,
              ),
            ),
        })),
        subscriptions: await all(
          "SELECT s.*,o.legal_name,c.contract_number FROM bds.subscriptions s JOIN bds.organizations o ON o.id=s.organization_id JOIN bds.contracts c ON c.id=s.contract_id ORDER BY s.created_at DESC",
        ),
        articles: await all(
          "SELECT * FROM bds.articles ORDER BY created_at DESC",
        ),
        countries: await all("SELECT * FROM bds.countries ORDER BY name"),
      };
    });
  }
  @Post("organizations") async organization(
    @Req() req: Request,
    @Body() body: any,
  ) {
    const u = await this.actor(req);
    const d = parse(
      z.object({
        legal_name: text,
        slug,
        registration_number: text,
        country: z.string().length(2),
        introduction: z.string().max(3000).default(""),
      }),
      body,
    );
    return this.db.api(
      u.id,
      async (q) =>
        (
          await q.query(
            "INSERT INTO bds.organizations(legal_name,slug,registration_number,registration_country,introduction) VALUES($1,$2,$3,$4,$5) RETURNING id",
            [
              d.legal_name,
              d.slug,
              d.registration_number,
              d.country,
              d.introduction,
            ],
          )
        ).rows[0],
    );
  }
  @Post("organizations/:id/status") async organizationStatus(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: any,
  ) {
    const u = await this.actor(req);
    parse(uuid, id);
    const d = parse(
      z.object({
        status: z.enum(["active", "suspended"]),
        confirmed: z.literal(true),
      }),
      body,
    );
    return this.db.api(u.id, async (q) => {
      const r = await q.query(
        "UPDATE bds.organizations SET status=$2,verification_status=CASE WHEN $2='active' THEN 'verified' ELSE verification_status END WHERE id=$1 RETURNING id",
        [id, d.status],
      );
      if (!r.rows.length) throw new NotFoundException();
      return { ok: true };
    });
  }
  @Post("organizations/:id/invite") async inviteManager(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: any,
  ) {
    const u = await this.actor(req);
    parse(uuid, id);
    if (!this.db.demo)
      throw new BadRequestException(
        "Cần cấu hình gửi email trước khi mời trên môi trường thật.",
      );
    const d = parse(z.object({ email: z.email(), name: text }), body);
    const token = randomBytes(32).toString("base64url");
    await this.db.api(u.id, (q) =>
      q.query(
        "SELECT bds.provision_org_admin($1,$2,$3,$4,now()+interval '2 days')",
        [id, d.email, d.name, hash(token)],
      ),
    );
    return { activation_url: `/kich-hoat?token=${token}`, ok: true };
  }
  @Post("projects") async project(@Req() req: Request, @Body() body: any) {
    const u = await this.actor(req);
    const d = parse(
      z.object({
        name: text,
        slug,
        country: z.string().length(2),
        city: text,
        address: text,
        description: z.string().trim().min(30).max(20000),
        types: z
          .array(z.enum(["townhouse", "villa", "shophouse"]))
          .min(1)
          .max(3),
      }),
      body,
    );
    return this.db.api(u.id, async (q) => {
      const loc = (
        await q.query(
          "INSERT INTO bds.locations(country_code,name,slug,location_type) VALUES($1,$2,$3,'city') RETURNING id",
          [d.country, d.city, `${d.slug}-location`],
        )
      ).rows[0];
      const p = (
        await q.query(
          "INSERT INTO bds.projects(location_id,name,slug,description,address) VALUES($1,$2,$3,$4,$5) RETURNING id",
          [loc.id, d.name, d.slug, d.description, d.address],
        )
      ).rows[0];
      for (const t of new Set(d.types))
        await q.query("INSERT INTO bds.project_property_types VALUES($1,$2)", [
          p.id,
          t,
        ]);
      return p;
    });
  }
  @Post("projects/:id/status") async projectStatus(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: any,
  ) {
    const u = await this.actor(req);
    parse(uuid, id);
    const d = parse(
      z.object({ status: z.enum(["published", "suspended"]) }),
      body,
    );
    return this.db.api(u.id, async (q) => {
      const r = await q.query(
        "UPDATE bds.projects SET status=$2 WHERE id=$1 RETURNING id",
        [id, d.status],
      );
      if (!r.rows.length) throw new NotFoundException();
      return { ok: true };
    });
  }
  @Post("contracts")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 15 * 1024 * 1024, files: 1 },
    }),
  )
  async contract(
    @Req() req: Request,
    @Body() body: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const u = await this.actor(req);
    const d = parse(
      z.object({
        organization_id: uuid,
        contract_number: text,
        effective_from: z.iso.date(),
        effective_until: z.iso.date(),
        signed_at: z.iso.date(),
      }),
      body,
    );
    const from = `${d.effective_from}T00:00:00+07:00`,
      until = `${d.effective_until}T23:59:59+07:00`,
      signed = `${d.signed_at}T00:00:00+07:00`;
    if (
      Date.parse(until) <= Date.parse(from) ||
      Date.parse(signed) > Date.now()
    )
      throw new BadRequestException("Kiểm tra ngày hiệu lực và ngày ký.");
    if (
      !file ||
      file.buffer.subarray(0, 5).toString() !== "%PDF-" ||
      !file.buffer.subarray(-2048).includes(Buffer.from("%%EOF"))
    )
      throw new BadRequestException(
        "Vui lòng chọn hợp đồng PDF hợp lệ, tối đa 15 MB.",
      );
    if(this.db.hostedDemo) throw new BadRequestException("Bản demo chia sẻ không nhận hợp đồng. Chỉ thử hồ sơ giả lập trên môi trường nội bộ.");
    const dir = path.join(ROOT, ".local", "private-documents");
    fs.mkdirSync(dir, { recursive: true });
    const key = randomUUID() + ".pdf",
      filename = path.join(dir, key);
    fs.writeFileSync(filename, file.buffer, { flag: "wx" });
    try {
      return await this.db.api(u.id, async (q) => {
        const c = (
          await q.query(
            "INSERT INTO bds.contracts(organization_id,contract_number,effective_from,effective_until,signed_at) VALUES($1,$2,$3,$4,$5) RETURNING id",
            [d.organization_id, d.contract_number, from, until, signed],
          )
        ).rows[0];
        await q.query(
          "INSERT INTO bds.contract_documents(contract_id,organization_id,document_type,private_storage_key,version) VALUES($1,$2,'signed_contract',$3,1)",
          [c.id, d.organization_id, key],
        );
        return c;
      });
    } catch (e) {
      fs.unlinkSync(filename);
      throw e;
    }
  }
  @Get("documents/:id") async document(
    @Req() req: Request,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const u = await this.actor(req, false);
    parse(uuid, id);
    const d = await this.db.api(
      u.id,
      async (q) =>
        (
          await q.query(
            "SELECT private_storage_key FROM bds.contract_documents WHERE id=$1",
            [id],
          )
        ).rows[0],
    );
    if (!d || !/^[-a-f0-9]+\.pdf$/.test(d.private_storage_key))
      throw new NotFoundException("Không có tài liệu được phép tải.");
    const file = path.join(
      ROOT,
      ".local",
      "private-documents",
      d.private_storage_key,
    );
    if (!fs.existsSync(file)) throw new NotFoundException();
    res.setHeader("Content-Disposition", 'attachment; filename="hop-dong.pdf"');
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'");
    return res.sendFile(file, { dotfiles: "allow" });
  }
  @Post("contracts/:id/status") async contractStatus(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: any,
  ) {
    const u = await this.actor(req);
    parse(uuid, id);
    const d = parse(
      z.object({
        status: z.enum(["active", "suspended"]),
        confirmed: z.literal(true),
      }),
      body,
    );
    return this.db.api(u.id, async (q) => {
      if (d.status === "active") {
        const doc = (
          await q.query(
            "SELECT private_storage_key FROM bds.contract_documents WHERE contract_id=$1 AND document_type='signed_contract'",
            [id],
          )
        ).rows[0];
        if (
          !doc ||
          !/^[-a-f0-9]+\.pdf$/.test(doc.private_storage_key) ||
          !fs.existsSync(
            path.join(
              ROOT,
              ".local",
              "private-documents",
              doc.private_storage_key,
            ),
          )
        )
          throw new BadRequestException(
            "Cần tải lên bản hợp đồng đã ký trước khi kích hoạt.",
          );
      }
      const r = await q.query(
        "UPDATE bds.contracts SET status=$2 WHERE id=$1 RETURNING id",
        [id, d.status],
      );
      if (!r.rows.length) throw new NotFoundException();
      return { ok: true };
    });
  }
  @Post("subscriptions") async subscription(
    @Req() req: Request,
    @Body() body: any,
  ) {
    const u = await this.actor(req);
    const d = parse(
      z.object({
        contract_id: uuid,
        name: text,
        sale_limit: z.coerce.number().int().min(1).max(10000),
        listing_limit: z.coerce.number().int().min(1).max(100000),
        projects: z.array(uuid).min(1).max(100),
        confirmed: z.literal(true),
      }),
      body,
    );
    return this.db.api(u.id, async (q) => {
      const c = (
        await q.query(
          "SELECT c.* FROM bds.contracts c JOIN bds.organizations o ON o.id=c.organization_id WHERE c.id=$1 AND c.status='active' AND c.effective_until>now() AND o.status='active' AND o.verification_status='verified'",
          [d.contract_id],
        )
      ).rows[0];
      if (!c)
        throw new BadRequestException(
          "Doanh nghiệp và hợp đồng phải được kích hoạt, còn hiệu lực.",
        );
      const plan = (
        await q.query(
          "INSERT INTO bds.combo_plans(name,default_sale_limit,default_listing_limit) VALUES($1,$2,$3) RETURNING id",
          [d.name, d.sale_limit, d.listing_limit],
        )
      ).rows[0];
      const s = (
        await q.query(
          "INSERT INTO bds.subscriptions(contract_id,organization_id,combo_plan_id,sale_limit,active_listing_limit,starts_at,ends_at,status) VALUES($1,$2,$3,$4,$5,$6,$7,'active') RETURNING id",
          [
            c.id,
            c.organization_id,
            plan.id,
            d.sale_limit,
            d.listing_limit,
            c.effective_from,
            c.effective_until,
          ],
        )
      ).rows[0];
      for (const project of new Set(d.projects)) {
        const p = (
          await q.query(
            "SELECT id FROM bds.projects WHERE id=$1 AND status='published'",
            [project],
          )
        ).rows[0];
        if (!p)
          throw new BadRequestException(
            "Dự án phải được mở trước khi cấp combo.",
          );
        const po = (
          await q.query(
            "INSERT INTO bds.project_organizations(project_id,organization_id,role,verification_status) VALUES($1,$2,'distributor','verified') ON CONFLICT(project_id,organization_id) DO UPDATE SET verification_status='verified' RETURNING id",
            [project, c.organization_id],
          )
        ).rows[0];
        await q.query(
          "INSERT INTO bds.subscription_projects(subscription_id,organization_id,project_id,project_organization_id,valid_from,valid_until) VALUES($1,$2,$3,$4,$5,$6)",
          [
            s.id,
            c.organization_id,
            project,
            po.id,
            c.effective_from,
            c.effective_until,
          ],
        );
      }
      return s;
    });
  }
  @Post("subscriptions/:id/status") async subscriptionStatus(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: any,
  ) {
    const u = await this.actor(req);
    parse(uuid, id);
    const d = parse(
      z.object({ status: z.enum(["active", "suspended"]) }),
      body,
    );
    return this.db.api(u.id, async (q) => {
      const r = await q.query(
        "UPDATE bds.subscriptions SET status=$2 WHERE id=$1 RETURNING id",
        [id, d.status],
      );
      if (!r.rows.length) throw new NotFoundException();
      return { ok: true };
    });
  }
  @Post("articles") async article(@Req() req: Request, @Body() body: any) {
    const u = await this.actor(req);
    const d = parse(
      z.object({
        id: uuid.optional(),
        title: text,
        slug,
        body: z.string().trim().min(30).max(100000),
        category: z.enum(["news", "market_analysis"]),
        meta_title: z.string().max(200).default(""),
        meta_description: z.string().max(500).default(""),
      }),
      body,
    );
    return this.db.api(u.id, async (q) => {
      if (d.id) {
        const r = await q.query(
          "UPDATE bds.articles SET title=$2,slug=$3,body=$4,category=$5,meta_title=$6,meta_description=$7 WHERE id=$1 AND status<>'published' RETURNING id",
          [
            d.id,
            d.title,
            d.slug,
            d.body,
            d.category,
            d.meta_title,
            d.meta_description,
          ],
        );
        if (!r.rows.length)
          throw new BadRequestException("Đưa bài về bản nháp trước khi sửa.");
        return r.rows[0];
      }
      return (
        await q.query(
          "INSERT INTO bds.articles(author_user_id,title,slug,body,category,meta_title,meta_description) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id",
          [
            u.id,
            d.title,
            d.slug,
            d.body,
            d.category,
            d.meta_title,
            d.meta_description,
          ],
        )
      ).rows[0];
    });
  }
  @Post("articles/:id/status") async articleStatus(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: any,
  ) {
    const u = await this.actor(req);
    parse(uuid, id);
    const d = parse(
      z.object({ status: z.enum(["draft", "published", "archived"]) }),
      body,
    );
    return this.db.api(u.id, async (q) => {
      const r = await q.query(
        "UPDATE bds.articles SET status=$2,published_at=CASE WHEN $2='published' THEN COALESCE(published_at,now()) ELSE published_at END WHERE id=$1 RETURNING id",
        [id, d.status],
      );
      if (!r.rows.length) throw new NotFoundException();
      return { ok: true };
    });
  }
}

