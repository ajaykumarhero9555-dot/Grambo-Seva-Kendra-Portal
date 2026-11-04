import { Landmark } from 'lucide-react';

export default function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-700 text-white shadow-sm">
        <Landmark className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="text-base font-semibold tracking-tight text-slate-900">Grambo Seva Kendra</span>
    </div>
  );
}
