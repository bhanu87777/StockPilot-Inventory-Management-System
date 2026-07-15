import { Sk, SkHeader, SkTable } from "@/components/Skeletons";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1500px]">
      <SkHeader />
      <div className="mb-4 flex gap-3">
        <Sk w={280} h={36} />
        <Sk w={180} h={36} />
        <Sk w={260} h={36} />
      </div>
      <SkTable rows={10} cols={8} />
    </div>
  );
}
