"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  House,
  Search,
  Users,
  UserRound,
  Plus,
  Menu,
  X,
  ArrowUpRight,
  Building2,
} from "lucide-react";
export function Logo() {
  return (
    <Link
      href="/"
      className="logo"
      aria-label="Bất động sản giá tốt, trang chủ"
    >
      <span className="logo-icon">
        <House size={24} strokeWidth={2.5} />
      </span>
      <span>
        bds<span className="brand-red">giatot</span>
        <small>.vn</small>
      </span>
    </Link>
  );
}
export function Header() {
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const p = usePathname();
  useEffect(() => setOpen(false), [p]);
  useEffect(() => {
    let active = true;
    fetch("/api/v1/me")
      .then((r) => r.json())
      .then((d) => {
        if (active) setSignedIn(Boolean(d.user));
      })
      .catch(() => {
        if (active) setSignedIn(false);
      });
    return () => {
      active = false;
    };
  }, [p]);
  return (
    <>
      <div className="demo-strip">
        BẢN TRẢI NGHIỆM{" "}
        <span>· Dự án, giá và doanh nghiệp là dữ liệu minh họa</span>
      </div>
      <header className="header">
        <div className="container header-inner">
          <Logo />
          <nav
            className={open ? "desktop-nav is-open" : "desktop-nav"}
            aria-label="Điều hướng chính"
          >
            <Link className={p === "/mua-ban" ? "active" : ""} href="/mua-ban">
              Mua – Bán
            </Link>
            <Link
              className={p === "/cho-thue" ? "active" : ""}
              href="/cho-thue"
            >
              Cho thuê
            </Link>
            <Link href="/tin-tuc">Tin tức</Link>
            <Link href="/phan-tich-thi-truong">Phân tích thị trường</Link>
            <Link href="/danh-ba">Danh bạ</Link>
          </nav>
          <div className="header-actions">
            <Link
              className="login-link"
              href={signedIn ? "/tai-khoan" : "/dang-nhap"}
            >
              <UserRound size={18} /> {signedIn ? "Tài khoản" : "Đăng nhập"}
            </Link>
            <Link className="btn btn-primary btn-small" href="/tai-khoan">
              <Plus size={17} /> Đăng tin
            </Link>
            <button
              className="icon-button menu-button"
              onClick={() => setOpen(!open)}
              aria-label={open ? "Đóng menu" : "Mở menu"}
              aria-expanded={open}
            >
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      <nav className="mobile-nav" aria-label="Điều hướng điện thoại">
        {[
          [House, "/", "Trang chủ"],
          [Search, "/mua-ban", "Tìm kiếm"],
          [Users, "/danh-ba", "Danh bạ"],
          [UserRound, "/tai-khoan", "Tài khoản"],
        ].map(([Icon, href, label]: any) => (
          <Link
            key={href}
            href={href}
            className={
              p === href || (href === "/tai-khoan" && p === "/quan-tri")
                ? "active"
                : ""
            }
          >
            <Icon size={21} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
export function Footer() {
  return (
    <footer>
      <div className="container footer-grid">
        <div>
          <Logo />
          <p>
            Tìm một nơi phù hợp.
            <br />
            Bắt đầu một hành trình mới.
          </p>
          <span className="fine">
            Nền tảng dự án dành cho doanh nghiệp và đội ngũ tư vấn.
          </span>
        </div>
        <div>
          <b>Khám phá</b>
          <Link href="/mua-ban">Dự án mua bán</Link>
          <Link href="/cho-thue">Dự án cho thuê</Link>
          <Link href="/danh-ba">Doanh nghiệp & môi giới</Link>
        </div>
        <div>
          <b>Thông tin</b>
          <Link href="/tin-tuc">Tin tức</Link>
          <Link href="/phan-tich-thi-truong">Phân tích thị trường</Link>
          <Link href="/doanh-nghiep">
            Combo doanh nghiệp <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
      <div className="container footer-bottom">
        © {new Date().getFullYear()} bdsgiatot.vn{" "}
        <span>Bản phát triển nội bộ • Chưa mở giao dịch thực tế</span>
      </div>
    </footer>
  );
}
export function NoticeModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) ref.current?.showModal();
    else ref.current?.close();
  }, [open]);
  return (
    <dialog ref={ref} className="modal" onCancel={onClose}>
      <button className="icon-button close" onClick={onClose} aria-label="Đóng">
        <X />
      </button>
      <div className="round-icon">
        <Building2 />
      </div>
      <h2>Tài khoản do doanh nghiệp cấp</h2>
      <p>
        Vui lòng liên hệ công ty phụ trách dự án của bạn để được cấp tài khoản
        đăng tin trên bdsgiatot.vn.
      </p>
      <p className="muted">
        Nền tảng cung cấp combo dự án cho doanh nghiệp theo hợp đồng; không bán
        suất đăng tin lẻ.
      </p>
      <button className="btn btn-primary full" onClick={onClose}>
        Đã hiểu
      </button>
    </dialog>
  );
}
