import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './index.css';

// 초대링크 ?ref=<N> 진입 시 localStorage 에 보관 → 가입 시점에 사용
// HashRouter 라 URL 형태: ?ref=42 (pathname 쿼리) 또는 #/?ref=42 (hash 쿼리)
try {
  const search = window.location.search || '';
  const hash   = window.location.hash || '';
  const hashSearch = hash.includes('?') ? hash.slice(hash.indexOf('?')) : '';
  const params = new URLSearchParams(search + '&' + hashSearch.slice(1));
  const ref = params.get('ref');
  if (ref && /^\d+$/.test(ref)) {
    localStorage.setItem('typrun_invite_ref', ref);
  }
} catch { /* ignore */ }

// HashRouter 사용 — 서버 SPA 라우팅 설정 불필요
// URL 형태: https://kioskadmin.co.kr/typrun/#/login

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);
