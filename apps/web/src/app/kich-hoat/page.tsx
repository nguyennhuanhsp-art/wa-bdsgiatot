"use client";
import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "@/components/contact";
function Form() {
  const p = useSearchParams(),
    router = useRouter();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="container page">
      <div className="activation-card">
        <span className="eyebrow">TÀI KHOẢN DOANH NGHIỆP MỜI</span>
        <h1>Kích hoạt tài khoản</h1>
        <p>
          Đặt mật khẩu ít nhất 12 ký tự để bắt đầu sử dụng. Nếu đã có tài khoản,
          hãy đăng nhập đúng tài khoản trước khi mở lời mời.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const f = new FormData(e.currentTarget);
            try {
              await api("auth/activate", {
                token: p.get("token"),
                password: f.get("password"),
              });
              router.push("/tai-khoan");
            } catch (e: any) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Mật khẩu mới
            <input
              type="password"
              name="password"
              minLength={12}
              maxLength={128}
              required
              autoComplete="new-password"
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="btn btn-primary full" disabled={busy}>
            Kích hoạt tài khoản
          </button>
        </form>
      </div>
    </div>
  );
}
export default function Page() {
  return (
    <Suspense>
      <Form />
    </Suspense>
  );
}
