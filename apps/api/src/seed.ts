import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import argon2 from "argon2";
import type { Runner } from "./database";
export async function seedDemo(db: Runner) {
  const q = async (s: string, p: any[] = []) => (await db.query(s, p)).rows;
  const insert = async (s: string, p: any[] = []) =>
    (await q(s + " RETURNING id", p))[0].id;
  const password = randomBytes(18).toString("base64url");
  const hash = await argon2.hash(password);
  const people = [
    ["admin@bdsgiatot.test", "Quản trị nền tảng", "admin"],
    ["company@bdsgiatot.test", "Quản lý doanh nghiệp", "member"],
    ["sale@bdsgiatot.test", "Nguyễn Minh Anh", "member"],
    ["other@bdsgiatot.test", "Doanh nghiệp thứ hai", "member"],
  ];
  const ids: string[] = [];
  for (const [email, name, role] of people) {
    const id = await insert(
      "INSERT INTO bds.users(email,display_name,platform_role,status) VALUES($1,$2,$3,'active')",
      [email, name, role],
    );
    ids.push(id);
    await q(
      "INSERT INTO bds_private.auth_credentials(user_id,password_hash) VALUES($1,$2)",
      [id, hash],
    );
  }
  const [admin, manager, sale, other] = ids;
  await q("SELECT set_config('app.user_id',$1,true)", [admin]);
  await q(
    "INSERT INTO bds.countries(code,name) VALUES('TH','Thái Lan'),('AU','Australia')",
  );
  const org = await insert(
    "INSERT INTO bds.organizations(legal_name,slug,registration_number,registration_country,introduction,verification_status,status) VALUES('Công ty Phát triển Không Gian Mới','khong-gian-moi','DEMO-001','VN','Doanh nghiệp minh họa để trải nghiệm quản lý dự án và đội ngũ kinh doanh.','verified','active')",
  );
  const org2 = await insert(
    "INSERT INTO bds.organizations(legal_name,slug,registration_number,registration_country,introduction,verification_status,status) VALUES('Công ty Phân phối Nhà Xanh','nha-xanh','DEMO-002','VN','Hồ sơ doanh nghiệp minh họa cho phân quyền và danh bạ.','verified','active')",
  );
  await q(
    "INSERT INTO bds.organization_members(organization_id,user_id,role,status) VALUES($1,$2,'org_admin','active'),($3,$4,'org_admin','active')",
    [org, manager, org2, other],
  );
  const member = await insert(
    "INSERT INTO bds.organization_members(organization_id,user_id,role,status) VALUES($1,$2,'sale','active')",
    [org, sale],
  );
  await q(
    "INSERT INTO bds.agent_profiles(user_id,slug,bio,is_public) VALUES($1,'nguyen-minh-anh','Chuyên viên tư vấn dự án trong bản trải nghiệm bdsgiatot.vn.',true)",
    [sale],
  );
  const contract = await insert(
    "INSERT INTO bds.contracts(organization_id,contract_number,status,effective_from,effective_until,signed_at) VALUES($1,'DEMO-HĐ-001','active',now()-interval '1 day',now()+interval '365 days',now())",
    [org],
  );
  await q(
    "INSERT INTO bds.contract_documents(contract_id,organization_id,document_type,private_storage_key,version) VALUES($1,$2,'signed_contract','demo/not-a-legal-document',1)",
    [contract, org],
  );
  const plan = await insert(
    "INSERT INTO bds.combo_plans(name,default_sale_limit,default_listing_limit) VALUES('Combo dự án trải nghiệm',10,50)",
  );
  const sub = await insert(
    "INSERT INTO bds.subscriptions(contract_id,organization_id,combo_plan_id,sale_limit,active_listing_limit,starts_at,ends_at,status) VALUES($1,$2,$3,10,50,now()-interval '1 hour',now()+interval '360 days','active')",
    [contract, org, plan],
  );
  const seat = (await q("SELECT bds.allocate_seat($1,$2) id", [sub, member]))[0]
    .id;
  const projects = [
    [
      "The Garden Riverside",
      "the-garden-riverside",
      "Hồ Chí Minh",
      "VN",
      "villa",
      12800000000,
      280,
      "home-1.webp",
      "Một khoảng xanh riêng, một nhịp sống mới. Những biệt thự sân vườn được giới thiệu trong không gian ven sông yên bình.",
    ],
    [
      "An Nhiên Villas",
      "an-nhien-villas",
      "Đà Nẵng",
      "VN",
      "villa",
      8900000000,
      220,
      "home-2.webp",
      "Tận hưởng không gian sống thoáng đãng, gần thiên nhiên với thiết kế mở và những khoảng sân đầy nắng.",
    ],
    [
      "Phố Thương Gia",
      "pho-thuong-gia",
      "Hà Nội",
      "VN",
      "shophouse",
      6500000000,
      110,
      "home-3.webp",
      "Không gian kết hợp an cư và kinh doanh với mặt bằng linh hoạt, thuận tiện cho nhiều nhu cầu sử dụng.",
    ],
    [
      "Thảo Nguyên Town",
      "thao-nguyen-town",
      "Hồ Chí Minh",
      "VN",
      "townhouse",
      4900000000,
      95,
      "home-3.webp",
      "Những căn nhà phố dành cho gia đình yêu thích sự gọn gàng, tiện nghi và kết nối với cộng đồng.",
    ],
    [
      "Solara Bay Residences",
      "solara-bay",
      "Phuket",
      "TH",
      "villa",
      720000,
      320,
      "home-2.webp",
      "Một lựa chọn khám phá thị trường nước ngoài, với không gian nghỉ dưỡng rộng mở và cảnh quan nhiệt đới.",
    ],
    [
      "Palm Avenue",
      "palm-avenue",
      "Melbourne",
      "AU",
      "townhouse",
      980000,
      150,
      "home-1.webp",
      "Khám phá trải nghiệm nhà phố hiện đại tại thị trường Australia trong danh mục minh họa.",
    ],
  ];
  for (const [
    name,
    slug,
    city,
    country,
    type,
    price,
    area,
    img,
    desc,
  ] of projects) {
    const loc = await insert(
      "INSERT INTO bds.locations(country_code,name,slug,location_type) VALUES($1,$2,$3,'city')",
      [country, city, String(slug) + "-city"],
    );
    const project = await insert(
      "INSERT INTO bds.projects(location_id,name,slug,description,address,status) VALUES($1,$2,$3,$4,$5,'published')",
      [loc, name, slug, desc, city],
    );
    await q("INSERT INTO bds.project_property_types VALUES($1,$2)", [
      project,
      type,
    ]);
    const po = await insert(
      "INSERT INTO bds.project_organizations(project_id,organization_id,role,verification_status) VALUES($1,$2,'distributor','verified')",
      [project, org],
    );
    const grant = await insert(
      "INSERT INTO bds.subscription_projects(subscription_id,organization_id,project_id,project_organization_id,valid_from,valid_until) VALUES($1,$2,$3,$4,now(),now()+interval '350 days')",
      [sub, org, project, po],
    );
    const assignment = (
      await q("SELECT bds.assign_project($1,$2) id", [seat, grant])
    )[0].id;
    const media = await insert(
      "INSERT INTO bds.media_assets(organization_id,uploaded_by,storage_key,public_url,mime_type,byte_size,width,height,status) VALUES($1,$2,$3,$4,'image/webp',100000,1400,900,'ready')",
      [org, sale, `demo/${slug}/${img}`, `/images/${img}`],
    );
    for (const transaction of ["sale", "rent"]) {
      const rental =
        country === "VN"
          ? Math.round(Number(price) / 220 / 1000000) * 1000000
          : Math.round(Number(price) / 220);
      const listing = await insert(
        "INSERT INTO bds.listings(organization_id,project_id,subscription_id,assignment_id,property_type_code,transaction_type,slug,title,description,price_amount,currency_code,price_basis,area_m2,bedrooms,bathrooms,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,3,3,$14)",
        [
          org,
          project,
          sub,
          assignment,
          type,
          transaction,
          `${slug}-${transaction}`,
          `${transaction === "sale" ? "Sở hữu" : "Cho thuê"} ${type === "villa" ? "biệt thự" : type === "townhouse" ? "nhà phố" : "shophouse"} tại ${name}`,
          `${desc}\n\nThông tin và giá trong bản trải nghiệm là dữ liệu minh họa, không phải lời chào bán thực tế. Liên hệ được lưu vào môi trường thử nghiệm.`,
          transaction === "sale" ? price : rental,
          country === "VN" ? "VND" : "USD",
          transaction === "sale" ? "total" : "per_month",
          area,
          admin,
        ],
      );
      await q("INSERT INTO bds.listing_media VALUES($1,$2,$3,0,$4)", [
        listing,
        media,
        org,
        `Ảnh kiến trúc minh họa cho ${name}`,
      ]);
      await q("SELECT bds.transition_listing($1,'pending')", [listing]);
      await q(
        "SELECT bds.transition_listing($1,'published',NULL,now()+interval '300 days')",
        [listing],
      );
    }
  }
  for (const [category, title, slug, body] of [
    [
      "market_analysis",
      "Chọn một nơi để ở, bắt đầu từ những điều gì?",
      "chon-mot-noi-de-o",
      "Một quyết định nhà ở nên bắt đầu từ nhu cầu thực tế: khoảng cách di chuyển, không gian cho gia đình và khả năng duy trì chi phí dài hạn.\n\nHãy dành thời gian trải nghiệm khu vực vào nhiều thời điểm trong ngày, đối chiếu thông tin dự án với tài liệu do đơn vị phân phối cung cấp và ghi lại những câu hỏi cần làm rõ.\n\nBài viết minh họa cho giao diện phân tích thị trường; không chứa báo cáo giá hoặc tư vấn đầu tư.",
    ],
    [
      "news",
      "Không gian xanh và câu chuyện về tổ ấm",
      "khong-gian-xanh",
      "Ánh sáng tự nhiên, một khoảng sân nhỏ hay hàng cây trước hiên đều có thể thay đổi cảm nhận về không gian sống.\n\nKhi xem dự án, hãy quan sát cách các khu vực sinh hoạt kết nối với bên ngoài và cân nhắc nhu cầu sử dụng của từng thành viên. Đây là nội dung minh họa cho bản trải nghiệm.",
    ],
    [
      "news",
      "Khám phá ba loại hình nhà ở trong danh mục",
      "ba-loai-hinh",
      "Nhà phố, biệt thự và shophouse đáp ứng những nhu cầu sử dụng khác nhau. Bộ lọc dự án giúp bạn thu hẹp danh sách trước khi tìm hiểu từng tin đăng.\n\nCác thông số và hình ảnh trên bản trải nghiệm dùng để minh họa, cần được thay bằng dữ liệu thực trước khi công bố.",
    ],
  ])
    await q(
      "INSERT INTO bds.articles(author_user_id,category,title,slug,body,status,published_at) VALUES($1,$2,$3,$4,$5,'published',now())",
      [admin, category, title, slug, body],
    );
  const root = path.resolve(__dirname, "../../..");
  fs.writeFileSync(
    path.join(root, ".local", "DEMO-ACCOUNTS.json"),
    JSON.stringify(
      {
        notice: "Local demo only. Do not publish these accounts.",
        password,
        accounts: people.map(([email, name]) => ({ email, name })),
      },
      null,
      2,
    ),
  );
}
