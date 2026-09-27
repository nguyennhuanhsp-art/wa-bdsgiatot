import Link from "next/link";
import { Building2, UserRound, ArrowUpRight } from "lucide-react";
import { get } from "@/lib/data";
export const dynamic = "force-dynamic";
export const metadata = { title: "Danh bạ doanh nghiệp và môi giới" };
export default async function Page({ searchParams }: any) {
  const { type } = await searchParams;
  const data = await get("directory");
  const agents = type === "agents";
  return (
    <div className="container page">
      <div className="page-heading">
        <span className="eyebrow">KẾT NỐI ĐÚNG NGƯỜI</span>
        <h1>Đồng hành cùng bạn</h1>
        <p>Danh bạ doanh nghiệp phân phối dự án và đội ngũ môi giới.</p>
      </div>
      <div className="pill-nav">
        <Link className={!agents ? "selected" : ""} href="/danh-ba">
          Doanh nghiệp
        </Link>
        <Link className={agents ? "selected" : ""} href="/danh-ba?type=agents">
          Môi giới
        </Link>
      </div>
      <div className="directory-grid">
        {(agents ? data.agents : data.organizations).map((r: any) => (
          <article className="directory-card" key={r.id || r.user_id}>
            <div className="directory-avatar">
              {agents ? <UserRound size={30} /> : <Building2 size={30} />}
            </div>
            <span className="eyebrow">HỒ SƠ MINH HỌA</span>
            <h2>{r.display_name || r.legal_name}</h2>
            <p>{r.bio || r.introduction}</p>
            {r.public_phone && (
              <a className="text-link" href={`tel:${r.public_phone}`}>
                {r.public_phone}
              </a>
            )}
            <Link className="text-link" href="/mua-ban">
              Xem các dự án đang giới thiệu <ArrowUpRight size={16} />
            </Link>
          </article>
        ))}
      </div>
      <div className="sample-note">
        Hồ sơ trong danh bạ này được tạo để thử nghiệm hệ thống, chưa phải đơn
        vị hoặc môi giới thực tế.
      </div>
    </div>
  );
}
