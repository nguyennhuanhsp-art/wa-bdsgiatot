import Link from "next/link";
import { notFound } from "next/navigation";
import { get } from "@/lib/data";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  try {
    const a = await get(`articles/${encodeURIComponent(slug)}`);
    return {
      title: a.meta_title || a.title,
      description:
        a.meta_description || a.body.replace(/\s+/g, " ").slice(0, 160),
    };
  } catch {
    return { title: "Bài viết không còn hiển thị" };
  }
}
export default async function Page({ params }: any) {
  const { slug } = await params;
  let a;
  try {
    a = await get(`articles/${encodeURIComponent(slug)}`);
  } catch {
    notFound();
  }
  return (
    <article className="container page article-detail">
      <div className="breadcrumb">
        <Link href="/">Trang chủ</Link> /{" "}
        <Link
          href={a.category === "news" ? "/tin-tuc" : "/phan-tich-thi-truong"}
        >
          {a.category === "news" ? "Tin tức" : "Phân tích thị trường"}
        </Link>
      </div>
      <span className="eyebrow">NỘI DUNG MINH HỌA</span>
      <h1>{a.title}</h1>
      <p className="muted">
        {a.author_name} · {new Date(a.published_at).toLocaleDateString("vi-VN")}
      </p>
      <img src="/images/home-2.webp" alt="Không gian sống minh họa" />
      <div className="prose">
        {a.body
          .split("\n")
          .filter(Boolean)
          .map((p: string, i: number) => (
            <p key={i}>{p}</p>
          ))}
      </div>
      <Link href="/tin-tuc" className="text-link">
        ← Trở lại danh sách bài viết
      </Link>
    </article>
  );
}
