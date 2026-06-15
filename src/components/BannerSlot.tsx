import { useEffect, useState } from 'react';
import { getBanner, clickBanner, type BannerData } from '../api/banner';

type Props = {
  slot: 'gameover' | 'main' | 'lobby';
  isMember?: boolean;
  className?: string;
};

const KIND_TAG: Record<string, string> = { b2b: 'AD', event: 'EVENT', notice: 'NOTICE' };

// 위치(slot)별 배너 노출. 서버가 가중치로 1개 선택. 클릭 시 집계 후 링크 이동.
// 배너 없으면 아무것도 렌더하지 않는다(레이아웃 영향 최소).
export default function BannerSlot({ slot, isMember = false, className = '' }: Props) {
  const [banner, setBanner] = useState<BannerData>(null);

  useEffect(() => {
    let alive = true;
    getBanner(slot, isMember)
      .then((b) => { if (alive) setBanner(b); })
      .catch(() => { /* 배너 실패는 무시 */ });
    return () => { alive = false; };
  }, [slot, isMember]);

  if (!banner) return null;

  const hasImage = !!banner.imageUrl;
  const tag = KIND_TAG[banner.kind] ?? 'AD';

  function onClick() {
    if (!banner) return;
    clickBanner(banner.seq).catch(() => {});
    if (banner.linkUrl) window.open(banner.linkUrl, '_blank', 'noopener,noreferrer');
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative w-full max-w-2xl overflow-hidden rounded-2xl text-left transition-transform duration-200 hover:scale-[1.015] focus:outline-none ${className}`}
      style={{
        background: hasImage ? undefined : (banner.bgColor || '#6A4FFC'),
        minHeight: 88,
      }}
    >
      {hasImage && (
        <img src={banner.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}
      {/* 가독성 오버레이 */}
      <div className="absolute inset-0" style={{ background: hasImage ? 'linear-gradient(90deg, rgba(0,0,0,.55), rgba(0,0,0,.15))' : 'none' }} />
      <div className="relative z-10 flex items-center justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <span className="inline-block rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold tracking-wider text-white/90">{tag}</span>
          <div className="mt-1 truncate text-base font-bold text-white drop-shadow">{banner.title}</div>
          {banner.subtitle && <div className="truncate text-sm text-white/80">{banner.subtitle}</div>}
        </div>
        {banner.ctaText && (
          <span className="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-bold text-black shadow transition-colors group-hover:bg-yellow-300">
            {banner.ctaText}
          </span>
        )}
      </div>
    </button>
  );
}
