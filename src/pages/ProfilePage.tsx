import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { isSyntheticEmail, containsProfanity, pickProfileImage, authApi } from '../api/auth';
import { api } from '../api/client';
import { resizeImage } from '../lib/imageResize';
import InviteLink from '../components/InviteLink';
import type { ScoreHistoryEntry, BattleRecordStats } from '../api/types';

const BIO_MAX = 200;

export default function ProfilePage() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const { user, loading, updateProfile, logout } = useAuth();

  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [imageData, setImageData] = useState<string | null>(null); // null=변경 안함, ''=삭제, dataUrl=새로 업로드
  const [busy, setBusy] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [history, setHistory] = useState<ScoreHistoryEntry[] | null>(null);
  const [battleStats, setBattleStats] = useState<BattleRecordStats | null>(null); // null=미집계/엔드포인트 미배포 → 베타 표기
  // 비밀번호 변경
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPwConfirm, setNewPwConfirm] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState<string | null>(null);

  // user 로드 시 폼 초기화
  useEffect(() => {
    if (!user) return;
    setNickname(user.nickname || '');
    setEmail(isSyntheticEmail(user.email) ? '' : user.email);
    setBio(user.bio || '');
    setImageData(null); // 새로 로드 시 reset
  }, [user]);

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    setOk(null);
    setImgBusy(true);
    try {
      const result = await resizeImage(file);
      setImageData(result.dataUrl);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setImgBusy(false);
      // input value 리셋해서 같은 파일 다시 선택 가능하게
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const onRemoveImage = () => {
    setImageData('');
  };

  // 비로그인 → 로그인 페이지
  useEffect(() => {
    if (!loading && !user) nav('/login', { replace: true, state: { from: '/profile' } });
  }, [loading, user, nav]);

  // 참여 이력 로드 (최근 30판)
  useEffect(() => {
    if (!user) return;
    authApi.myScores(30)
      .then((rows) => setHistory(rows ?? []))
      .catch(() => setHistory([]));
  }, [user]);

  // 배틀 전적 로드 (엔드포인트 미배포/미집계면 null → 베타 표기 유지)
  useEffect(() => {
    if (!user) return;
    api.myBattleStats()
      .then(setBattleStats)
      .catch(() => setBattleStats(null));
  }, [user]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white/50">
        {t('profile.loading')}
      </div>
    );
  }

  const synthetic = isSyntheticEmail(user.email);

  // 표시용 이미지: 새로 선택한 게 있으면 그거, 삭제한 경우 null, 변경 없으면 기존
  const displayImage =
    imageData === '' ? null :
    imageData !== null ? imageData :
    pickProfileImage(user);

  // 클라이언트 측 즉시 검증
  const nicknameTrim = nickname.trim();
  const bioTrim = bio.trim();
  const nicknameInvalid =
    nicknameTrim.length > 0 && (nicknameTrim.length < 2 || nicknameTrim.length > 20);
  const nicknameBad = containsProfanity(nicknameTrim);
  const bioOver = bioTrim.length > BIO_MAX;
  const bioBad = containsProfanity(bioTrim);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setOk(null);

    if (nicknameInvalid) {
      setErr(t('profile.errNicknameLength'));
      return;
    }
    if (nicknameBad) {
      setErr(t('profile.errNicknameProfanity'));
      return;
    }
    if (bioOver) {
      setErr(t('profile.errBioLength', { n: BIO_MAX }));
      return;
    }
    if (bioBad) {
      setErr(t('profile.errBioProfanity'));
      return;
    }

    // 변경된 필드만 전송
    const payload: { email?: string; nickname?: string; bio?: string; profile_image_data?: string } = {};
    if (nicknameTrim && nicknameTrim !== user.nickname) payload.nickname = nicknameTrim;
    if (email && email !== user.email) payload.email = email.trim().toLowerCase();
    if (bio !== (user.bio || '')) payload.bio = bio; // 빈 문자열 = 지우기
    if (imageData !== null) payload.profile_image_data = imageData; // 빈 문자열 = 삭제

    if (Object.keys(payload).length === 0) {
      setErr(t('profile.errNoChanges'));
      return;
    }

    setBusy(true);
    try {
      await updateProfile(payload);
      setOk(t('profile.savedSuccess'));
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  };

  const onChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwErr(null);
    setPwOk(null);
    if (newPw.length < 6) {
      setPwErr(t('profile.errNewPwLength'));
      return;
    }
    if (newPw !== newPwConfirm) {
      setPwErr(t('profile.errNewPwMismatch'));
      return;
    }
    setPwBusy(true);
    try {
      await authApi.changePassword(curPw, newPw);
      setPwOk(t('profile.pwChangedSuccess'));
      setCurPw('');
      setNewPw('');
      setNewPwConfirm('');
    } catch (e2) {
      setPwErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setPwBusy(false);
    }
  };

  const pwMismatch = newPwConfirm.length > 0 && newPw !== newPwConfirm;

  return (
    <div className="min-h-screen px-6 pt-16 pb-10 max-w-5xl mx-auto">
      {/* 헤더 — 홈은 공용 상단바(우상단)에 있으므로 제목만 (중복·겹침 방지) */}
      <h2 className="text-2xl font-bold text-center mb-8">{t('profile.title')}</h2>

      <div className="grid md:grid-cols-2 gap-6 items-start">
        {/* ===== 왼쪽 컬럼 ===== */}
        <div>

      {/* 프로필 카드 */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="card mb-6"
      >
        <div className="flex items-center gap-4">
          {/* 아바타 + 업로드 */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={imgBusy}
              className="w-20 h-20 rounded-full overflow-hidden border-2 border-white/20 hover:border-white/50 transition relative bg-white/5"
              title={t('profile.changeImage')}
            >
              {displayImage ? (
                <img src={displayImage} alt={t('profile.profileImageAlt')} className="w-full h-full object-cover" />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center text-2xl text-white/30">
                  👤
                </span>
              )}
              {imgBusy && (
                <span className="absolute inset-0 bg-black/60 flex items-center justify-center text-xs">
                  {t('profile.processing')}
                </span>
              )}
            </button>
            {displayImage && !imgBusy && (
              <button
                type="button"
                onClick={onRemoveImage}
                className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center shadow hover:bg-red-400"
                title={t('profile.remove')}
              >
                ✕
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onPickImage}
              className="hidden"
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-white/40 tracking-wider">NICKNAME</div>
              <ProviderBadge provider={user.provider} />
            </div>
            <div className="text-xl font-bold truncate">{user.nickname}</div>
            <div className="text-[10px] text-white/40 mt-1">
              {t('profile.avatarHint')}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/10">
          <Stat label={t('profile.bestScore')} value={(user.best_score ?? 0).toLocaleString()} />
          <Stat label={t('profile.totalPlays')} value={t('profile.playCount', { n: user.total_play_count ?? 0 })} />
        </div>
      </motion.div>

      {/* 초대 링크 카드 (공용 컴포넌트) */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.03 }}
        className="mb-4"
      >
        <InviteLink />
      </motion.div>

      {/* 합성 이메일 경고 */}
      {synthetic && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-yellow-400/15 border border-yellow-400/40 text-yellow-100 text-sm leading-relaxed">
          {t('profile.syntheticEmailWarning')}<br />
          <span className="text-yellow-100/80">
            {t('profile.syntheticEmailHint')}
          </span>
        </div>
      )}

      {/* 통합 폼 */}
      <motion.form
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        onSubmit={onSubmit}
        className="space-y-4"
      >
        {/* 닉네임 */}
        <label className="block">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/50 tracking-wider">{t('profile.nickname')}</span>
            <span className="text-[10px] text-white/40">{nicknameTrim.length}/20</span>
          </div>
          <input
            type="text"
            required
            minLength={2}
            maxLength={20}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder={t('profile.nicknamePlaceholder')}
            className={`w-full mt-1 px-4 py-2.5 rounded-xl bg-white/10 border outline-none focus:border-white/50 ${
              nicknameBad ? 'border-red-400/60' : 'border-white/20'
            }`}
          />
          {nicknameBad && (
            <span className="text-[11px] text-red-400 mt-1 block">
              {t('profile.profanityIncluded')}
            </span>
          )}
        </label>

        {/* 이메일 */}
        <label className="block">
          <span className="text-xs text-white/50 tracking-wider">{t('profile.email')}</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={synthetic ? 'you@example.com' : ''}
            className="w-full mt-1 px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 outline-none focus:border-white/50"
          />
          {!synthetic && (
            <span className="text-[10px] text-white/40 mt-1 block">{t('profile.currentEmail', { email: user.email })}</span>
          )}
        </label>

        {/* 자기소개 */}
        <label className="block">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/50 tracking-wider">{t('profile.bio')}</span>
            <span className={`text-[10px] tabular-nums ${bioOver ? 'text-red-400' : 'text-white/40'}`}>
              {bioTrim.length}/{BIO_MAX}
            </span>
          </div>
          <textarea
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder={t('profile.bioPlaceholder')}
            className={`w-full mt-1 px-4 py-2.5 rounded-xl bg-white/10 border outline-none focus:border-white/50 resize-none ${
              bioBad || bioOver ? 'border-red-400/60' : 'border-white/20'
            }`}
          />
          {bioBad && (
            <span className="text-[11px] text-red-400 mt-1 block">
              {t('profile.profanityIncluded')}
            </span>
          )}
        </label>

        {err && <p className="text-sm text-red-400 text-center">{err}</p>}
        {ok && <p className="text-sm text-emerald-300 text-center">✓ {ok}</p>}

        <button
          type="submit"
          disabled={busy || nicknameBad || bioBad || bioOver}
          className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? t('profile.saving') : t('profile.save')}
        </button>
      </motion.form>

      {/* 로그아웃 */}
      <div className="mt-10 text-center">
        <button
          className="text-xs text-white/40 hover:text-red-400"
          onClick={() => logout()}
        >
          {t('profile.logout')}
        </button>
      </div>

        </div>{/* ===== 왼쪽 컬럼 끝 ===== */}

        {/* ===== 오른쪽 컬럼 ===== */}
        <div className="space-y-6">
          {/* 배틀 전적 카드 (베타 — 집계 준비중) */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.035 }}
            className="card"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs text-white/40 tracking-wider">⚔️ {t('profile.battleRecord')}</div>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-200">
                {battleStats && battleStats.matches > 0 ? t('profile.thisSeason') : t('profile.beta')}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <BattleStat label={t('profile.matches')} value={battleStats?.matches ?? 0} />
              <BattleStat label={t('profile.wins')} value={battleStats?.wins ?? 0} valueCls="text-emerald-300" />
              <BattleStat label={t('profile.losses')} value={battleStats?.losses ?? 0} valueCls="text-red-300" />
              <BattleStat label={t('profile.draws')} value={battleStats?.draws ?? 0} />
            </div>
            <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
              <span className="text-xs text-white/45">{t('profile.winRate')}</span>
              <span className="font-bold tabular-nums text-white/70">
                {battleStats && battleStats.matches > 0 ? `${Math.round(battleStats.win_rate)}%` : '–'}
              </span>
            </div>
            {(!battleStats || battleStats.matches === 0) && (
              <p className="text-[11px] text-white/40 mt-3 leading-relaxed">
                {t('profile.noBattleRecord')}
              </p>
            )}
          </motion.div>

          {/* 참여 이력 카드 (최근 30판) */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 }}
            className="card"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs text-white/40 tracking-wider">📜 {t('profile.recentHistory')}</div>
              {history && history.length > 0 && (
                <div className="text-xs text-white/40">{t('profile.recentCount', { n: history.length })}</div>
              )}
            </div>
            {history === null ? (
              <div className="text-center text-white/40 text-sm py-10">{t('profile.loadingData')}</div>
            ) : history.length === 0 ? (
              <div className="text-center text-white/40 text-sm py-12 leading-relaxed">
                {t('profile.noHistory')}<br />
                <span className="text-[11px]">{t('profile.noHistoryHint')}</span>
              </div>
            ) : (
              <ul className="divide-y divide-white/10 max-h-[36rem] overflow-y-auto -mx-1 px-1">
                {history.map((h, i) => (
                  <li key={i} className="flex items-center py-2.5 gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate">{h.category_name}</div>
                      <div className="text-[10px] text-white/40 tabular-nums">
                        {shortDate(h.reg_date)} · {t('profile.combo', { n: h.max_combo })} · {t('profile.accuracy', { n: Math.round(h.accuracy * 100) })}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold tabular-nums">{h.score.toLocaleString()}</div>
                      <div className="text-[10px] text-white/40 tabular-nums">{h.wpm} WPM</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>

          {/* 비밀번호 변경 카드 */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
            className="card"
          >
            <div className="text-xs text-white/40 tracking-wider mb-3">🔒 {t('profile.changePassword')}</div>
            {user.provider !== 'email' ? (
              <p className="text-sm text-white/40 leading-relaxed py-2">
                {t('profile.socialNoPassword', { provider: user.provider })}<br />
                {t('profile.socialLoginHint')}
              </p>
            ) : (
              <form onSubmit={onChangePassword} className="space-y-3">
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={curPw}
                  onChange={(e) => setCurPw(e.target.value)}
                  placeholder={t('profile.currentPassword')}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 outline-none focus:border-white/50"
                />
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder={t('profile.newPassword')}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 outline-none focus:border-white/50"
                />
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={newPwConfirm}
                  onChange={(e) => setNewPwConfirm(e.target.value)}
                  placeholder={t('profile.confirmNewPassword')}
                  className={`w-full px-4 py-2.5 rounded-xl bg-white/10 border outline-none focus:border-white/50 ${
                    pwMismatch ? 'border-red-400/60' : 'border-white/20'
                  }`}
                />
                {pwMismatch && (
                  <span className="text-[11px] text-red-400 block">{t('profile.errNewPwMismatch')}</span>
                )}
                {pwErr && <p className="text-sm text-red-400">{pwErr}</p>}
                {pwOk && <p className="text-sm text-emerald-300">✓ {pwOk}</p>}
                <button
                  type="submit"
                  disabled={pwBusy}
                  className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pwBusy ? t('profile.changing') : t('profile.changePassword')}
                </button>
              </form>
            )}
          </motion.div>
        </div>{/* ===== 오른쪽 컬럼 끝 ===== */}
      </div>{/* ===== grid 끝 ===== */}
    </div>
  );
}

// 'YYYY-MM-DD HH:MM:SS' → 'MM.DD HH:MM'
function shortDate(s: string): string {
  if (!s) return '';
  const m = s.match(/^\d{4}-(\d{2})-(\d{2})\s(\d{2}):(\d{2})/);
  return m ? `${m[1]}.${m[2]} ${m[3]}:${m[4]}` : s;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-xs text-white/40 tracking-wider">{label}</div>
      <div className="text-lg font-bold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

function BattleStat({ label, value, valueCls = '' }: { label: string; value: string | number; valueCls?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 py-2.5">
      <div className={`font-impact text-2xl leading-none ${valueCls}`}>{value}</div>
      <div className="text-[11px] text-white/45 mt-1">{label}</div>
    </div>
  );
}

function ProviderBadge({ provider }: { provider: string }) {
  const { t } = useTranslation();
  const map: Record<string, { label: string; cls: string }> = {
    email:  { label: t('profile.providerEmail'), cls: 'bg-white/10 text-white/70' },
    google: { label: 'G Google', cls: 'bg-white/90 text-zinc-900' },
    kakao:  { label: '💬 Kakao', cls: 'bg-yellow-400/90 text-zinc-900' },
    naver:  { label: 'N Naver',  cls: 'bg-green-500/90 text-white' },
  };
  const s = map[provider] ?? map.email;
  return (
    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${s.cls}`}>
      {s.label}
    </span>
  );
}
