import { Sk, SkHeader } from "@/components/Skeletons";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1100px]">
      <SkHeader />
      <div className="panel mb-5 p-6" aria-busy>
        <Sk w={120} h={12} />
        <Sk h={60} className="mt-4" />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="panel p-5" aria-busy>
            <Sk w={70} h={10} />
            <Sk w={180} h={14} className="mt-3" />
            <Sk h={40} className="mt-3" />
          </div>
        ))}
      </div>
    </div>
  );
}
