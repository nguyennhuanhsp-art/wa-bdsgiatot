import Link from "next/link";
import { SearchX, ArrowRight } from "lucide-react";
import { get } from "@/lib/data";
import { SearchBox } from "./search";
import { ListingCard } from "./catalog";
export async function Results({ params, transaction }: any) {
  const query = new URLSearchParams({ ...params, transaction });
  const data = await get(`listings?${query}`);
  return (
    <div className="container page">
      <div className="breadcrumb">
        <Link href="/">Trang chủ</Link>
        <span>/</span>
        {transaction === "sale" ? "Mua – Bán" : "Cho thuê"}
      </div>
      <div className="page-heading">
        <span className="eyebrow">TÌM KIẾM DỰ ÁN</span>
        <h1>
          {transaction === "sale"
            ? "Tìm nơi thuộc về bạn"
            : "Một không gian, nhiều trải nghiệm"}
        </h1>
        <p>
          {transaction === "sale"
            ? "Khám phá nhà phố, biệt thự và shophouse để sở hữu."
            : "Lựa chọn không gian phù hợp với nhu cầu thuê của bạn."}
        </p>
      </div>
      <SearchBox compact initial={{ ...params, transaction }} />
      <div className="results-heading">
        <h2>{data.total} tin đăng phù hợp</h2>
        <span className="fine">Giá hiển thị là dữ liệu minh họa</span>
      </div>
      {data.rows.length ? (
        <div className="property-grid">
          {data.rows.map((l: any) => (
            <ListingCard key={l.id} item={l} />
          ))}
        </div>
      ) : (
        <div className="empty">
          <SearchX size={40} />
          <h2>Chưa tìm thấy tin phù hợp</h2>
          <p>Thử đổi tên dự án, thị trường hoặc loại hình.</p>
          <Link
            className="btn btn-outline"
            href={transaction === "sale" ? "/mua-ban" : "/cho-thue"}
          >
            Xóa bộ lọc
          </Link>
        </div>
      )}
      {data.total > 12 && (
        <div className="pagination">
          {Array.from({ length: Math.ceil(data.total / 12) }, (_, i) => {
            const q = new URLSearchParams({ ...params, page: String(i + 1) });
            return (
              <Link
                className={data.page === i + 1 ? "selected" : ""}
                key={i}
                href={`?${q}`}
              >
                {i + 1}
              </Link>
            );
          })}
        </div>
      )}
      <div className="sample-note">
        Thông tin dự án, mức giá và ảnh trong bản thử nghiệm chỉ để minh họa
        giao diện.
      </div>
    </div>
  );
}
