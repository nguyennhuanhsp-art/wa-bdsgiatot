import { Results } from "@/components/results";
export const metadata = { title: "Mua bán dự án" };
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: any) {
  return <Results params={await searchParams} transaction="sale" />;
}
