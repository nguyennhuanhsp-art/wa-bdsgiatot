import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, BedDouble, Maximize, Building2 } from "lucide-react";
import { get, price, types } from "@/lib/data";
import { ContactForm } from "@/components/contact";
export const dynamic = "force-dynamic";
export default async function Page({ params }: any) {
  const { code } = await params;
  let l;
  try {
    l = await get(`listings/${code}`);
  } catch {
    notFound();
  }
  return (
    <div className="container page">
      <div className="breadcrumb">
        <Link href="/">Trang chủ</Link> /{" "}
        <Link href={`/du-an/${l.project_slug}`}>{l.project_name}</Link> / Tin #
        {l.public_code}
      </div>
      <div className="listing-layout">
        <article>
          <div className="listing-gallery">
            {l.images.map((m: any, i: number) => (
              <img
                key={i}
                src={m.public_url}
                alt={m.alt_text || l.title}
                className={i === 0 ? "main-image" : ""}
              />
            ))}
            <span>Ảnh minh họa</span>
          </div>
          <div className="listing-summary">
            <span className="eyebrow">
              {l.transaction_type === "sale" ? "MUA – BÁN" : "CHO THUÊ"} ·{" "}
              {types[l.property_type_code]}
            </span>
            <h1>{l.title}</h1>
            <p className="location">
              <MapPin size={17} />
              {l.city} ·{" "}
              <Link href={`/du-an/${l.project_slug}`}>{l.project_name}</Link>
            </p>
            <div className="listing-facts">
              <div>
                <span>Mức giá</span>
                <strong>
                  {price(l.price_amount, l.currency_code, l.price_basis)}
                </strong>
              </div>
              <div>
                <span>Diện tích</span>
                <strong>{Number(l.area_m2)} m²</strong>
              </div>
              <div>
                <span>Phòng ngủ</span>
                <strong>{l.bedrooms ?? "—"}</strong>
              </div>
            </div>
            <h2>Thông tin chi tiết</h2>
            <div className="prose">
              {l.description.split("\n").map((p: string, i: number) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            <Link className="project-inline" href={`/du-an/${l.project_slug}`}>
              <Building2 />
              <div>
                <span>Thuộc dự án</span>
                <b>{l.project_name}</b>
              </div>
              <span>Khám phá →</span>
            </Link>
            <div className="sample-note">
              Tin thử nghiệm #{l.public_code}. Hình ảnh, giá và trạng thái hồ sơ
              trong bản này không xác nhận pháp lý hoặc giá trị giao dịch thực
              tế.
            </div>
          </div>
        </article>
        <aside>
          <ContactForm listing={l} />
        </aside>
      </div>
    </div>
  );
}
