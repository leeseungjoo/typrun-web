import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { Category } from '../api/types';
import { normalizeClassCode } from '../api/classroom';
import { trackOnce } from '../lib/track';

// 선생님 소개 페이지 /kr/school — 교실 모드 안내 + 수업 만들기 진입 + 학생 코드 입장.
// ⚠ scripts/prerender.mjs 의 'kr/school' 본문과 같은 내용을 유지할 것(콘텐츠 패리티 — 다르면 클로킹으로 보인다).
// 수업에 어울리는 리그(코드 기준 — seq 는 환경마다 다르다)
export const SCHOOL_LEAGUE_CODES = [
  'ko_words',
  'eng_elem_high',
  'eng_elem_low',
  'prev_school_violence',
  'prev_cyber_violence',
  'digital_citizen',
  'prev_drug',
  'anti_gambling',
];

const STEPS = [1, 2, 3] as const;
const WHYS = [1, 2, 3, 4] as const;
const FAQS = [1, 2, 3, 4] as const;

export default function SchoolPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [leagues, setLeagues] = useState<Category[]>([]);

  useEffect(() => {
    trackOnce('school_visit');
    api
      .categories()
      .then((cats) => {
        const byCode = new Map(cats.map((c) => [c.code, c]));
        setLeagues(SCHOOL_LEAGUE_CODES.map((code) => byCode.get(code)).filter((c): c is Category => !!c));
      })
      .catch(() => setLeagues([])); // 리그 칩은 부가 정보 — 실패해도 페이지는 그대로
  }, []);

  return (
    <div className="min-h-screen px-5 pt-14 pb-16 max-w-3xl mx-auto">
      <Link to="/" className="text-sm text-white/55 hover:text-white">{t('classroom.backHome')}</Link>

      <header className="mt-6 mb-8">
        <span className="inline-block text-xs font-bold tracking-wider px-3 py-1 rounded-full bg-amber-200/15 text-amber-100 border border-amber-200/30">
          {t('classroom.schoolKicker')}
        </span>
        <h1 className="chalk-text text-3xl sm:text-4xl font-extrabold mt-4 leading-tight [word-break:keep-all]">
          {t('classroom.schoolTitle')}
        </h1>
        <p className="text-white/75 mt-3 leading-relaxed [word-break:keep-all]">{t('classroom.schoolSubtitle')}</p>
        <div className="flex flex-wrap gap-3 mt-6">
          <button className="btn-primary" onClick={() => nav('/school/manage')}>
            {t('classroom.createClass')}
          </button>
          <StudentCodeForm />
        </div>
        <p className="text-sm text-emerald-100/80 mt-4">{t('classroom.usedBy')}</p>
      </header>

      <section className="mb-8">
        <h2 className="chalk-text text-xl font-bold mb-3">{t('classroom.stepsTitle')}</h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {STEPS.map((n) => (
            <li key={n} className="chalk-card p-4">
              <span className="chalk-text text-2xl font-extrabold">{n}</span>
              <h3 className="font-bold mt-1 [word-break:keep-all]">{t(`classroom.step${n}Title`)}</h3>
              <p className="text-sm text-white/70 mt-1 leading-relaxed [word-break:keep-all]">{t(`classroom.step${n}Body`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mb-8">
        <h2 className="chalk-text text-xl font-bold mb-3">{t('classroom.whyTitle')}</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {WHYS.map((n) => (
            <li key={n} className="chalk-card p-4">
              <h3 className="font-bold [word-break:keep-all]">{t(`classroom.why${n}Title`)}</h3>
              <p className="text-sm text-white/70 mt-1 leading-relaxed [word-break:keep-all]">{t(`classroom.why${n}Body`)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="chalk-text text-xl font-bold mb-1">{t('classroom.leaguesTitle')}</h2>
        <p className="text-sm text-white/65 mb-3 [word-break:keep-all]">{t('classroom.leaguesLead')}</p>
        <div className="flex flex-wrap gap-2">
          {leagues.map((c) => (
            <Link
              key={c.seq}
              to={`/league/${c.seq}`}
              className="px-3 py-1.5 rounded-full text-sm bg-white/10 border border-white/15 hover:bg-white/15"
            >
              {c.name}
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="chalk-text text-xl font-bold mb-3">{t('classroom.faqTitle')}</h2>
        <dl className="space-y-3">
          {FAQS.map((n) => (
            <div key={n} className="chalk-card p-4">
              <dt className="font-bold [word-break:keep-all]">{t(`classroom.faq${n}Q`)}</dt>
              <dd className="text-sm text-white/70 mt-1 leading-relaxed [word-break:keep-all]">{t(`classroom.faq${n}A`)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="text-center">
        <button className="btn-primary" onClick={() => nav('/school/manage')}>
          {t('classroom.createClass')}
        </button>
      </div>
    </div>
  );
}

/** 학생용 — 수업 코드 입력 → /class/CODE. 코드는 서버와 같은 규칙으로 정규화. */
export function StudentCodeForm({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [raw, setRaw] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const code = normalizeClassCode(raw);
    if (!code) {
      setErr(t('classroom.joinInvalid'));
      return;
    }
    nav(`/class/${code}`);
  };

  return (
    <form onSubmit={submit} className={`flex flex-col gap-1 ${className}`} aria-label={t('classroom.joinTitle')}>
      <div className="flex gap-2">
        <input
          className="input w-36 uppercase tracking-widest"
          value={raw}
          onChange={(e) => { setRaw(e.target.value); setErr(null); }}
          placeholder={t('classroom.joinPlaceholder')}
          maxLength={8}
          autoCapitalize="characters"
          autoComplete="off"
          aria-label={t('classroom.joinTitle')}
        />
        <button type="submit" className="btn-ghost">{t('classroom.joinButton')}</button>
      </div>
      {err && <p className="text-xs text-red-300" role="alert">{err}</p>}
    </form>
  );
}
