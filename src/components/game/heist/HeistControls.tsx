// 도둑 런 하단 — 올리브영 타자게임 구도(돌담 위 탭 + 긴 입력창).
//   [아이템 칸 5개] [방금 맞힌 단어 · 뜻 탭]
//   [아이템 목록 한 줄]
//   [단어 입력 | ____________입력칸____________ | ENTER]
// 입력칸(<input>)은 children 으로 받는다 — 음성·붙여넣기·매크로 차단 핸들러가 GamePage 에 있기 때문.
import type { MouseEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { ITEM_POOL, type InventoryItem, type ItemDef } from '../../../lib/items';
import HeistItemIcon from './HeistItemIcon';
import './heist.css';

interface HeistControlsProps {
  inventory: readonly (InventoryItem | null)[];
  onUseItem: (index: number) => void;
  /** 탭에 띄울 방금 맞힌 단어. 없으면 idleLabel(리그 이름)을 보여 준다. */
  hit?: { id: number; word: string; meaning?: string } | null;
  idleLabel: string;
  /** 방금 얻은 아이템 — 탭 위에 잠깐 뜨는 안내. */
  pickedItem?: { id: number; item: ItemDef } | null;
  /** 비정상 입력(붙여넣기·음성) 경고 문구. 있으면 아이템 안내 대신 보인다. */
  warnText?: string | null;
  onEnter: () => void;
  children: ReactNode;
}

const keepInputFocus = (e: MouseEvent) => e.preventDefault();

function pickedTone(item: ItemDef): string {
  if (!item.positive) return 'bg-red-500/30 border-red-300/70 text-red-50';
  return item.slot ? 'bg-sky-500/30 border-sky-300/70 text-sky-50' : 'bg-emerald-500/30 border-emerald-300/70 text-emerald-50';
}

export default function HeistControls({ inventory, onUseItem, hit, idleLabel, pickedItem, warnText, onEnter, children }: HeistControlsProps) {
  const { t } = useTranslation();

  return (
    <div className="heist-bottom">
      <div className="heist-toastslot" aria-live="polite">
        {warnText ? (
          <p className="absolute inset-x-0 bottom-1 text-center text-sm font-bold text-red-300 pointer-events-none">{warnText}</p>
        ) : (
          <AnimatePresence>
            {pickedItem && (
              <motion.div
                key={pickedItem.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className={`absolute inset-x-0 bottom-1 mx-auto w-fit max-w-full px-4 py-1.5 rounded-full border backdrop-blur flex items-center gap-2 text-sm ${pickedTone(pickedItem.item)}`}
              >
                <HeistItemIcon effect={pickedItem.item.effect} className="w-7 h-7 object-contain shrink-0" />
                <span className="font-bold shrink-0">{pickedItem.item.name}</span>
                <span className="opacity-90 truncate">{pickedItem.item.hint}</span>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      <div className="heist-tabrow">
        <div className="heist-slots">
          {inventory.map((item, i) => (
            <button
              key={i}
              type="button"
              className="heist-slot"
              onMouseDown={keepInputFocus}
              onClick={() => onUseItem(i)}
              disabled={!item}
              title={item?.hint ?? t('game.emptySlot', { n: i + 1 })}
              aria-label={item ? `${item.name} (${i + 1})` : t('game.emptySlot', { n: i + 1 })}
            >
              {item && <HeistItemIcon effect={item.effect} className="heist-slot-icon" />}
              <span className="heist-slot-key" aria-hidden>{i + 1}</span>
            </button>
          ))}
        </div>

        <div className="heist-tab">
          {hit ? (
            <>
              <b>{hit.word}</b>
              {hit.meaning && <span>{hit.meaning}</span>}
            </>
          ) : (
            <span>{idleLabel}</span>
          )}
        </div>

      </div>

      {/* 아이템 목록 — 입력창 바로 위 한 줄(2026-11-17 사장 조정). 뜻 탭 → 이 줄 → 입력창이 한 덩어리로 붙는다 */}
      <p className="heist-legend">
        <b>{t('game.slotLegend')}</b>
        {ITEM_POOL.filter((item) => item.slot).map((item) => (
          <span key={item.effect}><HeistItemIcon effect={item.effect} />{item.name}</span>
        ))}
        <b>{t('game.instantLegend')}</b>
        {ITEM_POOL.filter((item) => !item.slot).map((item) => (
          <span key={item.effect} className={item.positive ? undefined : 'is-bad'}><HeistItemIcon effect={item.effect} />{item.name}</span>
        ))}
      </p>

      <div className="heist-inputbar">
        <span className="heist-inputbar-label">{t('game.inputLabel')}</span>
        {children}
        <button type="button" className="heist-enter" onMouseDown={keepInputFocus} onClick={onEnter}>
          ENTER
        </button>
      </div>
    </div>
  );
}
