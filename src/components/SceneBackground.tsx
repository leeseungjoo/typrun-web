import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { pickSessionTheme } from '../lib/theme';

/**
 * 전 페이지 공통 배경 (App 레벨에서 1회 마운트).
 * 레이어 순서 (Figma 301-62): 배경 풍경 → 캐릭터 → 80% dim → (UI는 이 위)
 * - 배경 풍경은 고정
 * - 캐릭터는 화면 절반 크기로 유저를 바라보며 위아래로 둥실
 * - 80% dim 으로 캐릭터/배경을 눌러 UI 가독성 확보
 */
export default function SceneBackground() {
  const theme = useMemo(() => pickSessionTheme(), []);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-ink" aria-hidden="true">
      {/* 1. 배경 풍경 — 가만히 고정 */}
      <img
        src={theme.bg}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* 2. 캐릭터 — 화면 절반, 하단에서 유저를 바라보며 둥실 (네이티브 비율 유지) */}
      <motion.img
        key={theme.id}
        src={theme.char}
        alt=""
        className="absolute left-1/2 w-auto max-w-none select-none drop-shadow-[0_18px_45px_rgba(0,0,0,0.5)]"
        style={{
          x: '-50%',
          bottom: `-${theme.charDipVh}vh`,
          height: `${theme.charHeightVh}vh`,
        }}
        initial={{ y: 0 }}
        animate={{ y: [0, 22, 0] }}
        transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* 3. 80% dim — 캐릭터 위, UI 아래. 가독성 확보 (Figma rgba(15,18,38,0.8)) */}
      <div className="absolute inset-0 bg-ink/80" />
    </div>
  );
}
