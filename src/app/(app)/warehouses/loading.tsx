import { Sk, SkHeader, SkTable } from "@/components/Skeletons";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1500px]">
      <SkHeader />
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="panel p-5" aria-busy>
            <Sk w={80} h={18} />
            <Sk w={180} h={12} className="mt-2" />
            <Sk w={220} h={12} className="mt-3" />
          </div>
        ))}
      </div>
      <SkTable rows={8} cols={6} />
    </div>
  );
}
