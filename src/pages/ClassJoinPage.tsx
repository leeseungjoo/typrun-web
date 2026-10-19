import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { NICKNAME_MAX, classroomApi, isNicknameShapeOk, normalizeClassCode, type ClassInfo } from '../api/classroom';
import { loadClassCtx, saveClassCtx, studentToken } from '../lib/classroomCtx';
import { track } from '../lib/track';

// 학생 입장 — /class/:code. 계정 없이 번호·별명만 받고 리그 게임으로 보낸다(router state 에 classCode).
// 시작 전에 서버 check 로 별명(형식·금칙어·같은 반 중복)과 수업 열림을 확인 — 다 하고 나서 거절되지 않게.

export default function ClassJoinPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const params = useParams();
  const code = normalizeClassCode(params.code ?? '');
  const [info, setInfo] = useState<ClassInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [nickname, setNickname] = useState(() => loadClassCtx(code)?.nickname ?? '');
  const [nickErr, setNickErr] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!code) {
      setErr(t('classroom.notFound'));
      return;
    }
    let alive = true;
    classroomApi
      .info(code)
      .then((d) => { if (alive) setInfo(d); })
      .catch((e: unknown) => { if (alive) setErr(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, [code, t]);

  const start = async (e: FormEvent) => {
    e.preventDefault();
    if (!info || checking) return;
    const nick = nickname.trim().replace(/\s+/g, ' ');
    if (!nick) {
      setNickErr(t('classroom.nicknameEmpty'));
      return;
    }
    if (!isNicknameShapeOk(nick)) {
      setNickErr(t('classroom.nicknameShape', { n: NICKNAME_MAX }));
      return;
    }
    setChecking(true);
    try {
      const ok = await classroomApi.check(info.code, nick, studentToken());
      saveClassCtx({ code: info.code, nickname: ok.nickname, categorySeq: info.category_seq, title: info.title });
      track('class_join', info.code);
      nav(`/game/${info.category_seq}`, { state: { classCode: info.code } });
    } catch (e2) {
      setNickErr(e2 instanceof Error ? e2.message : String(e2));
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen px-5 pt-14 pb-16 max-w-md mx-auto flex flex-col">
      <Link to="/school" className="text-sm text-white/55 hover:text-white">← {t('classroom.schoolTitle')}</Link>

      {!info && !err && <p className="text-white/60 mt-10 text-center">{t('classroom.loading')}</p>}
      {err && (
        <div className="chalk-card p-5 mt-10 text-center">
          <p className="text-white/85 [word-break:keep-all]">{err}</p>
        </div>
      )}

      {info && (
        <div className="mt-8">
          <p className="text-sm text-white/60">{info.category_name}</p>
          <h1 className="chalk-text text-3xl font-extrabold mt-1 [word-break:keep-all]">{info.title}</h1>
          <p className="font-mono tracking-[0.3em] text-amber-100/80 mt-2">{info.code}</p>

          {info.status === 'open' ? (
            <form onSubmit={start} className="chalk-card p-5 mt-6 grid gap-3">
              <p className="text-white/80">{t('classroom.joinLead')}</p>
              <label className="grid gap-1.5">
                <span className="text-sm font-bold text-white/80">{t('classroom.nicknameLabel')}</span>
                <input
                  className="input text-xl"
                  value={nickname}
                  onChange={(e) => { setNickname(e.target.value); setNickErr(null); }}
                  placeholder={t('classroom.nicknamePlaceholder')}
                  maxLength={NICKNAME_MAX}
                  autoComplete="off"
                  autoFocus
                />
              </label>
              <p className="text-xs text-white/55 [word-break:keep-all]">{t('classroom.nicknameHint')}</p>
              {nickErr && <p className="text-sm text-red-300" role="alert">{nickErr}</p>}
              <button type="submit" className="btn-primary text-lg" disabled={checking}>
                {checking ? t('classroom.checking') : t('classroom.start')}
              </button>
            </form>
          ) : (
            <div className="chalk-card p-5 mt-6">
              <p className="text-white/85 [word-break:keep-all]">{t('classroom.closedNotice')}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mt-4">
            <Link to={`/class/${info.code}/board`} className="btn-ghost text-sm">
              {info.is_owner ? t('classroom.teacherView') : t('classroom.viewBoard')}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
