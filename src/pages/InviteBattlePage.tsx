import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';
import { BattleSocket, type SocketState } from '../lib/battleSocket';
import { type Mode, type PlayerInfo } from '../lib/battleProtocol';
import BattleGame from '../components/battle/BattleGame';
import { track } from '../lib/track';

// 친구 초대 대결 — 사설 방 흐름.
// create: 로그인 호스트가 방 생성 → 공유 링크 발급 → 친구 입장 대기.
// join:   링크로 들어온 친구(비회원 포함)가 코드로 입장 → 인원 충족 시 match:found 로 전환.
// 둘 다 match:found→카운트다운→match:start→BattleGame 파이프라인을 공유한다.

interface MatchInfo {
  matchId: string;
  mode: Mode;
  categorySeq: number;
  matchSeed: number;
  matchStartTs: number;
  players: PlayerInfo[];
  you: number;
}

const WS_BASE = (import.meta.env.VITE_WS_URL as string | undefined) || 'ws://localhost:3001/ws';

function localeRoot(): string {
  return window.location.pathname.startsWith('/kr') ? '/kr' : '';
}

// 게스트 안정 토큰(탭 세션 유지) — 재연결해도 서버에서 같은 음수 seq 를 받도록.
function guestToken(): string {
  const KEY = 'typrun_guest_token';
  try {
    let v = sessionStorage.getItem(KEY);
    if (!v) {
      v = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(KEY, v);
    }
    return v;
  } catch {
    return 'g' + Date.now().toString(36);
  }
}

export default function InviteBattlePage({ mode: pageMode }: { mode: 'create' | 'join' }) {
  const nav = useNavigate();
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const { categorySeq: catParam, code: codeParam } = useParams();
  const [search] = useSearchParams();

  const categorySeq = Number(catParam);
  const code = (codeParam || '').toUpperCase();
  const inviterRef = Number(search.get('ref')) || undefined;
  const rm = search.get('rm'); // 호스트 '한 번 더' 재초대 nonce — 같은 URL 이라도 effect 재실행/방 재생성 트리거

  const asGuest = pageMode === 'join' && !loading && !user;
  const [guestNick, setGuestNick] = useState('');
  const [guestReady, setGuestReady] = useState(false); // 닉 입력 완료 → 연결 시작

  const sockRef = useRef<BattleSocket | null>(null);
  const matchedRef = useRef(false);
  const startedRef = useRef(false); // match:cancelled 가 게임 시작 후 화면을 빼앗지 않도록(onMessage 클로저 stale 방지)
  const openTrackedRef = useRef(false); // 퍼널 측정: 초대 입장 페이지 1회 기록 가드

  const [conn, setConn] = useState<SocketState>('connecting');
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [waiting, setWaiting] = useState<{ have: number; need: number } | null>(null);
  const [match, setMatch] = useState<MatchInfo | null>(null);
  const [started, setStarted] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [countdownSec, setCountdownSec] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [catName, setCatName] = useState<string | null>(null);

  const roomErrorText = useCallback(
    (reason: string): string => {
      if (reason === 'full') return t('inviteBattle.errFull');
      if (reason === 'login_required') return t('inviteBattle.errLogin');
      if (reason === 'bad_request') return t('inviteBattle.errBad');
      return t('inviteBattle.errNotFound');
    },
    [t],
  );

  // startedRef 동기화 — onMessage 클로저에서 최신 started 를 stale 없이 읽기 위함.
  useEffect(() => {
    startedRef.current = started;
  }, [started]);

  // 퍼널 측정: 초대 링크로 입장 페이지가 열리면 1회 기록(게스트=비회원 바이럴 유입 핵심 지표).
  useEffect(() => {
    if (pageMode === 'join' && !loading && !openTrackedRef.current) {
      openTrackedRef.current = true;
      track('battle_invite_open', user ? 'member' : 'guest');
    }
  }, [pageMode, loading, user]);

  // 생성 모드: 리그명 표시.
  useEffect(() => {
    if (pageMode !== 'create' || !Number.isFinite(categorySeq) || categorySeq <= 0) return;
    let alive = true;
    api
      .categories()
      .then((cats) => {
        if (alive) setCatName(cats.find((c) => c.seq === categorySeq)?.name ?? null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pageMode, categorySeq]);

  // 소켓 연결 + 방 생성/입장.
  useEffect(() => {
    if (loading) return;
    if (pageMode === 'create') {
      if (!user) return; // 렌더에서 로그인 유도
      if (!Number.isFinite(categorySeq) || categorySeq <= 0) return;
    } else {
      if (!code) return;
      if (!user && !guestReady) return; // 게스트는 닉 입력 후 연결
    }

    // (재)연결 시작 시 이전 상태 초기화 — 호스트 '한 번 더'(rm 변경)로 같은 페이지가 재실행될 때 깨끗이 새 방.
    matchedRef.current = false;
    startedRef.current = false;
    setMatch(null);
    setStarted(false);
    setShareCode(null);
    setErr(null);
    setCountdownSec(null);
    const nick = user ? user.nickname : guestNick.trim() || t('inviteBattle.guestDefaultNick');
    const sock = asGuest
      ? new BattleSocket(`${WS_BASE}?guest=${encodeURIComponent(guestToken())}&n=${encodeURIComponent(nick)}`)
      : new BattleSocket();
    sockRef.current = sock;

    const offState = sock.onState((s) => {
      setConn(s);
      if (s === 'open' && !matchedRef.current) {
        // 재연결도 동일 전송 — 서버가 멱등 처리(create=호스트별 같은 코드, join=이미 멤버면 그대로).
        if (pageMode === 'create') {
          sock.send({ t: 'room:create', categorySeq, mode: '2p', nickname: nick });
        } else {
          sock.send({ t: 'room:join', code, nickname: nick });
        }
      }
    });

    const offMsg = sock.onMessage((msg) => {
      switch (msg.t) {
        case 'room:created':
          setShareCode(msg.code);
          setWaiting({ have: msg.have, need: msg.need });
          track('battle_create'); // 호스트가 초대방 생성
          break;
        case 'room:waiting':
          setWaiting({ have: msg.have, need: msg.need });
          break;
        case 'room:error':
          setErr(roomErrorText(msg.reason));
          break;
        case 'match:found':
          if (matchedRef.current) break;
          matchedRef.current = true;
          setMatch({
            matchId: msg.matchId,
            mode: msg.mode,
            categorySeq: msg.categorySeq,
            matchSeed: msg.matchSeed,
            matchStartTs: msg.matchStartTs,
            players: msg.players,
            you: msg.you,
          });
          setErr(null);
          track('battle_join', asGuest ? 'guest' : 'member'); // 대결 성사(게스트 여부 = 바이럴 핵심 지표)
          break;
        case 'match:start':
          setStarted(true);
          break;
        case 'match:cancelled':
          if (startedRef.current) break; // 게임 시작 후엔 무시 — 진행 중 화면을 빼앗지 않음(취소는 카운트다운 전까지만)
          matchedRef.current = false;
          setMatch(null);
          setStarted(false);
          setCountdownSec(null);
          setErr(t('inviteBattle.opponentLeft'));
          break;
        case 'error':
          if (!matchedRef.current) setErr(msg.message || t('battle.genericError'));
          break;
        default:
          break;
      }
    });

    sock.connect();
    return () => {
      offState();
      offMsg();
      if (sock.isOpen() && !matchedRef.current) sock.send({ t: 'room:leave' });
      sock.close();
      sockRef.current = null;
    };
    // guestNick 은 연결 시점에 캡처(매 키입력 재연결 방지) — guestReady 가 게이트. rm=재초대 nonce 로 재실행.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, pageMode, categorySeq, code, guestReady, asGuest, rm]);

  // 재연결로 match:start 를 놓쳐 카운트다운 고착 방지: 0 도달 후 2.5s 지나면 시작 처리.
  useEffect(() => {
    if (!match || started || countdownSec === null || countdownSec > 0) return;
    const id = setTimeout(() => setStarted(true), 2500);
    return () => clearTimeout(id);
  }, [match, started, countdownSec]);

  // 카운트다운 (matchStartTs - 서버시계 추정).
  useEffect(() => {
    if (!match || started) {
      setCountdownSec(null);
      return;
    }
    const tick = () => {
      const sock = sockRef.current;
      const now = sock ? sock.serverNow() : Date.now();
      setCountdownSec(Math.max(0, Math.ceil((match.matchStartTs - now) / 1000)));
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [match, started]);

  const shareUrl = shareCode
    ? `${window.location.origin}${localeRoot()}/battle/invite/${shareCode}${user ? `?ref=${user.seq}` : ''}`
    : '';

  const copyShare = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = shareUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const shareInvite = async () => {
    if (!shareUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: t('inviteBattle.shareTitle'), text: t('inviteBattle.shareText'), url: shareUrl });
      } catch {
        /* 취소 */
      }
    } else {
      copyShare();
    }
  };

  // ── 게임 진행 화면(공유) ──
  if (started && match && sockRef.current) {
    return (
      <BattleGame
        socket={sockRef.current}
        matchId={match.matchId}
        matchSeed={match.matchSeed}
        categorySeq={match.categorySeq}
        players={match.players}
        you={match.you}
        running={started}
        onExit={() => nav('/')}
        isGuest={asGuest}
        inviterRef={inviterRef}
        onRematch={
          user ? () => nav(`/battle/invite/new/${match.categorySeq}?rm=${Date.now()}`, { replace: true }) : undefined
        }
      />
    );
  }

  // ── 매칭됨 → 카운트다운 ──
  if (match) {
    return (
      <Centered>
        <p className="text-sm text-white/50 mb-4">{t('inviteBattle.opponentJoined')}</p>
        <div className="flex items-stretch justify-center gap-3 mb-6">
          {match.players.map((p, i) => (
            <PlayerCard key={p.userSeq} player={p} isYou={p.userSeq === match.you} index={i} t={t} />
          ))}
        </div>
        <p className="text-5xl font-impact text-violet-200 tabular-nums leading-none mb-1" aria-hidden>
          {countdownSec ?? ''}
        </p>
        <p className="text-xs text-white/55">{t('battle.startingSoon')}</p>
      </Centered>
    );
  }

  if (loading) {
    return (
      <Centered>
        <p role="status">{t('battle.loading')}</p>
      </Centered>
    );
  }

  // ── 생성 모드: 로그인 필요 ──
  if (pageMode === 'create' && !user) {
    return (
      <Centered>
        <p className="mb-4 text-white/70" role="status">
          {t('inviteBattle.createLoginRequired')}
        </p>
        <button className="btn-primary" onClick={() => nav('/login')}>
          {t('battle.goLogin')}
        </button>
      </Centered>
    );
  }

  // ── 잘못된 접근 ──
  if (pageMode === 'create' && (!Number.isFinite(categorySeq) || categorySeq <= 0)) {
    return (
      <Centered>
        <p className="mb-4 text-white/70">{t('battle.invalidAccess')}</p>
        <button className="btn-ghost" onClick={() => nav('/league')}>
          {t('battle.toLeagueList')}
        </button>
      </Centered>
    );
  }
  if (pageMode === 'join' && !code) {
    return (
      <Centered>
        <p className="mb-4 text-white/70">{t('inviteBattle.errNotFound')}</p>
        <button className="btn-ghost" onClick={() => nav('/')}>
          {t('battle.home')}
        </button>
      </Centered>
    );
  }

  // ── 게스트 입장: 닉네임 입력 게이트 ──
  if (asGuest && !guestReady) {
    return (
      <div className="min-h-screen px-6 pt-16 pb-8 max-w-md mx-auto flex flex-col justify-center">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card text-center">
          <div className="text-3xl mb-2" aria-hidden>
            ⚔️
          </div>
          <h1 className="text-xl font-bold mb-1">{t('inviteBattle.guestTitle')}</h1>
          <p className="text-sm text-white/55 mb-5">{t('inviteBattle.guestSubtitle')}</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setGuestReady(true);
            }}
            className="flex flex-col gap-3"
          >
            <input
              value={guestNick}
              onChange={(e) => setGuestNick(e.target.value.slice(0, 12))}
              placeholder={t('inviteBattle.guestNickPlaceholder')}
              aria-label={t('inviteBattle.guestNickPlaceholder')}
              autoFocus
              className="px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-center text-lg outline-none focus:border-white/50"
            />
            <button type="submit" className="btn-primary w-full text-base py-3">
              ⚔️ {t('inviteBattle.guestEnter')}
            </button>
          </form>
          <p className="text-[11px] text-white/40 mt-4 leading-relaxed">{t('inviteBattle.guestNoSignup')}</p>
        </motion.div>
      </div>
    );
  }

  // ── 대기 화면(생성=링크 공유 / 입장=연결 중) ──
  return (
    <div className="min-h-screen px-6 pt-16 pb-8 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <span aria-hidden>⚔️</span> {t('inviteBattle.title')}
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-200">
            {t('battle.beta')}
          </span>
        </h1>
        {catName && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-white/75 truncate max-w-[45%]">
            <span aria-hidden>📂</span> {catName}
          </span>
        )}
      </div>

      {err && (
        <div className="card mb-4" role="alert">
          <p className="text-red-300 text-sm mb-3">⚠️ {err}</p>
          <button className="btn-ghost text-sm" onClick={() => nav(pageMode === 'create' ? '/league' : '/')}>
            {pageMode === 'create' ? t('battle.toLeagueList') : t('battle.home')}
          </button>
        </div>
      )}

      {!err && pageMode === 'create' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card text-center py-8">
          {shareCode ? (
            <>
              <p className="text-sm text-white/60 mb-1">{t('inviteBattle.shareHint')}</p>
              <div
                className="text-3xl font-impact tracking-[0.3em] text-violet-200 my-3 select-all"
                aria-label={t('inviteBattle.code')}
              >
                {shareCode}
              </div>
              <div className="flex gap-2 mb-4">
                <input
                  readOnly
                  value={shareUrl}
                  onClick={(e) => (e.currentTarget as HTMLInputElement).select()}
                  className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-xs text-white/80 outline-none"
                />
                <button
                  type="button"
                  onClick={copyShare}
                  className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-xs font-bold hover:bg-white/20 transition shrink-0"
                >
                  {copied ? `✓ ${t('widgets.copied')}` : t('widgets.copy')}
                </button>
                <button
                  type="button"
                  onClick={shareInvite}
                  className="px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:brightness-110 transition shrink-0"
                >
                  {t('widgets.share')}
                </button>
              </div>
              <div className="flex items-center justify-center gap-2 text-white/55 text-sm" role="status" aria-live="polite">
                <span
                  className="inline-block h-4 w-4 rounded-full border-2 border-white/15 border-t-violet-400 animate-spin"
                  aria-hidden
                />
                {t('inviteBattle.waitingFriend')}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
              <span
                className="inline-block h-9 w-9 rounded-full border-4 border-white/15 border-t-violet-400 animate-spin"
                aria-hidden
              />
              <p className="text-sm text-white/60">
                {conn === 'open' ? t('inviteBattle.creating') : t('battle.connectingDots')}
              </p>
            </div>
          )}
        </motion.div>
      )}

      {!err && pageMode === 'join' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="card text-center py-10"
          role="status"
          aria-live="polite"
        >
          <span
            className="inline-block h-9 w-9 rounded-full border-4 border-white/15 border-t-violet-400 animate-spin mb-4"
            aria-hidden
          />
          <p className="font-bold mb-1">{t('inviteBattle.joining')}</p>
          <p className="text-sm text-white/55">
            {waiting ? t('inviteBattle.joinWaitCount', { have: waiting.have, need: waiting.need }) : t('battle.pleaseWait')}
          </p>
        </motion.div>
      )}

      <button
        onClick={() => nav(pageMode === 'create' ? `/league/${categorySeq}` : '/')}
        className="mt-8 w-full py-4 rounded-2xl bg-white/8 hover:bg-white/15 border border-white/15 text-base font-bold text-white/80 hover:text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      >
        ← {t('battle.cancelAndLeave')}
      </button>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">{children}</div>;
}

function PlayerCard({
  player,
  isYou,
  index,
  t,
}: {
  player: PlayerInfo;
  isYou: boolean;
  index: number;
  t: (k: string, o?: Record<string, unknown>) => string;
}) {
  const initial = (player.nickname || '?').trim().charAt(0).toUpperCase();
  return (
    <div
      className={`flex-1 max-w-[7rem] rounded-xl border p-3 ${
        isYou ? 'bg-violet-500/15 border-violet-400/50' : 'bg-white/5 border-white/10'
      }`}
    >
      <div className="mx-auto mb-2 h-12 w-12 rounded-full overflow-hidden bg-white/10 flex items-center justify-center">
        {player.profileImage ? (
          <img src={player.profileImage} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-lg font-bold text-white/70" aria-hidden>
            {initial}
          </span>
        )}
      </div>
      <p className="text-sm font-semibold truncate" title={player.nickname}>
        {player.nickname}
      </p>
      <p className="text-[11px] text-white/60">{isYou ? t('battle.you') : `P${index + 1}`}</p>
    </div>
  );
}
