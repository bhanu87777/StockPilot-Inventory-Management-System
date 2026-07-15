import { Sk, SkHeader, SkTable } from "@/components/Skeletons";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <SkHeader />
      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="panel p-5" aria-busy>
            <Sk w={120} h={12} />
            <Sk w={220} h={10} className="mt-2" />
            <Sk w={130} h={34} className="mt-4" />
          </div>
        ))}
      </div>
      <SkTable rows={10} cols={6} />
    </div>
  );
}
