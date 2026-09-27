"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  FileCheck2,
  Layers,
  Newspaper,
  ArrowLeft,
  Download,
  CheckCircle2,
} from "lucide-react";
import { api } from "./contact";
const stateName: Record<string, string> = {
  pending: "Chờ xác nhận",
  active: "Đang hoạt động",
  suspended: "Tạm dừng",
  draft: "Bản nháp",
  published: "Đang mở",
  archived: "Lưu trữ",
  terminated: "Đã kết thúc",
  expired: "Hết hạn",
};
const day = (d: any) => new Date(d).toLocaleDateString("vi-VN");
function State({ value }: any) {
  return (
    <span
      className={`status ${["active", "published"].includes(value) ? "status-published" : value === "draft" ? "status-pending" : ""}`}
    >
      {stateName[value] || value}
    </span>
  );
}
function Field({ title, name, type = "text", ...rest }: any) {
  return (
    <label>
      {title}
      <input name={name} type={type} required {...rest} />
    </label>
  );
}
export function AdminPanel() {
  const router = useRouter();
  const [data, setData] = useState<any>(null),
    [tab, setTab] = useState("organizations"),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [link, setLink] = useState(""),
    [editing, setEditing] = useState<any>(null);
  const load = useCallback(async () => {
    try {
      const m = await api("me");
      if (!m.user) {
        router.replace("/dang-nhap");
        return;
      }
      if (m.user.platform_role !== "admin") {
        router.replace("/tai-khoan");
        return;
      }
      setData(await api("admin/overview"));
    } catch (e: any) {
      setError(e.message);
    }
  }, [router]);
  useEffect(() => {
    load();
  }, [load]);
  async function act(route: string, body: any, success = "Đã lưu thay đổi.") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await api(`admin/${route}`, body);
      if (r.activation_url) setLink(r.activation_url);
      setMessage(success);
      await load();
      return r;
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <div className="container page empty">
        <h1>Đang mở quản trị hệ thống…</h1>
        {error && <p className="error">{error}</p>}
      </div>
    );
  const activeOrgs = data.organizations.filter(
      (o: any) => o.status === "active",
    ),
    activeContracts = data.contracts.filter(
      (c: any) =>
        c.status === "active" && new Date(c.effective_until) > new Date(),
    );
  const formBody = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    return Object.fromEntries(new FormData(e.currentTarget));
  };
  return (
    <div className="admin-area">
      <div className="container page">
        <Link className="text-link" href="/tai-khoan">
          <ArrowLeft size={15} />
          Về không gian làm việc
        </Link>
        <div className="page-heading">
          <span className="eyebrow">QUẢN TRỊ NỀN TẢNG</span>
          <h1>Thiết lập quyền phân phối</h1>
          <p>Doanh nghiệp → hợp đồng → combo dự án → đội ngũ Sale.</p>
        </div>
        <div className="admin-tabs" role="tablist" aria-label="Phần quản trị">
          {[
            ["organizations", "Doanh nghiệp", Building2],
            ["projects", "Dự án", Layers],
            ["contracts", "Hợp đồng & combo", FileCheck2],
            ["articles", "Nội dung", Newspaper],
          ].map(([key, label, I]: any) => (
            <button
              role="tab"
              aria-selected={tab === key}
              aria-controls={`admin-${key}`}
              id={`tab-${key}`}
              key={key}
              className={tab === key ? "selected" : ""}
              onClick={() => {
                setTab(key);
                setError("");
                setMessage("");
                setLink("");
              }}
            >
              <I size={18} />
              {label}
            </button>
          ))}
        </div>
        {error && (
          <div role="alert" className="error banner">
            {error}
          </div>
        )}
        {message && (
          <div role="status" className="success banner">
            <CheckCircle2 size={18} />
            {message}
          </div>
        )}
        {data.demo && (
          <p className="sample-note">
            Bản thử nghiệm trên máy. Chỉ dùng tài liệu và thông tin giả lập để
            thử quy trình; chưa có email gửi ra ngoài.
          </p>
        )}
        <div role="tabpanel" id={`admin-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab === "organizations" && (
            <div className="admin-columns">
              <div>
                <section className="panel">
                  <h2>Thêm doanh nghiệp</h2>
                  <form
                    onSubmit={async (e) => {
                      const form = e.currentTarget;
                      const d = formBody(e);
                      if (
                        await act(
                          "organizations",
                          d,
                          "Đã tạo doanh nghiệp ở trạng thái chờ xác nhận.",
                        )
                      )
                        form.reset();
                    }}
                  >
                    <div className="form-grid">
                      <label className="span-2">
                        Tên pháp nhân
                        <input
                          name="legal_name"
                          required
                          minLength={2}
                          maxLength={200}
                        />
                      </label>
                      <Field
                        title="Mã số đăng ký"
                        name="registration_number"
                        minLength={2}
                      />
                      <Field
                        title="Đường dẫn (không dấu)"
                        name="slug"
                        pattern="[a-z0-9]+(-[a-z0-9]+)*"
                        placeholder="cong-ty-khong-gian"
                      />
                      <label className="span-2">
                        Quốc gia đăng ký
                        <select name="country" defaultValue="VN">
                          {data.countries.map((c: any) => (
                            <option key={c.code} value={c.code}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="span-2">
                        Giới thiệu
                        <textarea
                          name="introduction"
                          rows={3}
                          maxLength={3000}
                        />
                      </label>
                    </div>
                    <button className="btn btn-primary" disabled={busy}>
                      Tạo doanh nghiệp
                    </button>
                  </form>
                </section>
                <section className="panel">
                  <h2>Mời quản lý doanh nghiệp</h2>
                  <p>
                    Tài khoản này sẽ quản lý combo và mời Sale cho đúng doanh
                    nghiệp.
                  </p>
                  <form
                    onSubmit={async (e) => {
                      const d = formBody(e);
                      await act(
                        `organizations/${d.organization_id}/invite`,
                        { name: d.name, email: d.email },
                        "Đã tạo lời mời quản lý doanh nghiệp.",
                      );
                    }}
                  >
                    <div className="form-grid">
                      <label className="span-2">
                        Doanh nghiệp
                        <select name="organization_id" required>
                          <option value="">Chọn doanh nghiệp</option>
                          {activeOrgs.map((o: any) => (
                            <option key={o.id} value={o.id}>
                              {o.legal_name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Field title="Tên quản lý" name="name" />
                      <Field title="Email quản lý" name="email" type="email" />
                    </div>
                    <button
                      className="btn btn-primary"
                      disabled={busy || !activeOrgs.length}
                    >
                      Tạo lời mời quản lý
                    </button>
                  </form>
                  {link && (
                    <div className="activation-link">
                      <b>Link kích hoạt thử nghiệm — chưa gửi email</b>
                      <Link href={link}>
                        {typeof window === "undefined"
                          ? ""
                          : window.location.origin}
                        {link}
                      </Link>
                    </div>
                  )}
                </section>
              </div>
              <section className="panel">
                <h2>Danh sách doanh nghiệp ({data.organizations.length})</h2>
                {data.organizations.map((o: any) => (
                  <article className="admin-record" key={o.id}>
                    <State value={o.status} />
                    <h3>{o.legal_name}</h3>
                    <p>
                      {o.registration_number} · {o.registration_country}
                    </p>
                    <p>{o.introduction}</p>
                    <button
                      className="btn btn-outline btn-small"
                      disabled={busy}
                      onClick={() => {
                        const active = o.status !== "active";
                        if (
                          window.confirm(
                            active
                              ? "Xác nhận chị đã đối chiếu hồ sơ doanh nghiệp và chấp thuận kích hoạt? Đây là quyết định của người quản trị."
                              : "Tạm dừng doanh nghiệp sẽ làm các tin liên quan không còn hiển thị công khai. Tiếp tục?",
                          )
                        )
                          act(`organizations/${o.id}/status`, {
                            status: active ? "active" : "suspended",
                            confirmed: true,
                          });
                      }}
                    >
                      {o.status === "active"
                        ? "Tạm dừng doanh nghiệp"
                        : "Xác nhận & kích hoạt"}
                    </button>
                  </article>
                ))}
              </section>
            </div>
          )}
          {tab === "projects" && (
            <div className="admin-columns">
              <section className="panel">
                <h2>Tạo dự án</h2>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const f = new FormData(form);
                    const d = {
                      ...Object.fromEntries(f),
                      types: f.getAll("types"),
                    };
                    if (
                      await act(
                        "projects",
                        d,
                        "Đã lưu dự án nháp. Mở dự án khi thông tin đã sẵn sàng.",
                      )
                    )
                      form.reset();
                  }}
                >
                  <div className="form-grid">
                    <label className="span-2">
                      Tên dự án
                      <input
                        name="name"
                        required
                        minLength={2}
                        maxLength={200}
                      />
                    </label>
                    <Field
                      title="Đường dẫn dự án"
                      name="slug"
                      pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    />
                    <label>
                      Quốc gia
                      <select name="country" defaultValue="VN">
                        {data.countries.map((c: any) => (
                          <option key={c.code} value={c.code}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Field title="Tỉnh / thành phố" name="city" />
                    <Field title="Địa chỉ" name="address" />
                    <fieldset className="span-2 type-checks">
                      <legend>Loại hình được đăng</legend>
                      {[
                        ["townhouse", "Nhà phố"],
                        ["villa", "Biệt thự"],
                        ["shophouse", "Shophouse"],
                      ].map(([k, v]) => (
                        <label key={k}>
                          <input type="checkbox" name="types" value={k} />
                          {v}
                        </label>
                      ))}
                    </fieldset>
                    <label className="span-2">
                      Mô tả dự án
                      <textarea
                        name="description"
                        rows={6}
                        minLength={30}
                        maxLength={20000}
                        required
                      />
                    </label>
                  </div>
                  <button className="btn btn-primary" disabled={busy}>
                    Lưu dự án
                  </button>
                </form>
              </section>
              <section className="panel">
                <h2>Dự án ({data.projects.length})</h2>
                {data.projects.map((p: any) => (
                  <article className="admin-record" key={p.id}>
                    <State value={p.status} />
                    <h3>{p.name}</h3>
                    <p>
                      {p.city} · {p.country_code}
                    </p>
                    <p>{p.address}</p>
                    <p className="fine">
                      {p.types
                        .map(
                          (t: string) =>
                            ({
                              villa: "Biệt thự",
                              townhouse: "Nhà phố",
                              shophouse: "Shophouse",
                            })[t],
                        )
                        .join(" · ")}
                    </p>
                    <button
                      className="btn btn-outline btn-small"
                      disabled={busy}
                      onClick={() => {
                        if (
                          p.status === "published" &&
                          !window.confirm(
                            "Tạm dừng dự án sẽ ẩn tin liên quan khỏi trang công khai. Tiếp tục?",
                          )
                        )
                          return;
                        act(`projects/${p.id}/status`, {
                          status:
                            p.status === "published"
                              ? "suspended"
                              : "published",
                        });
                      }}
                    >
                      {p.status === "published" ? "Tạm dừng dự án" : "Mở dự án"}
                    </button>
                  </article>
                ))}
              </section>
            </div>
          )}
          {tab === "contracts" && (
            <>
              <div className="admin-columns">
                <section className="panel">
                  <h2>Lưu hợp đồng đã ký</h2>
                  <p>
                    Tài liệu được lưu riêng tư. Chỉ quản trị và quản lý đúng
                    doanh nghiệp có quyền tải.
                  </p>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setBusy(true);
                      setError("");
                      setMessage("");
                      const form = e.currentTarget;
                      try {
                        const r = await fetch("/api/v1/admin/contracts", {
                          method: "POST",
                          body: new FormData(form),
                        });
                        const d = await r.json();
                        if (!r.ok) throw new Error(d.message);
                        setMessage(
                          "Đã lưu hợp đồng và PDF riêng tư. Cần xác nhận kích hoạt trước khi cấp combo.",
                        );
                        form.reset();
                        await load();
                      } catch (e: any) {
                        setError(e.message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <div className="form-grid">
                      <label className="span-2">
                        Doanh nghiệp
                        <select name="organization_id" required>
                          <option value="">Chọn doanh nghiệp</option>
                          {activeOrgs.map((o: any) => (
                            <option key={o.id} value={o.id}>
                              {o.legal_name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Field title="Số hợp đồng" name="contract_number" />
                      <Field title="Ngày ký" name="signed_at" type="date" />
                      <Field
                        title="Hiệu lực từ"
                        name="effective_from"
                        type="date"
                      />
                      <Field
                        title="Hiệu lực đến"
                        name="effective_until"
                        type="date"
                      />
                      <label className="span-2">
                        Bản hợp đồng PDF (tối đa 15 MB)
                        <input
                          name="file"
                          type="file"
                          accept="application/pdf,.pdf"
                          required
                        />
                      </label>
                    </div>
                    <button
                      className="btn btn-primary"
                      disabled={busy || !activeOrgs.length}
                    >
                      Lưu hợp đồng riêng tư
                    </button>
                  </form>
                </section>
                <section className="panel">
                  <h2>Cấp combo dự án</h2>
                  <p>
                    Hạn mức và thời hạn được cấp theo hợp đồng đang hoạt động.
                  </p>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const f = new FormData(form);
                      const d = {
                        ...Object.fromEntries(f),
                        projects: f.getAll("projects"),
                        confirmed: f.get("confirmed") === "on",
                      };
                      if (
                        await act(
                          "subscriptions",
                          d,
                          "Đã cấp combo và quyền phân phối cho các dự án được chọn.",
                        )
                      )
                        form.reset();
                    }}
                  >
                    <div className="form-grid">
                      <label className="span-2">
                        Hợp đồng đang hoạt động
                        <select name="contract_id" required>
                          <option value="">Chọn hợp đồng</option>
                          {activeContracts.map((c: any) => (
                            <option key={c.id} value={c.id}>
                              {c.contract_number} · {c.legal_name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="span-2">
                        Tên combo
                        <input
                          name="name"
                          minLength={2}
                          maxLength={200}
                          required
                          placeholder="Combo phân phối dự án"
                        />
                      </label>
                      <Field
                        title="Số tài khoản Sale"
                        name="sale_limit"
                        type="number"
                        min="1"
                        max="10000"
                        defaultValue="5"
                      />
                      <Field
                        title="Số tin hiển thị"
                        name="listing_limit"
                        type="number"
                        min="1"
                        max="100000"
                        defaultValue="30"
                      />
                      <fieldset className="span-2 project-checks">
                        <legend>Dự án được phân phối</legend>
                        {data.projects
                          .filter((p: any) => p.status === "published")
                          .map((p: any) => (
                            <label key={p.id}>
                              <input
                                type="checkbox"
                                name="projects"
                                value={p.id}
                              />
                              {p.name}
                            </label>
                          ))}
                      </fieldset>
                    </div>
                    <label className="checkbox">
                      <input type="checkbox" name="confirmed" required />
                      <span>
                        Tôi đã đối chiếu hợp đồng và xác nhận doanh nghiệp có
                        quyền phân phối các dự án đã chọn.
                      </span>
                    </label>
                    <button
                      className="btn btn-primary"
                      disabled={busy || !activeContracts.length}
                    >
                      Cấp combo
                    </button>
                  </form>
                </section>
              </div>
              <div className="admin-columns">
                <section className="panel">
                  <h2>Hợp đồng đã lưu</h2>
                  {data.contracts.map((c: any) => (
                    <article className="admin-record" key={c.id}>
                      <State value={c.status} />
                      <h3>{c.contract_number}</h3>
                      <p>{c.legal_name}</p>
                      <p>
                        {day(c.effective_from)} → {day(c.effective_until)}
                      </p>
                      <div className="admin-actions">
                        {data.documents
                          .filter(
                            (d: any) => d.contract_id === c.id && d.available,
                          )
                          .map((d: any) => (
                            <a
                              key={d.id}
                              className="btn btn-outline btn-small"
                              href={`/api/v1/admin/documents/${d.id}`}
                            >
                              <Download size={14} />
                              PDF v{d.version}
                            </a>
                          ))}
                        <button
                          className="btn btn-outline btn-small"
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                c.status === "active"
                                  ? "Tạm dừng hợp đồng sẽ ngừng quyền hiển thị tin thuộc combo liên quan. Tiếp tục?"
                                  : "Xác nhận chị đã xem bản ký và chấp thuận kích hoạt hợp đồng này?",
                              )
                            )
                              act(`contracts/${c.id}/status`, {
                                status:
                                  c.status === "active"
                                    ? "suspended"
                                    : "active",
                                confirmed: true,
                              });
                          }}
                        >
                          {c.status === "active"
                            ? "Tạm dừng hợp đồng"
                            : "Xác nhận kích hoạt"}
                        </button>
                      </div>
                    </article>
                  ))}
                </section>
                <section className="panel">
                  <h2>Combo đã cấp</h2>
                  {data.subscriptions.map((s: any) => (
                    <article className="admin-record" key={s.id}>
                      <State value={s.status} />
                      <h3>{s.legal_name}</h3>
                      <p>
                        {s.contract_number} · {s.sale_limit} Sale ·{" "}
                        {s.active_listing_limit} tin
                      </p>
                      <p>Đến {day(s.ends_at)}</p>
                      <button
                        className="btn btn-outline btn-small"
                        disabled={busy}
                        onClick={() => {
                          if (
                            s.status === "active" &&
                            !window.confirm(
                              "Tạm dừng combo sẽ ẩn tin thuộc combo này. Tiếp tục?",
                            )
                          )
                            return;
                          act(`subscriptions/${s.id}/status`, {
                            status:
                              s.status === "active" ? "suspended" : "active",
                          });
                        }}
                      >
                        {s.status === "active"
                          ? "Tạm dừng combo"
                          : "Khôi phục combo"}
                      </button>
                    </article>
                  ))}
                </section>
              </div>
            </>
          )}
          {tab === "articles" && (
            <div className="admin-columns">
              <section className="panel">
                <h2>{editing ? "Chỉnh sửa bài viết" : "Soạn bài viết"}</h2>
                <form
                  key={editing?.id || "new"}
                  onSubmit={async (e) => {
                    const form = e.currentTarget;
                    const d = {
                      ...formBody(e),
                      ...(editing ? { id: editing.id } : {}),
                    };
                    if (await act("articles", d, "Đã lưu bản nháp bài viết.")) {
                      setEditing(null);
                      form.reset();
                    }
                  }}
                >
                  <div className="form-grid">
                    <label className="span-2">
                      Tiêu đề
                      <input
                        name="title"
                        defaultValue={editing?.title || ""}
                        minLength={2}
                        maxLength={200}
                        required
                      />
                    </label>
                    <Field
                      title="Đường dẫn bài viết"
                      name="slug"
                      defaultValue={editing?.slug || ""}
                      pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    />
                    <label>
                      Chuyên mục
                      <select
                        name="category"
                        defaultValue={editing?.category || "news"}
                      >
                        <option value="news">Tin tức</option>
                        <option value="market_analysis">
                          Phân tích thị trường
                        </option>
                      </select>
                    </label>
                    <label className="span-2">
                      Nội dung
                      <textarea
                        name="body"
                        rows={12}
                        defaultValue={editing?.body || ""}
                        minLength={30}
                        maxLength={100000}
                        required
                      />
                    </label>
                    <label className="span-2">
                      Tiêu đề SEO
                      <input
                        name="meta_title"
                        defaultValue={editing?.meta_title || ""}
                        maxLength={200}
                      />
                    </label>
                    <label className="span-2">
                      Mô tả SEO
                      <textarea
                        name="meta_description"
                        rows={3}
                        defaultValue={editing?.meta_description || ""}
                        maxLength={500}
                      />
                    </label>
                  </div>
                  <div className="admin-actions">
                    <button className="btn btn-primary" disabled={busy}>
                      Lưu bản nháp bài viết
                    </button>
                    {editing && (
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => setEditing(null)}
                      >
                        Soạn bài mới
                      </button>
                    )}
                  </div>
                </form>
              </section>
              <section className="panel">
                <h2>Danh sách bài viết</h2>
                {data.articles.map((a: any) => (
                  <article className="admin-record" key={a.id}>
                    <State value={a.status} />
                    <h3>{a.title}</h3>
                    <p>
                      {a.category === "news"
                        ? "Tin tức"
                        : "Phân tích thị trường"}
                    </p>
                    <div className="admin-actions">
                      {a.status === "published" ? (
                        <>
                          <Link
                            className="btn btn-outline btn-small"
                            href={`/bai-viet/${a.slug}`}
                          >
                            Xem bài
                          </Link>
                          <button
                            className="btn btn-outline btn-small"
                            disabled={busy}
                            onClick={() =>
                              act(
                                `articles/${a.id}/status`,
                                { status: "draft" },
                                "Bài đã được ẩn và đưa về bản nháp để chỉnh sửa.",
                              )
                            }
                          >
                            Ẩn & sửa
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="btn btn-outline btn-small"
                            onClick={() => {
                              setEditing(a);
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                          >
                            Chỉnh sửa bài
                          </button>
                          <button
                            className="btn btn-primary btn-small"
                            disabled={busy}
                            onClick={() =>
                              act(
                                `articles/${a.id}/status`,
                                { status: "published" },
                                "Bài viết đã xuất bản.",
                              )
                            }
                          >
                            Xuất bản
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                ))}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
