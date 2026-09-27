import Link from "next/link";
import {
  ArrowUpRight,
  MapPin,
  BedDouble,
  Maximize,
  ArrowRight,
  Building2,
} from "lucide-react";
import { price, types } from "@/lib/data";
export function SectionTitle({
  eyebrow,
  title,
  description,
  href,
  label = "Xem tất cả",
}: any) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {href && (
        <Link className="text-link" href={href}>
          {label}
          <ArrowRight size={18} />
        </Link>
      )}
    </div>
  );
}
export function ListingCard({ item: l }: any) {
  return (
    <Link className="property-card" href={`/tin/${l.public_code}`}>
      <div className="card-image">
        <img
          src={l.image || "/images/home-1.webp"}
          alt={`Ảnh minh họa ${l.project_name}`}
          loading="lazy"
        />
        <span className="image-badge">{types[l.property_type_code]}</span>
        <span className="image-corner">
          <ArrowUpRight size={18} />
        </span>
      </div>
      <div className="card-body">
        <span className="location">
          <MapPin size={13} />
          {l.city} ·{" "}
          {l.country_code === "VN"
            ? "Việt Nam"
            : l.country_code === "TH"
              ? "Thái Lan"
              : "Australia"}
        </span>
        <h3>{l.title}</h3>
        <div className="card-price">
          {price(l.price_amount, l.currency_code, l.price_basis)}
        </div>
        <div className="specs">
          <span>
            <Maximize size={15} />
            {Number(l.area_m2)} m²
          </span>
          {l.bedrooms != null && (
            <span>
              <BedDouble size={16} />
              {l.bedrooms} PN
            </span>
          )}
          <span>
            {l.transaction_type === "sale" ? "Mua – Bán" : "Cho thuê"}
          </span>
        </div>
        <div className="card-project">
          <Building2 size={14} />
          {l.project_name}
        </div>
      </div>
    </Link>
  );
}
export function ProjectCard({ item: p }: any) {
  return (
    <Link href={`/du-an/${p.slug}`} className="project-card">
      <img
        src={p.image || "/images/home-1.webp"}
        alt={`Kiến trúc minh họa ${p.name}`}
        loading="lazy"
      />
      <div className="project-shade" />
      <span className="project-count">{p.listing_count} tin đăng</span>
      <div className="project-caption">
        <span>
          <MapPin size={14} />
          {p.city} · {p.country_name}
        </span>
        <h3>{p.name}</h3>
      </div>
      <span className="project-arrow">
        <ArrowUpRight size={22} />
      </span>
    </Link>
  );
}
export function ArticleCard({ item: a, index = 0 }: any) {
  return (
    <Link href={`/bai-viet/${a.slug}`} className="article-card">
      <img
        src={`/images/home-${(index % 3) + 1}.webp`}
        alt="Không gian nhà ở minh họa"
        loading="lazy"
      />
      <div>
        <span className="eyebrow">
          {a.category === "news" ? "Tin tức" : "Góc nhìn thị trường"}
        </span>
        <h3>{a.title}</h3>
        <p>{a.body.slice(0, 130)}…</p>
        <span className="text-link">
          Đọc bài viết <ArrowUpRight size={16} />
        </span>
      </div>
    </Link>
  );
}
