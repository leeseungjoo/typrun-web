import { motion } from 'framer-motion';

// 점검모드 ON 시 게임 전체를 대체하는 안내 화면.
export default function MaintenanceGate({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center gap-5 max-w-md"
      >
        <div className="text-7xl drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]">🛠️</div>
        <h1 className="font-impact text-3xl md:text-4xl text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.75)]">
          서비스 점검 중
        </h1>
        <p className="text-white/80 text-base leading-relaxed whitespace-pre-wrap drop-shadow-[0_2px_6px_rgba(0,0,0,0.75)]">
          {message || '잠시 후 다시 이용해 주세요.'}
        </p>
        <p className="text-white/45 text-xs">불편을 드려 죄송합니다 · TypRun</p>
      </motion.div>
    </div>
  );
}
