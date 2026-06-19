import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { detectLocale, initI18n, migrateLocationIfNeeded } from './i18n';
import './index.css';

// 컷오버: 구 해시 딥링크(#/...)·/en 별칭·저장된 ko 선호를 정규 경로로 교정.
// 리다이렉트가 필요하면 여기서 navigate 하고 렌더는 건너뛴다.
if (!migrateLocationIfNeeded()) {
  // pathname → locale 추론 → i18n 초기화 + BrowserRouter basename(루트=en, /kr=ko)
  const { locale, basename } = detectLocale();
  initI18n(locale);
  document.documentElement.lang = locale;

  // 초대링크 ?ref=<N> 보관(가입 시 사용). path 쿼리 + 잔존 해시 쿼리 모두 수용.
  try {
    const search = window.location.search.replace(/^\?/, '');
    const hash = window.location.hash || '';
    const hashSearch = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
    const params = new URLSearchParams([search, hashSearch].filter(Boolean).join('&'));
    const ref = params.get('ref');
    if (ref && /^\d+$/.test(ref)) localStorage.setItem('typrun_invite_ref', ref);
  } catch { /* ignore */ }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter basename={basename}>
        <App />
      </BrowserRouter>
    </React.StrictMode>,
  );
}
