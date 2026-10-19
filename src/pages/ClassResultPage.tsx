import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FINAL_SUBMIT_CODES,
  classroomApi,
  normalizeClassCode,
  type ClassBoardRow,
  type ClassScoreResult,
} from '../api/classroom';
import { loadClassCtx, markSubmitted, studentToken, wasSubmitted, type ClassGameResult } from '../lib/classroomCtx';

// 교실 모드 결과 — GamePage 가 판이 끝나면 여기로 보낸다(router state). 한 판 = resultId 하나 = 제출 1회.
// 일반 GameOverPage(로그인 저장·CTA)를 거치지 않는다 — 학생에게 가입을 권하지 않는다.
// 제출 성공 또는 '다시 해도 같은 실패'일 때만 제출 완료로 표시 — 일시 오류면 다시 올리기 버튼을 준다.
const MINI_BOARD = 10;

type SaveState =
  | { kind: 'saving' }
  | { kind: 'saved'; res: ClassScoreResult }
  | { kind: 'already' }
  | { kind: 'final'; message: string }
  | { kind: 'retryable'; message: string };

export default function ClassResultPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const loc = useLocation();
  const code = normalizeClassCode(useParams().code ?? '');
  const ctx = useMemo(() => loadClassCtx(code), [code]);
  const result = (loc.state as { result?: ClassGameResult } | null)?.result ?? null;

  const [save, setSave] = useState<SaveState>({ kind: 'saving' });
  const [board, setBoard] = useState<ClassBoardRow[]>([]);
  const startedRef = useRef(false); // StrictMode 이중 실행 방지

  const loadBoard = useCallback(() => {
    if (code) classroomApi.board(code, MINI_BOARD).then((b) => setBoard(b.rows)).catch(() => undefined);
  }, [code]);

  const submit = useCallback(async () => {
    if (!code || !ctx || !result) return;
    setSave({ kind: 'saving' });
    try {
      const env = await classroomApi.submit({
        code,
        nickname: ctx.nickname,
        token: studentToken(),
        score: result.score,
        max_combo: result.max_combo,
        correct_count: result.correct_count,
        miss_count: result.miss_count,
        accuracy: result.accuracy,
        wpm: result.wpm,
        play_time_sec: result.play_time_sec,
      });
      if (env.code === '00' && env.data) {
        markSubmitted(result.resultId);
        setSave({ kind: 'saved', res: env.data });
      } else if (FINAL_SUBMIT_CODES.has(env.code)) {
        markSubmitted(result.resultId);
        setSave({ kind: 'final', message: env.message });
      } else {
        setSave({ kind: 'retryable', message: env.message });
      }
    } catch (e) {
      setSave({ kind: 'retryable', message: e instanceof Error ? e.message : String(e) });
    } finally {
      loadBoard();
    }
  }, [code, ctx, result, loadBoard]);

  useEffect(() => {
    if (!code || !ctx || !result || startedRef.current) return;
    startedRef.current = true;
    if (wasSubmitted(result.resultId)) {
      setSave({ kind: 'already' }); // 새로고침 — 이미 올린 판
      loadBoard();
      return;
    }
    void submit();
  }, [code, ctx, result, submit, loadBoard]);

  if (!code || !ctx || !result) return <Navigate to={code ? `/class/${code}` : '/school'} replace />;

  const replay = () => nav(`/game/${ctx.categorySeq}`, { state: { classCode: code } });
  const myRowId = save.kind === 'saved' ? save.res.row_id : null;

  return (
    <div className="min-h-screen px-5 pt-14 pb-16 max-w-md mx-auto">
      <p className="text-sm text-white/60">{ctx.title}</p>
      <h1 className="chalk-text text-2xl font-extrabold mt-1">{t('classroom.resultTitle', { nickname: ctx.nickname })}</h1>

      <div className="chalk-card p-6 mt-5 text-center">
        <p className="chalk-text text-5xl font-extrabold tabular-nums">{result.score.toLocaleString()}</p>
        <div className="grid grid-cols-3 gap-2 mt-5 text-sm">
          <Stat label={t('classroom.statCorrect')} value={String(result.correct_count)} />
          <Stat label={t('classroom.statAccuracy')} value={`${Math.round(result.accuracy * 100)}%`} />
          <Stat label={t('classroom.statSpeed')} value={String(result.wpm)} />
        </div>
        <div className="mt-5 min-h-[3rem]" aria-live="polite">
          {save.kind === 'saving' && <p className="text-white/60">{t('classroom.saving')}</p>}
          {save.kind === 'saved' && (
            <>
              <p className="text-2xl font-bold text-amber-100">
                {t('classroom.myRank', { rank: save.res.rank })}{' '}
                <span className="text-base text-white/60">{t('classroom.myRankOf', { n: save.res.players })}</span>
              </p>
              <p className="text-sm text-white/70 mt-1">
                {save.res.is_first
                  ? t('classroom.firstRecord')
                  : save.res.is_new_best
                    ? t('classroom.newBest')
                    : t('classroom.bestSoFar', { best: save.res.best.toLocaleString() })}
              </p>
            </>
          )}
          {save.kind === 'already' && <p className="text-white/60">{t('classroom.alreadySaved')}</p>}
          {save.kind === 'final' && (
            <p className="text-sm text-red-300 [word-break:keep-all]">{t('classroom.saveFailed', { msg: save.message })}</p>
          )}
          {save.kind === 'retryable' && (
            <>
              <p className="text-sm text-red-300 [word-break:keep-all]">{t('classroom.saveFailed', { msg: save.message })}</p>
              <button type="button" className="btn-ghost mt-3" onClick={() => void submit()}>
                {t('classroom.retry')}
              </button>
            </>
          )}
        </div>
      </div>

      {board.length > 0 && (
        <ol className="chalk-card p-4 mt-4 grid gap-1 text-sm">
          {board.map((r) => (
            <li
              key={r.row_id}
              className={`flex justify-between gap-3 px-2 py-1 rounded ${r.row_id === myRowId ? 'bg-amber-200/15 text-amber-50' : ''}`}
            >
              <span className="tabular-nums w-6 text-white/60">{r.rank}</span>
              <span className="flex-1 truncate">{r.nickname}</span>
              <span className="tabular-nums font-bold">{r.best_score.toLocaleString()}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="grid grid-cols-2 gap-2 mt-5">
        <button className="btn-primary" onClick={replay}>{t('classroom.playAgain')}</button>
        <Link to={`/class/${code}/board`} className="btn-ghost text-center">{t('classroom.viewBoard')}</Link>
      </div>
      <Link to={`/class/${code}`} className="block text-center text-sm text-white/55 hover:text-white mt-4">
        {t('classroom.backToClass')}
      </Link>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/5 py-2">
      <p className="text-white/55 text-xs">{label}</p>
      <p className="font-bold tabular-nums text-lg">{value}</p>
    </div>
  );
}
