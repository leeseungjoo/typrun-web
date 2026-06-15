import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { BattleSocket, type SocketState } from '../lib/battleSocket';
import { needForMode, type Mode, type PlayerInfo } from '../lib/battleProtocol';
import BattleGame from '../components/battle/BattleGame';

interface MatchInfo {
  matchId: string;
  mode: Mode;
  matchSeed: number;
  matchStartTs: number;
  players: PlayerInfo[];
  you: number;
}

// 배틀 로비 — 매칭 대기 → 상대 발견 → 카운트다운 → 시작.
// P1 Phase 1: 매칭 흐름만(서버 큐/룸 기존 구현). 실제 대결 화면(BattleGamePage)은 다음 Phase.
export default function BattleLobbyPage() {
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const { categorySeq: categoryParam, mode: modeParam } = useParams();
  const categorySeq = Number(categoryParam);
  const mode: Mode | null = modeParam === '2p' || modeParam === '3p' ? modeParam : null;
  const validParams = Number.isFinite(categorySeq) && categorySeq > 0 && mode !== null;

  const sockRef = useRef<BattleSocket | null>(null);
  const matchedRef = useRef(false); // 매칭 후 재연결 시 큐 재진입 방지용(상태 비동기성 때문에 ref 사용)
  const [conn, setConn] = useState<SocketState>('connecting');
  const [waiting, setWaiting] = useState<{ have: number; need: number } | null>(null);
  const [match, setMatch] = useState<MatchInfo | null>(null);
  const [started, setStarted] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [countdownSec, setCountdownSec] = useState<number | null>(null);

  // 소켓 연결 + 큐 진입
  useEffect(() => {
    if (loading || !user || !validParams || mode === null) return;
    matchedRef.current = false;
    const myNickname = user.nickname;
    const sock = new BattleSocket();
    sockRef.current = sock;

    const offState = sock.onState((s) => {
      setConn(s);
      // 매칭 전 (재)연결 때만 큐 진입. 매칭 후 재진입하면 서버 큐 유령 + 룸 불일치가 생긴다.
      if (s === 'open' && !matchedRef.current) {
        sock.send({ t: 'queue:join', categorySeq, mode, nickname: myNickname });
      }
    });
    const offMsg = sock.onMessage((msg) => {
      switch (msg.t) {
        case 'queue:status':
          setWaiting({ have: msg.have, need: msg.need });
          break;
        case 'queue:slow':
          setNotice('매칭 대기가 길어지고 있어요. 잠시만 기다려 주세요.');
          break;
        case 'queue:lonely':
          setNotice(
            msg.suggest === '2p'
              ? '3인 상대가 부족해요. 2인전이 더 빨라요.'
              : '대기 인원이 적어요. 잠시 후 다시 시도해 주세요.',
          );
          break;
        case 'match:found':
          if (matchedRef.current) break; // 이미 매칭됨 — 늦은 재전송이 진행 중 매치를 덮어쓰지 않게.
          matchedRef.current = true;
          setMatch({
            matchId: msg.matchId,
            mode: msg.mode,
            matchSeed: msg.matchSeed,
            matchStartTs: msg.matchStartTs,
            players: msg.players,
            you: msg.you,
          });
          setErr(null);
          setNotice(null);
          break;
        case 'match:start':
          setStarted(true);
          break;
        case 'error':
          if (matchedRef.current) break; // 게임 진입 후엔 로비 에러 배너로 오염시키지 않음.
          setErr(msg.message || '오류가 발생했어요.');
          break;
        default:
          break;
      }
    });

    sock.connect();
    return () => {
      offState();
      offMsg();
      // OPEN 일 때만 leave 전송(아니면 outbox 에 들어갔다가 close 가 비워 유실). 매칭 후엔 이미 큐 밖.
      if (sock.isOpen() && !matchedRef.current) sock.send({ t: 'queue:leave' });
      sock.close();
      sockRef.current = null;
    };
  }, [user, loading, validParams, categorySeq, mode]);

  // 재연결로 match:start 를 놓쳐 카운트다운이 0 에 고착되는 것 방지: 0 도달 후 2.5s 지나면 시작 처리.
  useEffect(() => {
    if (!match || started || countdownSec === null || countdownSec > 0) return;
    const id = setTimeout(() => setStarted(true), 2500);
    return () => clearTimeout(id);
  }, [match, started, countdownSec]);

  // 카운트다운 (matchStartTs - 서버시계 추정)
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

  if (loading) {
    return (
      <Centered>
        <p role="status">불러오는 중...</p>
      </Centered>
    );
  }
  if (!user) {
    return (
      <Centered>
        <p className="mb-4 text-white/70" role="status">
          배틀은 로그인 후 이용할 수 있어요.
        </p>
        <button className="btn-primary" onClick={() => nav('/login')}>
          로그인하기
        </button>
      </Centered>
    );
  }
  if (!validParams || mode === null) {
    return (
      <Centered>
        <p className="mb-4 text-white/70" role="status">
          잘못된 접근이에요.
        </p>
        <button className="btn-ghost" onClick={() => nav('/league')}>
          리그 목록으로
        </button>
      </Centered>
    );
  }

  const need = needForMode(mode);
  const statusText = !match
    ? conn !== 'open'
      ? '실시간 서버에 연결 중'
      : `상대 찾는 중, ${Math.min(waiting?.have ?? 1, need)} / ${need}명`
    : started
    ? '대결 시작'
    : '상대를 찾았어요, 곧 시작합니다';

  return (
    <div className="min-h-screen px-6 pt-16 pb-8 max-w-lg mx-auto">
      {/* 단계 전환(연결중→대기→매칭→시작)을 스크린리더에 한 줄로 알림. 시각 패널은 따로 낭독하지 않음. */}
      <p className="sr-only" role="status" aria-live="polite">
        {statusText}
      </p>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <span aria-hidden>⚔️</span> 배틀
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-200">
            베타
          </span>
        </h1>
      </div>

      {err && (
        <p className="card text-red-300 text-sm mb-4" role="alert">
          ⚠️ {err}
        </p>
      )}

      {started && match && sockRef.current ? (
        <BattleGame
          socket={sockRef.current}
          matchId={match.matchId}
          matchSeed={match.matchSeed}
          categorySeq={categorySeq}
          players={match.players}
          you={match.you}
          running={started}
          onExit={() => nav(`/league/${categorySeq}`)}
        />
      ) : !match ? (
        <QueuePanel conn={conn} have={waiting?.have ?? 1} need={need} />
      ) : (
        <MatchPanel match={match} started={started} countdownSec={countdownSec} />
      )}

      {notice && !match && <p className="text-xs text-amber-200/80 text-center mt-3">{notice}</p>}

      {/* 대기/카운트다운 중 하단 큰 나가기 버튼(기획 2026-06-15) */}
      {!started && (
        <button
          onClick={() => nav(`/league/${categorySeq}`)}
          className="mt-8 w-full py-4 rounded-2xl bg-white/8 hover:bg-white/15 border border-white/15 text-base font-bold text-white/80 hover:text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          ← 대기 취소하고 나가기
        </button>
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">{children}</div>
  );
}

function QueuePanel({ conn, have, need }: { conn: SocketState; have: number; need: number }) {
  const connecting = conn !== 'open';
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card text-center py-10">
      <div className="flex justify-center mb-5" aria-hidden>
        <span className="inline-block h-10 w-10 rounded-full border-4 border-white/15 border-t-violet-400 animate-spin" />
      </div>
      {connecting ? (
        <>
          <p className="font-bold mb-1">실시간 서버에 연결 중…</p>
          <p className="text-sm text-white/50">
            {conn === 'closed' ? '연결이 끊겨 재연결하고 있어요.' : '잠시만 기다려 주세요.'}
          </p>
        </>
      ) : (
        <>
          <p className="font-bold mb-1">상대를 찾는 중…</p>
          <p className="text-sm text-white/55">
            <b className="text-white/85 tabular-nums">{Math.min(have, need)}</b> / {need} 명
          </p>
        </>
      )}
    </motion.div>
  );
}

function MatchPanel({
  match,
  started,
  countdownSec,
}: {
  match: MatchInfo;
  started: boolean;
  countdownSec: number | null;
}) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="card text-center">
      <p className="text-sm text-white/50 mb-4">상대를 찾았어요!</p>

      <div className="flex items-stretch justify-center gap-3 mb-6">
        {match.players.map((p, i) => (
          <PlayerCard key={p.userSeq} player={p} isYou={p.userSeq === match.you} index={i} />
        ))}
      </div>

      {started ? (
        <div>
          <p className="text-2xl font-bold text-emerald-300 mb-1">대결 시작!</p>
          <p className="text-xs text-white/55">실시간 대결 화면은 곧 제공됩니다(개발 중).</p>
        </div>
      ) : (
        <div>
          <p className="text-5xl font-impact text-violet-200 tabular-nums leading-none mb-1" aria-hidden>
            {countdownSec ?? ''}
          </p>
          <p className="text-xs text-white/55">곧 시작합니다</p>
        </div>
      )}
    </motion.div>
  );
}

function PlayerCard({ player, isYou, index }: { player: PlayerInfo; isYou: boolean; index: number }) {
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
      <p className="text-[11px] text-white/60">{isYou ? '나' : `P${index + 1}`}</p>
    </div>
  );
}
