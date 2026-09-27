import Link from "next/link";
import { get } from "@/lib/data";
import { ArticleCard } from "./catalog";
export async function Articles({ category }: any) {
  const rows = await get(`articles?category=${category}`);
  return (
    <div className="container page">
      <div className="breadcrumb">
        <Link href="/">Trang chủ</Link> / Nội dung
      </div>
      <div className="page-heading">
        <span className="eyebrow">HIỂU THÊM ĐỂ CHỌN TỐT HƠN</span>
        <h1>
          {category === "news"
            ? "Chuyện nhà, chuyện sống"
            : "Góc nhìn thị trường"}
        </h1>
        <p>
          {category === "news"
            ? "Thông tin và câu chuyện về những không gian sống."
            : "Những gợi mở để bạn tìm hiểu dự án theo nhu cầu của mình."}
        </p>
      </div>
      <div className="pill-nav">
        <Link href="/tin-tuc" className={category === "news" ? "selected" : ""}>
          Tin tức
        </Link>
        <Link
          href="/phan-tich-thi-truong"
          className={category === "market_analysis" ? "selected" : ""}
        >
          Phân tích thị trường
        </Link>
      </div>
      <div className="article-grid">
        {rows.map((a: any, i: number) => (
          <ArticleCard key={a.id} item={a} index={i} />
        ))}
      </div>
    </div>
  );
}
