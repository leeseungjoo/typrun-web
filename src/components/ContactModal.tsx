import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { ContactForm } from '../api/types';

interface ContactModalProps {
  onClose: () => void;
  defaultKind?: ContactForm['kind'];
}

type Status = 'idle' | 'sending' | 'done' | 'error';

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
  const { t } = useTranslation();
  const KINDS: Array<{ value: ContactForm['kind']; label: string }> = [
    { value: 'inquiry', label: t('widgets.contactKindInquiry') },
    { value: 'bug', label: t('widgets.contactKindBug') },
    { value: 'collab', label: t('widgets.contactKindCollab') },
  ];
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
      setErrMsg(e instanceof Error ? e.message : t('widgets.contactSendFailed'));
      // 서버가 쿨다운으로 막은 경우에도 클라 쿨다운 동기화
      setCooldown(remainingCooldownSec());
    }
  }

  const cooldownLabel = (() => {
    const m = Math.floor(cooldown / 60);
    const s = cooldown % 60;
    return m > 0
      ? t('widgets.cooldownMinSec', { m, s })
      : t('widgets.cooldownSec', { s });
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
          <h3 className="text-lg font-bold">🤝 {t('widgets.inquiry')}</h3>
          <button onClick={onClose} className="text-white/60 hover:text-white text-xl leading-none">✕</button>
        </div>

        {status === 'done' ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">📨</div>
            <p className="font-bold mb-1">{t('widgets.contactDoneTitle')}</p>
            <p className="text-sm text-white/50 mb-6">{t('widgets.contactDoneDesc')}</p>
            <button className="btn-primary w-full" onClick={onClose}>{t('widgets.close')}</button>
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
                className="input w-full" placeholder={t('widgets.contactNamePlaceholder')}
                value={name} onChange={(e) => setName(e.target.value)} maxLength={50}
              />
              <input
                className="input w-full" placeholder={t('widgets.contactContactPlaceholder')}
                value={contact} onChange={(e) => setContact(e.target.value)} maxLength={120}
              />
              <input
                className="input w-full" placeholder={t('widgets.contactCompanyPlaceholder')}
                value={company} onChange={(e) => setCompany(e.target.value)} maxLength={100}
              />
              <textarea
                className="input w-full resize-none" rows={4} placeholder={t('widgets.contactMessagePlaceholder')}
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
                ? t('widgets.sending')
                : cooldown > 0
                ? t('widgets.contactCooldownNote', { label: cooldownLabel })
                : t('widgets.contactSend')}
            </button>
            <p className="text-[11px] text-white/30 text-center mt-2">
              {cooldown > 0
                ? t('widgets.contactRateLimitHint')
                : t('widgets.contactDeliveryHint')}
            </p>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
