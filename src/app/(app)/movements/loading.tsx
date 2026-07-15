import { Sk, SkHeader, SkTable } from "@/components/Skeletons";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1500px]">
      <SkHeader />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="panel space-y-4 p-6" aria-busy>
          <Sk w={140} h={12} />
          <Sk h={36} />
          <Sk h={36} />
          <Sk h={36} />
          <Sk h={36} />
          <Sk h={40} />
        </div>
        <div className="xl:col-span-2">
          <SkTable rows={10} cols={7} />
        </div>
      </div>
    </div>
  );
}
