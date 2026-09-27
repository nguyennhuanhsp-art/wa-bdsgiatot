"use client";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="container page empty">
      <h1>Chưa tải được nội dung</h1>
      <p>Máy chủ có thể đang khởi động. Vui lòng thử lại trong giây lát.</p>
      <button className="btn btn-primary" onClick={reset}>
        Tải lại
      </button>
    </div>
  );
}
