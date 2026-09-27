"use client";
import { useState } from "react";
import { Search, MapPin, Building2, SlidersHorizontal } from "lucide-react";
export function SearchBox({ initial = {}, compact = false }: any) {
  const [transaction, setTransaction] = useState(initial.transaction || "sale");
  const [market, setMarket] = useState(initial.market || "");
  return (
    <form
      className={`search-box ${compact ? "compact" : ""}`}
      action={transaction === "sale" ? "/mua-ban" : "/cho-thue"}
    >
      <div className="search-tabs">
        <button
          type="button"
          onClick={() => setTransaction("sale")}
          className={transaction === "sale" ? "selected" : ""}
        >
          Mua – Bán
        </button>
        <button
          type="button"
          onClick={() => setTransaction("rent")}
          className={transaction === "rent" ? "selected" : ""}
        >
          Cho thuê
        </button>
        <span>Dự án phù hợp, lựa chọn của bạn</span>
      </div>
      <div className="search-main">
        <label className="search-field keyword">
          <Search size={20} />
          <span>
            <b>Bạn đang tìm dự án nào?</b>
            <input
              name="q"
              placeholder="Tên dự án hoặc khu vực"
              defaultValue={initial.q || ""}
            />
          </span>
        </label>
        <label className="search-field">
          <MapPin size={20} />
          <span>
            <b>Thị trường</b>
            <select
              name="market"
              value={market}
              onChange={(e) => setMarket(e.target.value)}
            >
              <option value="">Tất cả thị trường</option>
              <option value="domestic">Trong nước</option>
              <option value="international">Ngoài nước</option>
            </select>
          </span>
        </label>
        <label className="search-field">
          <Building2 size={20} />
          <span>
            <b>Loại hình</b>
            <select name="type" defaultValue={initial.type || ""}>
              <option value="">Tất cả loại hình</option>
              <option value="townhouse">Nhà phố</option>
              <option value="villa">Biệt thự</option>
              <option value="shophouse">Shophouse</option>
            </select>
          </span>
        </label>
        <button className="btn btn-primary search-submit">
          <Search size={19} />
          Tìm kiếm
        </button>
      </div>
      {compact && (
        <div className="search-extra">
          <label>
            Quốc gia{" "}
            <select name="country" defaultValue={initial.country || ""}>
              <option value="">Tất cả</option>
              {market !== "international" && (
                <option value="VN">Việt Nam</option>
              )}
              {market !== "domestic" && (
                <>
                  <option value="TH">Thái Lan</option>
                  <option value="AU">Australia</option>
                </>
              )}
            </select>
          </label>
          <label>
            <SlidersHorizontal size={15} />
            Sắp xếp{" "}
            <select name="sort" defaultValue={initial.sort || ""}>
              <option value="">Mới nhất</option>
              <option value="price_asc">Giá tăng dần</option>
              <option value="price_desc">Giá giảm dần</option>
            </select>
          </label>
        </div>
      )}
    </form>
  );
}
