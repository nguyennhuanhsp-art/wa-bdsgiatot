"use client";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { api } from "./contact";
import { statuses, price } from "@/lib/data";
export function ListingEditor({
  id,
  onClose,
  onSaved,
}: {
  id: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [l, setL] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    ref.current?.showModal();
    api(`workspace/listings/${id}`)
      .then(setL)
      .catch((e) => setError(e.message));
  }, [id]);
  return (
    <dialog ref={ref} className="modal editor-modal" onCancel={onClose}>
      <button className="icon-button close" onClick={onClose} aria-label="Đóng">
        <X />
      </button>
      {l ? (
        <>
          <span className="eyebrow">
            {statuses[l.status]} · #{l.public_code}
          </span>
          <h2>
            {l.status === "draft" ? "Chỉnh sửa bản nháp" : "Nội dung tin đăng"}
          </h2>
          <div className="editor-images">
            {l.images.map((m: any, i: number) => (
              <img
                key={i}
                src={m.public_url}
                alt={m.alt_text || "Ảnh tin đăng"}
              />
            ))}
          </div>
          {l.status === "draft" ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  await api(
                    `workspace/listings/${id}/edit`,
                    Object.fromEntries(new FormData(e.currentTarget)),
                  );
                  onSaved();
                  onClose();
                } catch (e: any) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Tiêu đề
                <input
                  name="title"
                  defaultValue={l.title}
                  minLength={10}
                  maxLength={200}
                  required
                />
              </label>
              <div className="form-grid">
                <label>
                  Giá ({l.currency_code})
                  <input
                    type="number"
                    name="price_amount"
                    defaultValue={l.price_amount}
                    min="1"
                    required
                  />
                </label>
                <label>
                  Diện tích (m²)
                  <input
                    type="number"
                    step="0.01"
                    name="area_m2"
                    defaultValue={l.area_m2}
                    min="1"
                    required
                  />
                </label>
                <label>
                  Phòng ngủ
                  <input
                    type="number"
                    name="bedrooms"
                    defaultValue={l.bedrooms || 0}
                    min="0"
                    max="100"
                    required
                  />
                </label>
              </div>
              <label>
                Mô tả
                <textarea
                  name="description"
                  defaultValue={l.description}
                  minLength={30}
                  maxLength={20000}
                  rows={6}
                  required
                />
              </label>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <button className="btn btn-primary full" disabled={busy}>
                {busy ? "Đang lưu…" : "Lưu chỉnh sửa"}
              </button>
            </form>
          ) : (
            <>
              <h3>{l.title}</h3>
              <p className="brand-red">
                {price(l.price_amount, l.currency_code, l.price_basis)} ·{" "}
                {Number(l.area_m2)} m²
              </p>
              <div className="prose">
                {l.description.split("\n").map((p: string, i: number) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </>
          )}
          {l.moderation
            ?.filter((m: any) => m.reason)
            .map((m: any) => (
              <div key={m.id} className="sample-note">
                Ghi chú kiểm duyệt: {m.reason}
              </div>
            ))}
        </>
      ) : (
        <p>{error || "Đang tải tin đăng…"}</p>
      )}
    </dialog>
  );
}
