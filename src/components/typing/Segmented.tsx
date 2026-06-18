// 타자 테스트/통계/리더보드 공용 세그먼트 토글.
interface SegOption<T> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string | number> {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
}

export default function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  size = 'md',
}: SegmentedProps<T>) {
  const pad = size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm';
  return (
    <div className="inline-flex rounded-full bg-white/5 border border-white/10 p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={`${pad} rounded-full font-bold transition ${
            value === o.value ? 'bg-accent text-black' : 'text-white/55 hover:text-white'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
