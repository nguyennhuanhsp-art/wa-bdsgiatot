import Link from "next/link";
export default function NotFound() {
  return (
    <div className="container page empty">
      <span className="eyebrow">404</span>
      <h1>Trang này chưa có hoặc đã được ẩn</h1>
      <p>
        Tin hết hạn hoặc không còn quyền phân phối sẽ không hiển thị công khai.
      </p>
      <Link className="btn btn-primary" href="/mua-ban">
        Tìm một lựa chọn khác
      </Link>
    </div>
  );
}
