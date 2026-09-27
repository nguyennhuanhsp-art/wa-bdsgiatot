import type { Metadata } from "next";
import { Header, Footer } from "@/components/chrome";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "bdsgiatot.vn | Tìm nơi chốn, chọn tương lai",
    template: "%s | bdsgiatot.vn",
  },
  description:
    "Khám phá dự án nhà phố, biệt thự và shophouse cho nhu cầu mua bán, cho thuê trong và ngoài nước.",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" data-scroll-behavior="smooth">
      <head>
        <link rel="stylesheet" href="/fonts/font.css" />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Đến nội dung chính
        </a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
