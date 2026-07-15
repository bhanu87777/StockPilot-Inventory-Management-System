import { Sk, SkHeader } from "@/components/Skeletons";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <SkHeader />
      {[0, 1, 2].map((i) => (
        <div key={i} className="panel mb-4 p-5" aria-busy>
          <div className="mb-3 flex items-center gap-3">
            <Sk w={130} h={18} />
            <Sk w={80} h={18} />
          </div>
          <Sk w={300} h={10} className="mb-4" />
          <Sk h={80} />
        </div>
      ))}
    </div>
  );
}
