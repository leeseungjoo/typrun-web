// i18n 토대 — react-i18next. BrowserRouter 컷오버 후: 루트=en(글로벌 기본), /kr=ko.
// path 기반 locale + Router basename. (이전: HashRouter #/en — migrateLocationIfNeeded 가 흡수)
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ko } from './locales/ko';
import { en } from './locales/en';

export type AppLocale = 'ko' | 'en';

const STORE_KEY = 'typrun_locale';

/** pathname 첫 세그먼트로 locale·basename 추론. 루트=en, /kr=ko. */
export function detectLocale(): { locale: AppLocale; basename: string } {
  const seg = window.location.pathname.split('/')[1] ?? '';
  if (seg === 'kr') return { locale: 'ko', basename: '/kr' };
  return { locale: 'en', basename: '/' };
}

/** 사용자가 명시 선택한 locale 저장값(없으면 null). */
export function storedLocale(): AppLocale | null {
  try {
    const v = localStorage.getItem(STORE_KEY);
    return v === 'ko' || v === 'en' ? v : null;
  } catch {
    return null;
  }
}

/**
 * 라우터 마운트 전에 1회 호출 — 정규 경로로 location 교정.
 * 리다이렉트했으면 true(이후 렌더 스킵). 다음을 흡수한다:
 *  1) 구 HashRouter 딥링크(#/draw?token=, #/login, #/en/test 등) → path
 *  2) /en/* 별칭(컷오버 후 en=루트) → 루트
 *  3) 저장된 ko 선호인데 루트(en)면 → /kr (사용자가 고른 언어 유지)
 */
export function migrateLocationIfNeeded(): boolean {
  const { origin, pathname, search, hash } = window.location;

  // 1) 구 해시 라우트(#/...) → path
  if (/^#\/.+/.test(hash)) {
    let hp = hash.replace(/^#/, ''); // '/draw?token=..', '/en/test', '/login'
    // /en 별칭 제거(en=루트)
    hp = hp.replace(/^\/en(?=\/|$)/, '') || '/';
    window.location.replace(origin + hp);
    return true;
  }

  const seg = pathname.split('/')[1] ?? '';

  // 2) /en/* 별칭 → 루트(en)
  if (seg === 'en') {
    const rest = pathname.replace(/^\/en/, '') || '/';
    window.location.replace(origin + rest + search);
    return true;
  }

  // 3) 저장된 ko 선호 → /kr (루트에 있을 때만)
  if (seg !== 'kr' && storedLocale() === 'ko') {
    const rest = pathname === '/' ? '' : pathname;
    window.location.replace(origin + '/kr' + rest + search);
    return true;
  }

  return false;
}

/** EN/KR 전환 — 선택 저장 + 정규 경로로 이동(새로고침으로 basename 재초기화). */
export function switchLocale(target: AppLocale): void {
  try { localStorage.setItem(STORE_KEY, target); } catch { /* ignore */ }
  const onKr = (window.location.pathname.split('/')[1] ?? '') === 'kr';
  const rest = onKr ? (window.location.pathname.replace(/^\/kr/, '') || '/') : window.location.pathname;
  const cleanRest = rest === '/' ? '' : rest;
  const next = target === 'ko' ? `/kr${cleanRest}` : (cleanRest || '/');
  window.location.assign(next + window.location.search);
}

export function initI18n(locale: AppLocale): typeof i18n {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      resources: {
        ko: { translation: ko },
        en: { translation: en },
      },
      lng: locale,
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
      returnNull: false,
    });
  }
  return i18n;
}

export default i18n;
