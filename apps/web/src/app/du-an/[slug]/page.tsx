import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, ArrowUpRight } from "lucide-react";
import { get } from "@/lib/data";
import { ListingCard } from "@/components/catalog";
export const dynamic = "force-dynamic";
export default async function Page({ params }: any) {
  const { slug } = await params;
  let p;
  try {
    p = await get(`projects/${encodeURIComponent(slug)}`);
  } catch {
    notFound();
  }
  const l = await get(`listings?project=${encodeURIComponent(slug)}`);
  return (
    <div className="container page">
      <div className="breadcrumb">
        <Link href="/">Trang chủ</Link> / <Link href="/mua-ban">Dự án</Link> /{" "}
        {p.name}
      </div>
      <div className="project-detail-hero">
        <img
          src={l.rows[0]?.image || "/images/home-1.webp"}
          alt={`Ảnh minh họa ${p.name}`}
        />
        <div>
          <span className="eyebrow">DỰ ÁN MINH HỌA</span>
          <h1>{p.name}</h1>
          <span>
            <MapPin size={17} />
            {p.address}
          </span>
        </div>
      </div>
      <div className="project-description">
        <h2>Một góc nhìn về {p.name}</h2>
        <p>{p.description}</p>
        <span className="fine">
          Hình ảnh và thông tin đang dùng để trải nghiệm, không đại diện hồ sơ
          pháp lý thực tế.
        </span>
      </div>
      <div className="results-heading">
        <h2>Không gian đang được giới thiệu</h2>
        <span>{l.total} tin đăng</span>
      </div>
      <div className="property-grid">
        {l.rows.map((i: any) => (
          <ListingCard key={i.id} item={i} />
        ))}
      </div>
    </div>
  );
}
