import { Results } from "@/components/results";
export const metadata = { title: "Cho thuê dự án" };
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: any) {
  return <Results params={await searchParams} transaction="rent" />;
}
