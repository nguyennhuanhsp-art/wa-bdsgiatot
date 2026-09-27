import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  Building2,
  Users,
  FileCheck2,
  Compass,
} from "lucide-react";
import { get } from "@/lib/data";
import { SearchBox } from "@/components/search";
import {
  ListingCard,
  ProjectCard,
  ArticleCard,
  SectionTitle,
} from "@/components/catalog";
export const dynamic = "force-dynamic";
export default async function Home() {
  const [projects, listings, articles] = await Promise.all([
    get("projects"),
    get("listings?transaction=sale&market=domestic"),
    get("articles"),
  ]);
  return (
    <>
      <section className="hero">
        <img
          className="hero-photo"
          src="/images/home-1.webp"
          alt="Ngôi nhà hiện đại giữa không gian xanh, ảnh minh họa"
          fetchPriority="high"
        />
        <div className="hero-overlay" />
        <div className="container hero-content">
          <span className="hero-kicker">
            KHÔNG GIAN SỐNG · GIÁ TRỊ TƯƠNG LAI
          </span>
          <h1>
            Một nơi chốn mới.
            <br />
            <em>Một khởi đầu tốt.</em>
          </h1>
          <p>
            Tìm nhà phố, biệt thự và shophouse
            <br className="mobile-only" /> phù hợp với hành trình của bạn.
          </p>
        </div>
      </section>
      <div className="container search-wrap">
        <SearchBox />
        <div className="quick-search">
          <span>Khám phá nhanh</span>
          <Link href="/mua-ban?type=townhouse">
            Nhà phố <ArrowUpRight size={13} />
          </Link>
          <Link href="/mua-ban?type=villa">
            Biệt thự <ArrowUpRight size={13} />
          </Link>
          <Link href="/mua-ban?type=shophouse">
            Shophouse <ArrowUpRight size={13} />
          </Link>
        </div>
      </div>
      <section className="section container">
        <SectionTitle
          eyebrow="ĐIỂM ĐẾN TIẾP THEO"
          title="Dự án đáng khám phá"
          description="Những không gian sống với cá tính riêng, chờ bạn tìm hiểu."
          href="/mua-ban"
          label="Khám phá dự án"
        />
        <div className="project-grid">
          {projects.slice(0, 3).map((p: any) => (
            <ProjectCard key={p.id} item={p} />
          ))}
        </div>
      </section>
      <section className="section section-soft">
        <div className="container">
          <SectionTitle
            eyebrow="LỰA CHỌN CHO BẠN"
            title="Tìm tổ ấm theo cách của bạn"
            description="Tin đăng thuộc dự án, được quản lý bởi doanh nghiệp phân phối."
            href="/mua-ban"
          />
          <div className="property-grid">
            {listings.rows.slice(0, 3).map((l: any) => (
              <ListingCard key={l.id} item={l} />
            ))}
          </div>
          <Link className="btn btn-outline centered" href="/mua-ban">
            Xem thêm tin mua bán <ArrowRight size={17} />
          </Link>
        </div>
      </section>
      <section className="section container">
        <div className="international">
          <div className="international-copy">
            <span className="eyebrow">MỞ RỘNG TẦM NHÌN</span>
            <h2>
              Một chân trời khác.
              <br />
              Thêm nhiều lựa chọn.
            </h2>
            <p>
              Khám phá các dự án ngoài nước theo quốc gia và loại hình bạn quan
              tâm.
            </p>
            <Link href="/mua-ban?market=international" className="btn btn-dark">
              Khám phá thị trường quốc tế <ArrowUpRight size={18} />
            </Link>
            <span className="fine">
              Danh mục hiện sử dụng dữ liệu minh họa.
            </span>
          </div>
          <div className="international-photo">
            <img
              src="/images/home-2.webp"
              alt="Không gian biệt thự minh họa"
              loading="lazy"
            />
            <span>
              <Compass size={18} /> Thái Lan · Australia
            </span>
          </div>
        </div>
      </section>
      <section className="section container news-section">
        <SectionTitle
          eyebrow="ĐỌC & SUY NGẪM"
          title="Góc nhìn về không gian sống"
          href="/tin-tuc"
          label="Tất cả bài viết"
        />
        <div className="article-grid">
          {articles.map((a: any, i: number) => (
            <ArticleCard key={a.id} item={a} index={i} />
          ))}
        </div>
      </section>
      <section className="enterprise-band">
        <div className="container enterprise-inner">
          <div>
            <span className="eyebrow">DÀNH CHO DOANH NGHIỆP</span>
            <h2>
              Một dự án. Một đội ngũ.
              <br />
              Một hệ thống quản lý.
            </h2>
            <p>
              Combo đăng tin theo dự án, tài khoản cho đội ngũ Sale
              <br />
              và quyền phân phối được quản lý tập trung.
            </p>
            <Link href="/doanh-nghiep" className="btn btn-primary">
              Tìm hiểu combo doanh nghiệp <ArrowRight size={18} />
            </Link>
          </div>
          <div className="enterprise-points">
            {[
              [
                Building2,
                "Quản lý theo dự án",
                "Phân quyền gắn với từng dự án cụ thể.",
              ],
              [
                Users,
                "Chủ động cấp tài khoản",
                "Doanh nghiệp quản lý đội ngũ Sale.",
              ],
              [
                FileCheck2,
                "Hợp đồng làm nền tảng",
                "Kích hoạt quyền đăng theo hợp đồng.",
              ],
            ].map(([I, t, d]: any) => (
              <div key={t}>
                <span>
                  <I size={23} />
                </span>
                <div>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
