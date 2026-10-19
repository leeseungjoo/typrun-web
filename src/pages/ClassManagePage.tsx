import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';
import type { Category } from '../api/types';
import { classroomApi, type MyClass } from '../api/classroom';
import { SOCIAL_PROVIDERS, startSocialLogin } from '../lib/socialLogin';
import { classJoinUrl } from '../lib/classroomCtx';
import { SCHOOL_LEAGUE_CODES } from './SchoolPage';

// 선생님 — 수업 만들기 + 내 수업 목록. /school/manage (로그인 필요, 학생은 오지 않는다)
const RETURN_PATH = '/school/manage';

export default function ClassManagePage() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen px-5 pt-14 pb-16 max-w-2xl mx-auto">
      <Link to="/school" className="text-sm text-white/55 hover:text-white">← {t('classroom.schoolTitle')}</Link>
      <h1 className="chalk-text text-3xl font-extrabold mt-5 mb-6">{t('classroom.manageTitle')}</h1>
      {loading && <p className="text-white/60">{t('classroom.loading')}</p>}
      {!loading && !user && <TeacherLogin />}
      {!loading && user && (
        <>
          <CreateClassForm />
          <MyClassList />
        </>
      )}
    </div>
  );
}

function TeacherLogin() {
  const { t } = useTranslation();
  const nav = useNavigate();
  return (
    <div className="chalk-card p-5">
      <p className="text-white/80 mb-4 leading-relaxed [word-break:keep-all]">{t('classroom.loginLead')}</p>
      <div className="grid gap-2">
        {SOCIAL_PROVIDERS.map((p) => (
          <button
            key={p.id}
            className={`w-full py-3 rounded-xl font-bold transition ${p.cls}`}
            onClick={() => startSocialLogin(p.id, RETURN_PATH)}
          >
            <span aria-hidden className="mr-2">{p.icon}</span>
            {p.name}
          </button>
        ))}
        <button className="btn-ghost w-full" onClick={() => nav('/login', { state: { from: RETURN_PATH } })}>
          {t('classroom.emailLogin')}
        </button>
      </div>
    </div>
  );
}

function CreateClassForm() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [cats, setCats] = useState<Category[]>([]);
  const [title, setTitle] = useState('');
  const [categorySeq, setCategorySeq] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .categories()
      .then((list) => {
        const playable = list.filter((c) => c.status === 'active');
        setCats(playable);
        const first = SCHOOL_LEAGUE_CODES.map((code) => playable.find((c) => c.code === code)).find(Boolean);
        setCategorySeq((first ?? playable[0])?.seq ?? 0);
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);

  const [recommended, others] = useMemo(() => {
    const rec = SCHOOL_LEAGUE_CODES.map((code) => cats.find((c) => c.code === code)).filter((c): c is Category => !!c);
    const recSeqs = new Set(rec.map((c) => c.seq));
    return [rec, cats.filter((c) => !recSeqs.has(c.seq))];
  }, [cats]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!categorySeq || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const room = await classroomApi.create(categorySeq, title.trim());
      nav(`/class/${room.code}/board`);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="chalk-card p-5 mb-8 grid gap-4">
      <label className="grid gap-1.5">
        <span className="text-sm font-bold text-white/80">{t('classroom.titleLabel')}</span>
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('classroom.titlePlaceholder')}
          maxLength={40}
        />
      </label>
      <label className="grid gap-1.5">
        <span className="text-sm font-bold text-white/80">{t('classroom.leagueLabel')}</span>
        <select
          className="input"
          value={categorySeq || ''}
          onChange={(e) => setCategorySeq(Number(e.target.value))}
        >
          {recommended.length > 0 && (
            <optgroup label={t('classroom.recommended')}>
              {recommended.map((c) => <option key={c.seq} value={c.seq} className="text-black">{c.name}</option>)}
            </optgroup>
          )}
          {others.length > 0 && (
            <optgroup label={t('classroom.others')}>
              {others.map((c) => <option key={c.seq} value={c.seq} className="text-black">{c.name}</option>)}
            </optgroup>
          )}
        </select>
      </label>
      {err && <p className="text-sm text-red-300" role="alert">{t('classroom.error', { msg: err })}</p>}
      <button type="submit" className="btn-primary" disabled={busy || !categorySeq}>
        {busy ? t('classroom.creating') : t('classroom.createClass')}
      </button>
    </form>
  );
}

function MyClassList() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<MyClass[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    classroomApi
      .mine()
      .then((d) => setRows(d.rows))
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(classJoinUrl(code));
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      window.prompt(t('classroom.copyLink'), classJoinUrl(code)); // 클립보드 막힌 브라우저 — 직접 복사
    }
  };

  return (
    <section>
      <h2 className="chalk-text text-xl font-bold mb-3">{t('classroom.myClasses')}</h2>
      {err && <p className="text-sm text-red-300">{t('classroom.error', { msg: err })}</p>}
      {rows === null && !err && <p className="text-white/60">{t('classroom.loading')}</p>}
      {rows?.length === 0 && <p className="text-white/60">{t('classroom.noClasses')}</p>}
      <ul className="grid gap-2">
        {rows?.map((r) => (
          <li key={r.code} className="chalk-card p-4 flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-bold truncate">{r.title}</p>
              <p className="text-xs text-white/60 mt-0.5">
                {r.category_name} · {t('classroom.players', { n: r.players })} · {t('classroom.plays', { n: r.plays })} ·{' '}
                {t('classroom.createdAt', { date: r.reg_date.slice(0, 10) })}
              </p>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === 'open' ? 'bg-emerald-400/20 text-emerald-100' : 'bg-white/10 text-white/60'}`}>
              {r.status === 'open' ? t('classroom.openBadge') : t('classroom.closedBadge')}
            </span>
            <span className="font-mono tracking-widest text-amber-100">{r.code}</span>
            <button type="button" className="btn-ghost !px-3 !py-1.5 text-sm" onClick={() => copy(r.code)}>
              {copied === r.code ? t('classroom.copied') : t('classroom.copyLink')}
            </button>
            <Link to={`/class/${r.code}/board`} className="btn-primary !px-3 !py-1.5 text-sm">
              {t('classroom.openBoard')}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
