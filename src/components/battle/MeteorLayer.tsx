import { AnimatePresence, motion } from 'framer-motion';

export interface Meteor {
  id: number;
  x: number; // % from left
  text: string;
  score: number;
}

// 상대가 단어를 깰 때 내 화면을 가로지르는 별똥별(연출). 점수 팝업 동반.
export default function MeteorLayer({ meteors }: { meteors: Meteor[] }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-30" aria-hidden>
      <AnimatePresence>
        {meteors.map((m) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: -60, scale: 0.6, rotate: -18 }}
            animate={{ opacity: [0, 1, 1, 0], y: 420, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.15, ease: 'easeIn' }}
            className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
            style={{ left: `${m.x}%` }}
          >
            <span className="text-lg font-bold text-orange-300 drop-shadow-[0_0_10px_rgba(255,140,0,0.85)] whitespace-nowrap">
              ☄️ {m.text}
            </span>
            <span className="font-impact text-sm text-orange-200">+{m.score.toLocaleString()}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
