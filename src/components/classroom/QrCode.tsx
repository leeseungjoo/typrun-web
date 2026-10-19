import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

interface QrCodeProps {
  value: string;
  size?: number; // px
  className?: string;
}

/** 수업 입장 QR — SVG 셀로 그려 전자칠판에서 확대해도 선명하다. 흰 바탕 + 여백(quiet zone) 2칸. */
export default function QrCode({ value, size = 220, className = '' }: QrCodeProps) {
  const cells = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    const dark: Array<[number, number]> = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) dark.push([r, c]);
    return { n, dark };
  }, [value]);

  const quiet = 2;
  const total = cells.n + quiet * 2;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={`0 0 ${total} ${total}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={value}
    >
      <rect width={total} height={total} fill="#ffffff" rx={1} />
      {cells.dark.map(([r, c]) => (
        <rect key={`${r}-${c}`} x={c + quiet} y={r + quiet} width={1} height={1} fill="#111827" />
      ))}
    </svg>
  );
}
