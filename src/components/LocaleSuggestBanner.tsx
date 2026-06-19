// 한국어 브라우저 첫 방문자가 영어 루트에 왔을 때 "한국어로 보기" 안내.
// 강제 리다이렉트 X(크롤러는 영어 루트 인덱싱) — 사람만 배너로 유도. 명시 선택/닫기 시 더는 안 뜸.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { switchLocale, storedLocale } from '../i18n';

const DISMISS_KEY = 'typrun_locale_banner_dismissed';

export default function LocaleSuggestBanner() {
  const { i18n } = useTranslation();
  const [hidden, setHidden] = useState(() => {
    try {
      if (storedLocale()) return true; // 이미 언어 명시 선택함
      if (sessionStorage.getItem(DISMISS_KEY)) return true; // 이번 세션에 닫음
    } catch { /* ignore */ }
    const onEnglish = !i18n.language?.startsWith('ko');
    const prefersKo =
      typeof navigator !== 'undefined' && (navigator.language || '').toLowerCase().startsWith('ko');
    return !(onEnglish && prefersKo);
  });

  if (hidden) return null;

  const dismiss = () => {
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
    setHidden(true);
  };

  return (
    <div className="fixed bottom-4 inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-3 px-4 py-2.5 rounded-full bg-ink/90 border border-white/15 backdrop-blur shadow-xl">
        <span className="text-sm text-white/85">🇰🇷 한국어로 보시겠어요?</span>
        <button
          onClick={() => switchLocale('ko')}
          className="px-3 py-1 rounded-full bg-accent text-black text-sm font-bold transition hover:brightness-105"
        >
          한국어로 보기
        </button>
        <button onClick={dismiss} aria-label="닫기" className="text-white/40 hover:text-white text-sm px-1">
          ✕
        </button>
      </div>
    </div>
  );
}
