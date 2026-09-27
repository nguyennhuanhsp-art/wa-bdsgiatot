export const API = process.env.API_ORIGIN || "http://127.0.0.1:3001";
export async function get(path: string) {
  const r = await fetch(`${API}/api/v1/${path}`, { cache: "no-store" });
  if (!r.ok) throw new Error("Không thể tải dữ liệu.");
  return r.json();
}
export const types: Record<string, string> = {
  townhouse: "Nhà phố",
  villa: "Biệt thự",
  shophouse: "Shophouse",
};
export const statuses: Record<string, string> = {
  draft: "Bản nháp",
  pending: "Chờ duyệt",
  published: "Đang hiển thị",
  rejected: "Cần chỉnh sửa",
  hidden: "Đã ẩn",
  expired: "Hết hạn",
  closed: "Đã đóng",
};
export function price(n: any, c = "VND", basis = "total") {
  if (n == null) return "Thỏa thuận";
  const a = Number(n);
  const s =
    c === "VND"
      ? a >= 1e9
        ? `${(a / 1e9).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} tỷ`
        : a >= 1e6
          ? `${(a / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} triệu`
          : `${a.toLocaleString("vi-VN")} đ`
      : `${a.toLocaleString("vi-VN")} ${c}`;
  return (
    s +
    (basis === "per_month"
      ? "/tháng"
      : basis === "per_year"
        ? "/năm"
        : basis === "per_m2"
          ? "/m²"
          : "")
  );
}
