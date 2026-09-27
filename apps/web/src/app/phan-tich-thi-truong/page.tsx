import { Articles } from "@/components/articles";
export const metadata = { title: "Phân tích thị trường" };
export const dynamic = "force-dynamic";
export default function Page() {
  return <Articles category="market_analysis" />;
}
