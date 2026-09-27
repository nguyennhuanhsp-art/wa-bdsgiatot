"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { ArrowRight, Building2, UserRound, ShieldCheck } from "lucide-react";
import { api } from "@/components/contact";
import { NoticeModal } from "@/components/chrome";
export default function Login() {
  const router = useRouter();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [demo, setDemo] = useState(false);
  useEffect(() => {
    api("me")
      .then((d) => {
        setDemo(d.demo);
        if (d.user) router.replace("/tai-khoan");
      })
      .catch(() => {});
  }, [router]);
  async function submit(path: string, body: any) {
    setBusy(true);
    setError("");
    try {
      await api(path, body);
      router.push("/tai-khoan");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="container auth-page">
      <div className="auth-visual">
        <img src="/images/home-1.webp" alt="Ngôi nhà minh họa" />
        <div>
          <span className="eyebrow">CÙNG NHAU KIẾN TẠO GIÁ TRỊ</span>
          <h1>
            Không gian cho dự án.
            <br />
            Kết nối cho đội ngũ.
          </h1>
          <p>Đăng nhập để quản lý tin đăng và đồng hành cùng khách hàng.</p>
        </div>
      </div>
      <div className="auth-form">
        <span className="eyebrow">CHÀO MỪNG TRỞ LẠI</span>
        <h2>Đăng nhập</h2>
        <p className="muted">
          Dùng tài khoản do doanh nghiệp hoặc quản trị cấp.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            submit("auth/login", Object.fromEntries(f));
          }}
        >
          <label>
            Email
            <input
              type="email"
              name="email"
              autoComplete="username"
              placeholder="ten@congty.vn"
              required
            />
          </label>
          <label>
            Mật khẩu
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="Nhập mật khẩu"
              required
              maxLength={200}
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="btn btn-primary full" disabled={busy}>
            {busy ? "Đang đăng nhập…" : "Đăng nhập"}
            <ArrowRight size={18} />
          </button>
        </form>
        <p className="auth-register">
          Chưa có tài khoản?{" "}
          <button className="inline-button" onClick={() => setOpen(true)}>
            Đăng ký
          </button>
        </p>
        {demo && (
          <div className="demo-login">
            <b>Trải nghiệm nhanh các vai trò</b>
            <p>Chỉ có ở bản chạy thử trên máy này.</p>
            <div>
              {[
                ["sale", "Sale", UserRound],
                ["company", "Doanh nghiệp", Building2],
                ["admin", "Quản trị", ShieldCheck],
              ].map(([role, label, I]: any) => (
                <button
                  key={role}
                  disabled={busy}
                  onClick={() => submit("auth/demo", { role })}
                >
                  <I size={17} />
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        <Link className="text-link" href="/">
          ← Tiếp tục khám phá dự án
        </Link>
      </div>
      <NoticeModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
