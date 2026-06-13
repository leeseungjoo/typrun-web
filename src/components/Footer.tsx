import { Link } from 'react-router-dom';
import { LEGAL } from '../lib/legal';

/**
 * 메인 하단 푸터 — 법적 고지 + 운영사 링크.
 * 게임/결과 등 풀스크린 화면과 겹치지 않도록 메인 페이지에서만 사용.
 */
export default function Footer() {
  return (
    <footer className="w-full pb-6 pt-2 px-6 text-center">
      <nav className="flex items-center justify-center gap-3 text-[12px] text-white/45">
        <Link to="/privacy" className="hover:text-white/80 transition">개인정보처리방침</Link>
        <span className="text-white/20">·</span>
        <Link to="/terms" className="hover:text-white/80 transition">이용약관</Link>
        <span className="text-white/20">·</span>
        <a
          href={LEGAL.operatorSite}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-white/80 transition"
        >
          운영사
        </a>
      </nav>
      <p className="mt-1.5 text-[11px] text-white/25">© 2026 Typ Run</p>
    </footer>
  );
}
