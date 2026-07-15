import { SkHeader, SkKpiRow, SkChart, SkTable } from "@/components/Skeletons";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1500px]">
      <SkHeader />
      <SkKpiRow count={4} />
      <div className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SkChart />
        <SkChart />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SkTable rows={5} cols={5} />
        <SkTable rows={5} cols={5} />
      </div>
      <span className="sr-only">Loading dashboard…</span>
    </div>
  );
}
