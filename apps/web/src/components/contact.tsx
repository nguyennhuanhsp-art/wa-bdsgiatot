"use client";
import { useState } from "react";
import { CheckCircle2, Send, ShieldCheck } from "lucide-react";
export async function api(path: string, body?: any) {
  const r = await fetch(`/api/v1/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const d = await r
    .json()
    .catch(() => ({ message: "Không thể kết nối máy chủ." }));
  if (!r.ok)
    throw new Error(
      typeof d.message === "string"
        ? d.message
        : "Thao tác chưa thành công. Vui lòng kiểm tra thông tin.",
    );
  return d;
}
export function ContactForm({ listing }: any) {
  const [done, setDone] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="contact-panel">
      <span className="eyebrow">KẾT NỐI TƯ VẤN</span>
      <h2>Tìm hiểu thêm về căn này</h2>
      <p>
        Để lại thông tin để đơn vị phụ trách dự án tiếp nhận yêu cầu của bạn.
      </p>
      {done ? (
        <div className="success">
          <CheckCircle2 size={30} />
          <h3>Đã lưu yêu cầu tư vấn</h3>
          <p>
            Yêu cầu đang nằm trong hộp khách hàng của tài khoản phụ trách ở bản
            thử nghiệm. Chưa có thông báo gửi ra ngoài.
          </p>
        </div>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const f = new FormData(e.currentTarget);
            try {
              await api("contact", {
                listing_id: listing.id,
                name: f.get("name"),
                contact: f.get("contact"),
                message: f.get("message"),
                consent: f.get("consent") === "on",
              });
              setDone(true);
            } catch (e: any) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Họ và tên
            <input
              name="name"
              placeholder="Tên của bạn"
              minLength={2}
              maxLength={100}
              required
              autoComplete="name"
            />
          </label>
          <label>
            Email hoặc số điện thoại
            <input
              name="contact"
              placeholder="Để tư vấn viên liên hệ"
              minLength={7}
              maxLength={150}
              required
              autoComplete="email"
            />
          </label>
          <label>
            Lời nhắn
            <textarea
              name="message"
              placeholder="Bạn muốn tìm hiểu điều gì?"
              maxLength={2000}
              rows={3}
            />
          </label>
          <label className="checkbox">
            <input name="consent" type="checkbox" required />
            <span>
              Tôi đồng ý để đơn vị phụ trách sử dụng thông tin trên để tư vấn về
              tin đăng này.
            </span>
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="btn btn-primary full" disabled={busy}>
            {busy ? "Đang gửi…" : "Gửi yêu cầu tư vấn"}
            <Send size={16} />
          </button>
        </form>
      )}
      <div className="contact-company">
        <ShieldCheck size={19} />
        <span>
          Đơn vị phụ trách<b>{listing.organization_name}</b>
        </span>
      </div>
    </div>
  );
}
