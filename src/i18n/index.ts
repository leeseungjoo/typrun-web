// i18n 토대 — react-i18next. HashRouter 기반이라 locale prefix 도 해시 안에 둔다(#/en/...).
// P2(추가 방식): 기본=ko(루트), en=/en. 루트 영어화는 최종 컷오버에서.
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ko } from './locales/ko';
import { en } from './locales/en';

export type AppLocale = 'ko' | 'en';

/** 현재 해시에서 locale 과 HashRouter basename 을 추론. */
export function detectLocale(): { locale: AppLocale; basename: string } {
  const raw = window.location.hash.replace(/^#/, '');
  const seg = raw.split('/')[1] ?? '';
  if (seg === 'en') return { locale: 'en', basename: '/en' };
  return { locale: 'ko', basename: '/' };
}

/** EN/KR 전환 — prefix 를 갈아끼우고 새로고침(basename 재초기화). */
export function switchLocale(target: AppLocale): void {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const parts = raw.split('/'); // ['', 'en', 'test'] 형태
  const hasEn = parts[1] === 'en';
  const rest = hasEn ? '/' + parts.slice(2).join('/') : raw; // locale 제거한 경로
  const cleanRest = rest === '/' ? '' : rest;
  const next = target === 'en' ? `/en${cleanRest}` : (cleanRest || '/');
  window.location.hash = `#${next}`;
  window.location.reload();
}

export function initI18n(locale: AppLocale): typeof i18n {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      resources: {
        ko: { translation: ko },
        en: { translation: en },
      },
      lng: locale,
      fallbackLng: 'ko',
      interpolation: { escapeValue: false },
      returnNull: false,
    });
  }
  return i18n;
}

export default i18n;
