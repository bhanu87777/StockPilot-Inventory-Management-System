import { SkHeader, SkTable } from "@/components/Skeletons";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1100px]">
      <SkHeader />
      <SkTable rows={6} cols={6} />
    </div>
  );
}
