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
  // 모바일 터치 타깃 확보(≥44px): 세로 패딩 + min-height.
  const pad =
    size === 'sm'
      ? 'px-3 py-1.5 text-xs min-h-[36px]'
      : 'px-4 py-2.5 text-sm min-h-[44px]';
  return (
    <div className="inline-flex rounded-full bg-white/5 border border-white/10 p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={`${pad} inline-flex items-center justify-center rounded-full font-bold transition ${
            value === o.value ? 'bg-accent text-black' : 'text-white/55 hover:text-white'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
