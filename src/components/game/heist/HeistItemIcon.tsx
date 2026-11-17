// 도둑 런 아이템 아이콘 — 이모지 대신 사장님 생성본 그림(public/heist/items)을 쓴다.
// 아이템 정의(lib/items.ts)의 icon 이모지는 그대로 둔다 — 교실 모드·배틀 화면이 계속 쓴다.
//
// 사용 예
//   <HeistItemIcon effect="freeze" />                          // 최소(장식용, 이름은 옆 글자가 읽어 준다)
//   <HeistItemIcon effect={item.effect} className="w-6 h-6" /> // 크기 지정
import type { ItemEffect } from '../../../lib/items';

interface HeistItemIconProps {
  effect: ItemEffect;
  /** 크기·여백용 클래스(기본: 글자 크기에 맞춘 1.3em). */
  className?: string;
}

export const heistItemIconSrc = (effect: ItemEffect): string => `/heist/items/${effect}.webp`;

export default function HeistItemIcon({ effect, className = 'heist-item-icon' }: HeistItemIconProps) {
  return <img src={heistItemIconSrc(effect)} alt="" aria-hidden className={className} draggable={false} />;
}
