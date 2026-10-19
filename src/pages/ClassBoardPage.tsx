import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { classroomApi, normalizeClassCode, type ClassBoard, type ClassInfo } from '../api/classroom';
import { classJoinUrl } from '../lib/classroomCtx';
import QrCode from '../components/classroom/QrCode';

// 반 랭킹 — 전자칠판(큰 화면)용. 5초마다 폴링(탭이 안 보이면 쉼). 수업을 만든 선생님에게만 운영 버튼.
const POLL_MS = 5_000;
const BOARD_LIMIT = 30;
const MEDALS = ['🥇', '🥈', '🥉'];

export default function ClassBoardPage() {
  const { t } = useTranslation();
  const code = normalizeClassCode(useParams().code ?? '');
  const [info, setInfo] = useState<ClassInfo | null>(null);
  const [board, setBoard] = useState<ClassBoard | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const reqSeq = useRef(0); // 늦게 도착한 옛 응답이 새 응답을 덮지 않게

  const refresh = useCallback(() => {
    if (!code) return;
    const my = ++reqSeq.current;
    classroomApi
      .board(code, BOARD_LIMIT)
      .then((b) => { if (my === reqSeq.current) { setBoard(b); setErr(null); } })
      .catch((e: unknown) => { if (my === reqSeq.current) setErr(e instanceof Error ? e.message : String(e)); });
  }, [code]);

  useEffect(() => {
    if (!code) {
      setErr(t('classroom.notFound'));
      return;
    }
    classroomApi.info(code).then(setInfo).catch(() => undefined); // is_owner 판단용 — 실패해도 랭킹은 보인다
    refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [code, refresh, t]);

  if (err && !board) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="chalk-card p-6 max-w-md text-center">
          <p className="text-white/85 [word-break:keep-all]">{err}</p>
          <Link to="/school" className="btn-ghost inline-block mt-4">{t('classroom.schoolTitle')}</Link>
        </div>
      </div>
    );
  }
  if (!board || !code) return <p className="min-h-screen pt-24 text-center text-white/60">{t('classroom.loading')}</p>;

  const joinUrl = classJoinUrl(code);
  const isOpen = board.status === 'open';

  return (
    <div className="min-h-screen px-5 pt-12 pb-10 max-w-6xl mx-auto">
      <header className="flex flex-wrap items-end gap-x-4 gap-y-2 mb-6">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-white/60">{board.category_name} · {t('classroom.boardTitle')}</p>
          <h1 className="chalk-text text-3xl lg:text-5xl font-extrabold leading-tight [word-break:keep-all]">{board.title}</h1>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className={`px-2.5 py-1 rounded-full ${isOpen ? 'bg-emerald-400/20 text-emerald-100' : 'bg-white/10 text-white/60'}`}>
            {isOpen ? t('classroom.openBadge') : t('classroom.closedBadge')}
          </span>
          <span className="text-white/75">{t('classroom.players', { n: board.players })} · {t('classroom.plays', { n: board.plays })}</span>
        </div>
      </header>

      {err && (
        <p className="mb-4 px-4 py-2 rounded-xl bg-amber-300/15 border border-amber-200/30 text-amber-50 text-sm [word-break:keep-all]" role="status">
          {t('classroom.connectionLost', { msg: err })}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="chalk-card p-5 flex flex-col items-center text-center gap-3 self-start">
          <p className="text-sm font-bold text-white/70">{t('classroom.joinAt')}</p>
          <QrCode value={joinUrl} size={220} />
          <p className="text-sm text-white/80 break-all">{joinUrl.replace(/^https?:\/\//, '')}</p>
          <p className="text-xs text-white/55 mt-1">{t('classroom.codeLabel')}</p>
          <p className="chalk-text font-mono text-5xl font-extrabold tracking-[0.25em] -mr-[0.25em]">{code}</p>
          <p className="text-xs text-white/45">{t('classroom.autoRefresh')}</p>
          {info?.is_owner && <OwnerControls code={code} isOpen={isOpen} joinUrl={joinUrl} onChanged={refresh} />}
        </aside>

        <section aria-label={t('classroom.boardTitle')}>
          {board.rows.length === 0 ? (
            <div className="chalk-card p-8 text-center text-white/70 text-lg [word-break:keep-all]">{t('classroom.empty')}</div>
          ) : (
            <ol className="grid gap-2">
              <li className="grid grid-cols-[3.5rem_1fr_auto_3.5rem] gap-3 px-4 text-xs text-white/50">
                <span>{t('classroom.colRank')}</span>
                <span>{t('classroom.colName')}</span>
                <span className="text-right">{t('classroom.colScore')}</span>
                <span className="text-right">{t('classroom.colPlays')}</span>
              </li>
              {board.rows.map((r) => (
                <motion.li
                  key={r.row_id}
                  layout
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  className={`chalk-card grid grid-cols-[3.5rem_1fr_auto_3.5rem] items-center gap-3 px-4 py-3 ${r.rank <= 3 ? 'border-amber-200/40' : ''}`}
                >
                  <span className="text-2xl font-extrabold tabular-nums">{MEDALS[r.rank - 1] ?? r.rank}</span>
                  <span className={`truncate font-bold ${r.rank <= 3 ? 'text-2xl chalk-text' : 'text-xl'}`}>{r.nickname}</span>
                  <span className="text-right text-2xl font-extrabold tabular-nums text-amber-100">{r.best_score.toLocaleString()}</span>
                  <span className="text-right text-white/60 tabular-nums">{r.plays}</span>
                </motion.li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}

function OwnerControls({ code, isOpen, joinUrl, onChanged }: { code: string; isOpen: boolean; joinUrl: string; onChanged: () => void }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const toggle = async () => {
    if (isOpen && !window.confirm(t('classroom.closeConfirm'))) return;
    setBusy(true);
    try {
      await classroomApi.setStatus(code, isOpen ? 'closed' : 'open');
      onChanged();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt(t('classroom.copyLink'), joinUrl);
    }
  };

  const fullscreen = () => {
    const el = document.documentElement;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  };

  return (
    <div className="grid grid-cols-2 gap-2 w-full mt-3 pt-3 border-t border-white/10 text-sm">
      <button type="button" className="btn-ghost !px-2 !py-2" onClick={copy}>{copied ? t('classroom.copied') : t('classroom.copyLink')}</button>
      <button type="button" className="btn-ghost !px-2 !py-2" onClick={fullscreen}>{t('classroom.fullscreen')}</button>
      <a className="btn-ghost !px-2 !py-2 text-center" href={classroomApi.csvUrl(code)}>{t('classroom.downloadCsv')}</a>
      <button type="button" className="btn-ghost !px-2 !py-2" onClick={toggle} disabled={busy}>
        {isOpen ? t('classroom.closeClass') : t('classroom.reopenClass')}
      </button>
      <Link to="/school/manage" className="col-span-2 text-center text-xs text-white/50 hover:text-white mt-1">
        {t('classroom.myClasses')}
      </Link>
    </div>
  );
}
