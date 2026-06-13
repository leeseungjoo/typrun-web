import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../api/client';
import type { ContactForm } from '../api/types';

interface ContactModalProps {
  onClose: () => void;
  defaultKind?: ContactForm['kind'];
}

type Status = 'idle' | 'sending' | 'done' | 'error';

const KINDS: Array<{ value: ContactForm['kind']; label: string }> = [
  { value: 'inquiry', label: '문의' },
  { value: 'bug', label: '오류신고' },
  { value: 'collab', label: '콜라보·협업' },
];

// 도배 방지: 한 번 보내면 3분간 재전송 불가 (서버에서도 IP 기준 차단)
const COOLDOWN_MS = 3 * 60 * 1000;
const COOLDOWN_KEY = 'typrain_contact_last';

function remainingCooldownSec(): number {
  const raw = localStorage.getItem(COOLDOWN_KEY);
  if (!raw) return 0;
  const last = Number(raw);
  if (Number.isNaN(last)) return 0;
  const left = COOLDOWN_MS - (Date.now() - last);
  return left > 0 ? Math.ceil(left / 1000) : 0;
}

export default function ContactModal({ onClose, defaultKind = 'inquiry' }: ContactModalProps) {
  const [kind, setKind] = useState<ContactForm['kind']>(defaultKind);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [company, setCompany] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errMsg, setErrMsg] = useState('');
  const [cooldown, setCooldown] = useState(() => remainingCooldownSec());

  // 쿨다운 카운트다운 (1초마다 갱신)
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown(remainingCooldownSec()), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const filledOk =
    name.trim().length > 0 && contact.trim().length > 0 && message.trim().length >= 5;
  const canSend = filledOk && status !== 'sending' && cooldown <= 0;

  async function submit() {
    if (!canSend) return;
    setStatus('sending');
    setErrMsg('');
    try {
      await api.contact({
        kind,
        name: name.trim(),
        contact: contact.trim(),
        company: company.trim(),
        message: message.trim(),
      });
      localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
      setCooldown(remainingCooldownSec());
      setStatus('done');
    } catch (e) {
      setStatus('error');
      setErrMsg(e instanceof Error ? e.message : '전송에 실패했어요');
      // 서버가 쿨다운으로 막은 경우에도 클라 쿨다운 동기화
      setCooldown(remainingCooldownSec());
    }
  }

  const cooldownLabel = (() => {
    const m = Math.floor(cooldown / 60);
    const s = cooldown % 60;
    return m > 0 ? `${m}분 ${s}초` : `${s}초`;
  })();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={(e) => e.stopPropagation()}
        className="card w-full max-w-md"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">🤝 문의</h3>
          <button onClick={onClose} className="text-white/60 hover:text-white text-xl leading-none">✕</button>
        </div>

        {status === 'done' ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">📨</div>
            <p className="font-bold mb-1">문의가 접수되었어요!</p>
            <p className="text-sm text-white/50 mb-6">담당자가 확인 후 회신드릴게요.</p>
            <button className="btn-primary w-full" onClick={onClose}>닫기</button>
          </div>
        ) : (
          <>
            <div className="flex gap-2 mb-3">
              {KINDS.map((k) => (
                <button
                  key={k.value}
                  onClick={() => setKind(k.value)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition ${
                    kind === k.value
                      ? 'bg-violet-500/25 border-violet-400/60 text-violet-100'
                      : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                  }`}
                >
                  {k.label}
                </button>
              ))}
            </div>

            <div className="space-y-2.5">
              <input
                className="input w-full" placeholder="이름 / 담당자명 *"
                value={name} onChange={(e) => setName(e.target.value)} maxLength={50}
              />
              <input
                className="input w-full" placeholder="회신받을 이메일 또는 연락처 *"
                value={contact} onChange={(e) => setContact(e.target.value)} maxLength={120}
              />
              <input
                className="input w-full" placeholder="회사 / 브랜드명 (선택)"
                value={company} onChange={(e) => setCompany(e.target.value)} maxLength={100}
              />
              <textarea
                className="input w-full resize-none" rows={4} placeholder="문의 내용 (5자 이상) *"
                value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000}
              />
            </div>

            {status === 'error' && <p className="text-red-400 text-sm mt-2">{errMsg}</p>}

            <button
              className="btn-primary w-full mt-4 disabled:opacity-40"
              disabled={!canSend}
              onClick={submit}
            >
              {status === 'sending'
                ? '전송 중...'
                : cooldown > 0
                ? `${cooldownLabel} 후 다시 보낼 수 있어요`
                : '문의 보내기'}
            </button>
            <p className="text-[11px] text-white/30 text-center mt-2">
              {cooldown > 0
                ? '도배 방지를 위해 3분에 한 번만 보낼 수 있어요.'
                : '접수 시 담당자 메일로 전달됩니다.'}
            </p>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
