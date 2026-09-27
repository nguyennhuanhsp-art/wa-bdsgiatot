import Link from "next/link";
import { Building2, Users, FileCheck2, ArrowRight } from "lucide-react";
export const metadata = { title: "Combo dự án cho doanh nghiệp" };
export default function Page() {
  return (
    <div className="container page">
      <div className="enterprise-intro">
        <span className="eyebrow">HỢP TÁC THEO DỰ ÁN</span>
        <h1>
          Quản lý đội ngũ đăng tin.
          <br />
          Tập trung trong một combo.
        </h1>
        <p>
          Doanh nghiệp ký hợp đồng với nền tảng, được cấp quyền cho các dự án cụ
          thể và phân phối tài khoản cho đội ngũ Sale trong hạn mức đã thống
          nhất.
        </p>
      </div>
      <div className="directory-grid steps-grid">
        {[
          [
            "01",
            "Thống nhất hồ sơ & hợp đồng",
            "Xác định pháp nhân, dự án được phân phối, thời hạn và trách nhiệm của các bên.",
          ],
          [
            "02",
            "Kích hoạt combo dự án",
            "Quản trị cấp số tài khoản Sale, hạn mức tin và phạm vi dự án theo hợp đồng.",
          ],
          [
            "03",
            "Phân quyền & đăng tin",
            "Doanh nghiệp mời Sale, giao dự án; tin được gửi duyệt trước khi công khai.",
          ],
        ].map(([n, t, d]) => (
          <div className="directory-card" key={n}>
            <span className="step-number">{n}</span>
            <h2>{t}</h2>
            <p>{d}</p>
          </div>
        ))}
      </div>
      <div className="enterprise-callout">
        <Building2 size={32} />
        <h2>Chị đã được cấp tài khoản doanh nghiệp?</h2>
        <p>Đăng nhập để quản lý combo và đội ngũ của mình.</p>
        <Link className="btn btn-primary" href="/dang-nhap">
          Đăng nhập doanh nghiệp <ArrowRight size={18} />
        </Link>
        <span className="fine">
          Bản thử nghiệm chưa mở đăng ký hợp đồng trực tuyến hoặc thu phí.
        </span>
      </div>
    </div>
  );
}
