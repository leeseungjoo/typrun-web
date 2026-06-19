import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/**
 * 법적 고지 페이지 공용 셸 (개인정보처리방침 / 이용약관).
 * 어두운 메인 테마 위에서 읽기 좋게 카드 + 스크롤 본문으로 구성.
 */
interface LegalShellProps {
  title: string;
  effectiveDate: string;
  children: ReactNode;
}

export default function LegalShell({ title, effectiveDate, children }: LegalShellProps) {
  const { t } = useTranslation();
  const nav = useNavigate();

  return (
    <div className="relative min-h-screen flex flex-col items-center px-5 py-16">
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-5">
          <button className="topbtn" onClick={() => nav(-1)}>← {t('widgets.back')}</button>
          <button className="topbtn" onClick={() => nav('/')}>🏠 {t('widgets.home')}</button>
        </div>

        <div className="card">
          <h1 className="text-2xl font-bold mb-1">{title}</h1>
          <p className="text-xs text-white/40 mb-7">{t('widgets.effectiveDate', { date: effectiveDate })}</p>
          <div className="legal-body text-sm leading-relaxed text-white/80 space-y-6">
            {children}
          </div>
        </div>

        <p className="text-center text-white/25 text-[11px] mt-8">© 2026 Typ Run</p>
      </div>
    </div>
  );
}

/** 본문 섹션 — 제목 + 내용 */
export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-bold text-white mb-2">{heading}</h2>
      <div className="space-y-2 text-white/75">{children}</div>
    </section>
  );
}
