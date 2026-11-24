// 단계 안내 배너 — 리그 단계(lib/leagueStages)가 바뀔 때 몇 초 떠 있다 사라진다. 판정·입력과 무관한 그림 레이어.
// 떨어지는 단어보다 먼저 그려 단어가 배너 위로 지나가게 한다(GamePage 에서 단어 목록 앞에 둔다).
import { AnimatePresence, motion } from 'framer-motion';
import type { LeagueStage } from '../../lib/leagueStages';

interface StageAnnounceProps {
  /** 지금 보여 줄 단계. null 이면 아무것도 그리지 않는다 */
  stage: LeagueStage | null;
  /** 단계 번호(0부터) — 바뀌면 배너가 새로 등장한다 */
  stageIndex: number;
  stageCount: number;
  isHeist: boolean;
}

// 위치는 y 가 아니라 transform 문자열로 — framer 의 y 는 매 프레임 써서 글자가 떨린다(CLAUDE.md 지뢰)
const ENTER = { opacity: 0, transform: 'translateY(14px)' };
const SHOWN = { opacity: 1, transform: 'translateY(0px)' };
const LEAVE = { opacity: 0, transform: 'translateY(0px)' };

export default function StageAnnounce({ stage, stageIndex, stageCount, isHeist }: StageAnnounceProps) {
  return (
    <AnimatePresence>
      {stage && (
        <motion.div
          key={stageIndex}
          role="status"
          aria-live="polite"
          initial={ENTER}
          animate={SHOWN}
          exit={LEAVE}
          // CSS transition 클래스를 같이 달지 말 것(끝나는 순간 다시 재생돼 깜빡인다)
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-x-0 flex justify-center px-4 pointer-events-none"
          // 도둑 런은 표시줄이 2줄이고 캐릭터가 화면 가운데라 그 사이에 둔다
          style={{ top: isHeist ? '25%' : '20%' }}
        >
          <div
            className={`max-w-xl rounded-2xl border px-6 py-4 text-center shadow-[0_10px_40px_rgba(0,0,0,0.45)] ${
              isHeist ? 'border-amber-300/60 bg-[rgba(11,16,38,0.86)]' : 'border-sky-300/50 bg-slate-900/85'
            }`}
          >
            <div className={`text-xs font-bold tracking-[0.3em] tabular-nums ${isHeist ? 'text-amber-300/90' : 'text-sky-300/90'}`}>
              {stageIndex + 1} / {stageCount}
            </div>
            <div
              className="mt-1 text-2xl md:text-4xl font-black leading-tight text-white"
              style={{ wordBreak: 'keep-all', overflowWrap: 'anywhere' }}
            >
              {stage.title}
            </div>
            {stage.hint && (
              <div className="mt-2 text-sm md:text-lg font-semibold text-white/80" style={{ wordBreak: 'keep-all' }}>
                {stage.hint}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
