import { request } from './client';

export type BannerData = {
  seq: number;
  kind: string;
  slot: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  linkUrl: string;
  bgColor: string;
  ctaText: string;
} | null;

// 위치별 노출 배너 1개 조회 (서버에서 가중치 랜덤 선택 + 노출수 집계)
export function getBanner(slot: string, isMember = false): Promise<BannerData> {
  return request<BannerData>(`/banners?slot=${encodeURIComponent(slot)}${isMember ? '&member=1' : ''}`);
}

// 배너 클릭 집계
export function clickBanner(seq: number): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/banners/click', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seq }),
  });
}
