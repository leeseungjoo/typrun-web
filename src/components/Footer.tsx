import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LEGAL } from '../lib/legal';

interface FooterProps {
  /** 제휴/이벤트 문의 모달 열기 — 전달 시 운영사 옆에 작은 '제휴문의' 링크 노출 */
  onContact?: () => void;
}

/**
 * 메인 하단 푸터 — 법적 고지 + 운영사 링크 + (선택) 제휴문의.
 * 게임/결과 등 풀스크린 화면과 겹치지 않도록 메인 페이지에서만 사용.
 */
export default function Footer({ onContact }: FooterProps) {
  const { t } = useTranslation();
  return (
    <footer className="w-full pb-6 pt-2 px-6 text-center">
      <nav className="flex items-center justify-center gap-3 text-[12px] text-white/45">
        <Link to="/privacy" className="hover:text-white/80 transition">{t('footer.privacy')}</Link>
        <span className="text-white/20">·</span>
        <Link to="/terms" className="hover:text-white/80 transition">{t('footer.terms')}</Link>
        <span className="text-white/20">·</span>
        <a
          href={LEGAL.operatorSite}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-white/80 transition"
        >
          {t('footer.operator')}
        </a>
        {onContact && (
          <>
            <span className="text-white/20">·</span>
            <button onClick={onContact} className="hover:text-white/80 transition">
              {t('footer.contact')}
            </button>
          </>
        )}
      </nav>
      <p className="mt-1.5 text-[11px] text-white/25">{t('footer.copyright')}</p>
    </footer>
  );
}
