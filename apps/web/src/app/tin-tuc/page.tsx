import { Articles } from "@/components/articles";
export const metadata = { title: "Tin tức" };
export const dynamic = "force-dynamic";
export default function Page() {
  return <Articles category="news" />;
}
