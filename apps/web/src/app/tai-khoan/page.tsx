"use client";
import { ListingEditor } from "@/components/listing-editor";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard,
  FileText,
  Users,
  MessageSquare,
  Plus,
  LogOut,
  ArrowUpRight,
  Upload,
  CheckCircle2,
  Building2,
  X,
  Copy,
  Eye,
} from "lucide-react";
import { api } from "@/components/contact";
import { price, statuses, types } from "@/lib/data";
export default function Dashboard() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null),
    [data, setData] = useState<any>(null),
    [tab, setTab] = useState("listings"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [create, setCreate] = useState(false),
    [activation, setActivation] = useState(""),
    [filter, setFilter] = useState(""),
    [selected, setSelected] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const m = await api("me");
      if (!m.user) {
        router.replace("/dang-nhap");
        return;
      }
      setMe(m);
      setData(await api("workspace"));
    } catch (e: any) {
      setError(e.message);
    }
  }, [router]);
  useEffect(() => {
    load();
  }, [load]);
  async function act(path: string, body: any, msg = "Đã cập nhật.") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await api(path, body);
      if (r.activation_url) setActivation(r.activation_url);
      setNotice(msg);
      await load();
      return r;
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!me || !data)
    return (
      <div className="container page empty">
        <h1>
          {error ? "Chưa tải được tài khoản" : "Đang mở không gian làm việc…"}
        </h1>
        {error && (
          <>
            <p className="error">{error}</p>
            <button className="btn btn-primary" onClick={load}>
              Thử lại
            </button>
          </>
        )}
      </div>
    );
  const admin = me.user.platform_role === "admin";
  const manager =
    admin ||
    me.memberships.some(
      (m: any) => m.role === "org_admin" && m.status === "active",
    );
  const subs = data.subscriptions.filter((s: any) => s.status === "active");
  const current = subs[0];
  const activeSeats = data.seats.filter((s: any) => s.status === "active");
  const live = data.listings.filter((l: any) => l.status === "published");
  const list = data.listings.filter((l: any) => !filter || l.status === filter);
  return (
    <div className="workspace">
      <div className="container workspace-layout">
        <aside className="workspace-sidebar">
          <span className="eyebrow">KHÔNG GIAN LÀM VIỆC</span>
          <div className="workspace-profile">
            <div className="avatar">{me.user.display_name.slice(0, 1)}</div>
            <b>{me.user.display_name}</b>
            <span>
              {admin
                ? "Quản trị nền tảng"
                : manager
                  ? "Quản lý doanh nghiệp"
                  : "Chuyên viên kinh doanh"}
            </span>
          </div>
          <nav>
            {[
              [
                "listings",
                FileText,
                admin ? "Duyệt & quản lý tin" : "Tin đăng của tôi",
              ],
              ...(manager ? [["team", Users, "Đội ngũ & combo"]] : []),
              ["leads", MessageSquare, "Khách hàng quan tâm"],
            ].map(([key, I, label]: any) => (
              <button
                key={key}
                className={tab === key ? "selected" : ""}
                onClick={() => {
                  setTab(key);
                  setCreate(false);
                  setError("");
                  setNotice("");
                }}
              >
                <I size={18} />
                {label}
                {key === "leads" && data.leads.length > 0 && (
                  <small>{data.leads.length}</small>
                )}
              </button>
            ))}
          </nav>
          {admin && (
            <Link
              className="sidebar-link"
              style={{ display: "flex" }}
              href="/quan-tri"
            >
              <Building2 size={17} />
              Quản trị hệ thống
            </Link>
          )}
          <Link className="sidebar-link" href="/mua-ban">
            <Eye size={17} />
            Xem trang công khai
          </Link>
          <button
            className="logout"
            onClick={async () => {
              await api("auth/logout", {});
              router.push("/dang-nhap");
              router.refresh();
            }}
          >
            <LogOut size={17} />
            Đăng xuất
          </button>
        </aside>
        <div className="workspace-main">
          <div className="workspace-title">
            <div>
              <span className="eyebrow">
                {new Date().toLocaleDateString("vi-VN")}
              </span>
              <h1>
                {tab === "team"
                  ? "Đội ngũ & combo"
                  : tab === "leads"
                    ? "Kết nối với khách hàng"
                    : admin
                      ? "Quản lý nội dung đăng tin"
                      : "Chào bạn, bắt đầu ngày mới!"}
              </h1>
              <p>
                {me.demo
                  ? "Môi trường thử nghiệm · Thay đổi được lưu trên máy này."
                  : me.memberships[0]?.legal_name}
              </p>
            </div>
            {tab === "listings" && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  setCreate(!create);
                  setError("");
                }}
              >
                <Plus size={18} />
                {create ? "Đóng biểu mẫu" : "Tạo tin mới"}
              </button>
            )}
          </div>
          <div className="stats-grid">
            <div>
              <span>Tin đang hiển thị</span>
              <strong>
                {live.length}
                <small>
                  {current ? ` / ${current.active_listing_limit}` : ""}
                </small>
              </strong>
              <span className="fine">Theo phạm vi quyền của bạn</span>
            </div>
            <div>
              <span>Chờ duyệt</span>
              <strong>
                {
                  data.listings.filter((l: any) => l.status === "pending")
                    .length
                }
              </strong>
              <span className="fine">Tin đã gửi quản trị</span>
            </div>
            <div>
              <span>
                {manager ? "Tài khoản Sale đang dùng" : "Dự án được phân công"}
              </span>
              <strong>
                {manager ? activeSeats.length : data.assignments.length}
                <small>
                  {manager && current ? ` / ${current.sale_limit}` : ""}
                </small>
              </strong>
              <span className="fine">
                {manager
                  ? "Trong các combo được cấp"
                  : "Đang còn quyền đăng tin"}
              </span>
            </div>
          </div>
          {error && (
            <div className="error banner" role="alert">
              {error}
            </div>
          )}
          {notice && (
            <div className="success banner" role="status">
              <CheckCircle2 size={18} />
              {notice}
            </div>
          )}
          {tab === "listings" && (
            <>
              {create && (
                <section className="panel create-panel">
                  <div className="panel-heading">
                    <h2>Soạn tin đăng mới</h2>
                    <button
                      className="icon-button"
                      onClick={() => setCreate(false)}
                      aria-label="Đóng"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  {!data.assignments.length ? (
                    <p>
                      Chưa có dự án được phân công. Vui lòng liên hệ quản lý
                      doanh nghiệp.
                    </p>
                  ) : (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        const r = await act(
                          "workspace/listings",
                          Object.fromEntries(f),
                          "Đã lưu bản nháp. Thêm ít nhất một ảnh trước khi gửi duyệt.",
                        );
                        if (r) setCreate(false);
                      }}
                    >
                      <div className="form-grid">
                        <label className="span-2">
                          Dự án được phân công
                          <select name="assignment_id" required>
                            {data.assignments.map((a: any) => (
                              <option key={a.id} value={a.id}>
                                {a.project_name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Loại hình
                          <select name="property_type_code">
                            <option value="villa">Biệt thự</option>
                            <option value="townhouse">Nhà phố</option>
                            <option value="shophouse">Shophouse</option>
                          </select>
                        </label>
                        <label>
                          Nhu cầu
                          <select name="transaction_type">
                            <option value="sale">Mua – Bán</option>
                            <option value="rent">Cho thuê (giá/tháng)</option>
                          </select>
                        </label>
                        <label className="span-2">
                          Tiêu đề
                          <input
                            name="title"
                            minLength={10}
                            maxLength={200}
                            required
                            placeholder="Ví dụ: Biệt thự sân vườn tại The Garden Riverside"
                          />
                        </label>
                        <label>
                          Giá bán / giá thuê tháng
                          <input
                            name="price_amount"
                            type="number"
                            min="1"
                            step="any"
                            required
                            placeholder="12800000000"
                          />
                        </label>
                        <label>
                          Đơn vị tiền
                          <select name="currency_code">
                            <option value="VND">VND</option>
                            <option value="USD">USD</option>
                          </select>
                        </label>
                        <label>
                          Diện tích (m²)
                          <input
                            name="area_m2"
                            type="number"
                            min="1"
                            step="0.01"
                            required
                          />
                        </label>
                        <label>
                          Phòng ngủ
                          <input
                            name="bedrooms"
                            type="number"
                            min="0"
                            max="100"
                            defaultValue="3"
                            required
                          />
                        </label>
                        <label className="span-2">
                          Mô tả chi tiết
                          <textarea
                            name="description"
                            rows={5}
                            minLength={30}
                            maxLength={20000}
                            required
                            placeholder="Mô tả không gian, tiện ích và thông tin cần biết (ít nhất 30 ký tự)."
                          />
                        </label>
                      </div>
                      <button className="btn btn-primary" disabled={busy}>
                        Lưu bản nháp
                      </button>
                    </form>
                  )}
                </section>
              )}
              <div className="panel">
                <div className="panel-heading">
                  <h2>
                    {admin ? "Tin đăng trong hệ thống" : "Danh sách tin đăng"}
                  </h2>
                  <select
                    aria-label="Lọc trạng thái tin"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="">Tất cả trạng thái</option>
                    {Object.entries(statuses).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                {list.length ? (
                  list.map((l: any) => (
                    <div className="workspace-listing" key={l.id}>
                      <div className="workspace-listing-main">
                        <span className={`status status-${l.status}`}>
                          {statuses[l.status]}
                        </span>
                        <h3>{l.title}</h3>
                        <p>
                          {l.project_name} · {Number(l.area_m2)} m² ·{" "}
                          {price(
                            l.price_amount,
                            l.currency_code,
                            l.price_basis,
                          )}
                        </p>
                        <span className="fine">
                          #{l.public_code} · {l.image_count} ảnh ·{" "}
                          {types[l.property_type_code]}
                        </span>
                      </div>
                      <div className="listing-actions">
                        <button
                          className="btn btn-outline btn-small"
                          onClick={() => setSelected(l.id)}
                        >
                          {l.status === "draft" ? "Chỉnh sửa" : "Chi tiết"}
                        </button>
                        {l.status === "draft" && (
                          <>
                            <label className="btn btn-outline btn-small upload-button">
                              <Upload size={15} />
                              Thêm ảnh
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                disabled={busy}
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  setBusy(true);
                                  setError("");
                                  const f = new FormData();
                                  f.set("file", file);
                                  try {
                                    const r = await fetch(
                                      `/api/v1/workspace/listings/${l.id}/image`,
                                      { method: "POST", body: f },
                                    );
                                    const d = await r.json();
                                    if (!r.ok) throw new Error(d.message);
                                    setNotice("Đã tải ảnh lên.");
                                    await load();
                                  } catch (e: any) {
                                    setError(e.message);
                                  } finally {
                                    setBusy(false);
                                    e.target.value = "";
                                  }
                                }}
                              />
                            </label>
                            <button
                              className="btn btn-primary btn-small"
                              disabled={busy || !Number(l.image_count)}
                              onClick={() =>
                                act(
                                  `workspace/listings/${l.id}/status`,
                                  { status: "pending" },
                                  "Đã gửi quản trị duyệt tin.",
                                )
                              }
                            >
                              Gửi duyệt
                            </button>
                          </>
                        )}
                        {l.status === "pending" && admin && (
                          <>
                            <button
                              className="btn btn-primary btn-small"
                              disabled={busy}
                              onClick={() =>
                                act(
                                  `workspace/listings/${l.id}/status`,
                                  { status: "published" },
                                  "Đã duyệt. Tin hiển thị công khai trong tối đa 30 ngày theo quyền dự án.",
                                )
                              }
                            >
                              Duyệt đăng
                            </button>
                            <button
                              className="btn btn-outline btn-small"
                              disabled={busy}
                              onClick={() => {
                                const reason = window.prompt(
                                  "Lý do yêu cầu chỉnh sửa:",
                                );
                                if (reason?.trim())
                                  act(`workspace/listings/${l.id}/status`, {
                                    status: "rejected",
                                    reason,
                                  });
                              }}
                            >
                              Yêu cầu sửa
                            </button>
                          </>
                        )}
                        {l.status === "published" && (
                          <>
                            <Link
                              className="btn btn-outline btn-small"
                              href={`/tin/${l.public_code}`}
                            >
                              Xem tin <ArrowUpRight size={14} />
                            </Link>
                            <button
                              className="btn btn-outline btn-small"
                              disabled={busy}
                              onClick={() =>
                                act(
                                  `workspace/listings/${l.id}/status`,
                                  { status: "hidden" },
                                  "Đã ẩn tin khỏi trang công khai.",
                                )
                              }
                            >
                              Ẩn tin
                            </button>
                          </>
                        )}
                        {["hidden", "rejected"].includes(l.status) && (
                          <button
                            className="btn btn-outline btn-small"
                            disabled={busy}
                            onClick={() =>
                              act(
                                `workspace/listings/${l.id}/status`,
                                { status: "draft" },
                                "Đã đưa về bản nháp.",
                              )
                            }
                          >
                            Về bản nháp
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty small">
                    <FileText size={32} />
                    <h3>Chưa có tin ở trạng thái này</h3>
                    <p>Tạo tin mới hoặc chọn một trạng thái khác.</p>
                  </div>
                )}
              </div>
            </>
          )}
          {tab === "team" && (
            <>
              <section className="panel">
                <h2>Combo đã được cấp</h2>
                {subs.length ? (
                  subs.map((s: any) => (
                    <div className="combo-row" key={s.id}>
                      <Building2 />
                      <div>
                        <b>
                          {s.sale_limit} tài khoản Sale ·{" "}
                          {s.active_listing_limit} tin hiển thị
                        </b>
                        <p>
                          Hiệu lực đến{" "}
                          {new Date(s.ends_at).toLocaleDateString("vi-VN")}
                        </p>
                      </div>
                      <span className="status status-published">
                        Đang hoạt động
                      </span>
                    </div>
                  ))
                ) : (
                  <p>Doanh nghiệp chưa có combo đang hoạt động.</p>
                )}
                <p className="fine">
                  Hạn mức và quyền dự án được quản trị cấp theo hợp đồng. Trang
                  này không thu phí hoặc bán suất đăng tin lẻ.
                </p>
              </section>
              {subs.length > 0 && (
                <section className="panel">
                  <h2>Mời tài khoản Sale</h2>
                  <p className="muted">
                    Tài khoản mới sử dụng một suất trong combo.
                  </p>
                  <form
                    className="invite-form"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      await act(
                        "workspace/invite",
                        Object.fromEntries(new FormData(e.currentTarget)),
                        "Đã tạo lời mời và giữ một suất Sale.",
                      );
                    }}
                  >
                    <label>
                      Combo
                      <select name="subscription_id">
                        {subs.map((s: any) => (
                          <option key={s.id} value={s.id}>
                            {s.sale_limit} Sale · đến{" "}
                            {new Date(s.ends_at).toLocaleDateString("vi-VN")}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Họ và tên
                      <input
                        name="name"
                        minLength={2}
                        required
                        placeholder="Tên nhân viên"
                      />
                    </label>
                    <label>
                      Email
                      <input
                        name="email"
                        type="email"
                        required
                        placeholder="sale@congty.vn"
                      />
                    </label>
                    <button className="btn btn-primary" disabled={busy}>
                      Tạo lời mời
                    </button>
                  </form>
                  {activation && (
                    <div className="activation-link">
                      <b>Link kích hoạt thử nghiệm — chưa gửi email</b>
                      <Link href={activation}>
                        {typeof window === "undefined"
                          ? ""
                          : window.location.origin}
                        {activation}
                      </Link>
                    </div>
                  )}
                </section>
              )}
              <section className="panel">
                <h2>Thành viên doanh nghiệp</h2>
                {data.members.map((m: any) => {
                  const seat = activeSeats.find(
                    (s: any) => s.member_id === m.id,
                  );
                  return (
                    <div className="member-row" key={m.id}>
                      <div className="avatar small-avatar">
                        {m.display_name.slice(0, 1)}
                      </div>
                      <div>
                        <b>{m.display_name}</b>
                        <p>{m.email}</p>
                        <span className="fine">
                          {m.role === "org_admin" ? "Quản lý" : "Sale"} ·{" "}
                          {m.status === "active"
                            ? "Đã kích hoạt"
                            : m.status === "invited"
                              ? "Chờ kích hoạt"
                              : "Đã khóa"}
                        </span>
                      </div>
                      {seat && (
                        <button
                          className="btn btn-outline btn-small"
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                "Thu hồi suất Sale sẽ ẩn các tin liên quan. Tiếp tục?",
                              )
                            )
                              act(
                                "workspace/revoke",
                                { seat_id: seat.id },
                                "Đã thu hồi suất và ẩn các tin liên quan.",
                              );
                          }}
                        >
                          Thu hồi suất
                        </button>
                      )}
                    </div>
                  );
                })}
              </section>
              {activeSeats.length > 0 && (
                <section className="panel">
                  <h2>Phân công dự án cho Sale</h2>
                  <form
                    className="invite-form"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      await act(
                        "workspace/assign",
                        Object.fromEntries(new FormData(e.currentTarget)),
                        "Đã phân công dự án.",
                      );
                    }}
                  >
                    <label>
                      Nhân viên
                      <select name="seat_id">
                        {activeSeats.map((s: any) => (
                          <option key={s.id} value={s.id}>
                            {data.members.find((m: any) => m.id === s.member_id)
                              ?.display_name || s.member_id}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Dự án trong combo
                      <select name="grant_id">
                        {data.grants
                          .filter((g: any) => g.status === "active")
                          .map((g: any) => (
                            <option key={g.id} value={g.id}>
                              {g.project_name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <button className="btn btn-primary" disabled={busy}>
                      Giao dự án
                    </button>
                  </form>
                  <div className="assignment-list">
                    {data.assignments.map((a: any) => (
                      <p key={a.id}>
                        <CheckCircle2 size={15} />
                        {
                          data.members.find((m: any) => m.id === a.member_id)
                            ?.display_name
                        }{" "}
                        → {a.project_name}
                      </p>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
          {tab === "leads" && (
            <section className="panel">
              <h2>Yêu cầu tư vấn ({data.leads.length})</h2>
              {data.leads.length ? (
                data.leads.map((l: any) => (
                  <article className="lead-row" key={l.id}>
                    <div>
                      <b>{l.customer_name}</b>
                      <span className="fine">
                        {new Date(l.created_at).toLocaleString("vi-VN")}
                      </span>
                    </div>
                    <p className="brand-red">{l.contact_detail}</p>
                    <h3>{l.listing_title}</h3>
                    <p>{l.message || "Không có lời nhắn."}</p>
                  </article>
                ))
              ) : (
                <div className="empty small">
                  <MessageSquare size={36} />
                  <h3>Chưa có yêu cầu tư vấn</h3>
                  <p>
                    Yêu cầu gửi từ trang chi tiết tin đăng sẽ xuất hiện tại đây.
                  </p>
                  <Link href="/mua-ban" className="text-link">
                    Mở trang tin đăng →
                  </Link>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
      {selected && (
        <ListingEditor
          id={selected}
          onClose={() => setSelected(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
