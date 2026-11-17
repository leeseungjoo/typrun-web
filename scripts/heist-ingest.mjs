#!/usr/bin/env node
// 도둑 런 그림 넣기 — 생성 이미지(단색 초록/자홍 배경 시트)를 게임용 투명 WebP 로 바꾼다.
//   1) 배경색 제거(가장자리에서 배경색을 읽어 초록/자홍 자동 판별, 테두리 번짐 제거)
//   2) 시트를 낱장으로 분할(빈 세로줄·가로줄 기준)
//   3) frames 모드: 모든 프레임을 같은 크기 칸에 무게중심(가로)·발끝(세로) 기준으로 맞춘다 → 애니메이션이 떨리지 않는다
//      sprites 모드: 낱장마다 여백만 잘라 저장(건물·소품·아이콘)
//
// 사용
//   node scripts/heist-ingest.mjs <원본.png> <출력폴더> --names=run_1,run_2,run_3,run_4 --mode=frames
//   node scripts/heist-ingest.mjs <원본.png> <출력폴더> --names=a,b,c --mode=sprites [--rows=3] [--scale=0.9] [--pad=4]
//   node scripts/heist-ingest.mjs <원본.png> <출력폴더> --names=a,b,...(9개) --mode=panels --rows=3
//      panels 모드: 흰 띠로 칸을 나눈 삽화 시트(리그 삽화 3x3 등)를 칸별 16:9 WebP 로 자른다. 배경은 지우지 않는다
// 옵션
//   --names   출력 파일 이름(확장자 없이, 쉼표 구분). 개수 = 시트에서 찾아야 할 낱장 수. 다르면 실패한다
//   --mode    frames(기본) | sprites | panels
//   --rows    시트의 줄 수(기본 1). 3x3 아이콘 시트는 3
//   --scale   출력 배율(기본 1) — 시트마다 캐릭터 크기가 다를 때 맞춘다(아래 "기준색 넓이" 출력 참고)
//   --pad     칸 여백 px(기본 4)
//   --blobs   세로줄이 아니라 "이어진 그림 덩어리" 기준으로 나눈다(한 줄 시트 전용). 자세끼리 소품(부케·모자)이
//             가로로 겹쳐 세로줄로는 못 가르는 시트에 쓴다. 큰 덩어리 N개가 자세, 떨어진 작은 조각은 가까운 자세에 붙인다
//   --autosplit  낱장이 덜 찾아졌을 때(자세끼리 가로로 겹쳐 붙어 보일 때) 가장 넓은 덩어리를 가운데 근처의
//                가장 빈 세로줄에서 잘라 개수를 맞춘다. 어디를 잘랐는지 출력하니 결과 그림을 꼭 확인할 것
// 의존성: PATH 의 ffmpeg·ffprobe(디코드/인코드)만. 환경변수 FFMPEG, FFPROBE 로 경로 지정 가능.
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
const FFPROBE = process.env.FFPROBE ?? 'ffprobe';
const OPAQUE = 128;          // 이 알파 이상을 "그림"으로 본다(분할·여백 계산용)
const MIN_GAP_RATIO = 0.004; // 낱장 사이 빈 줄 최소 폭(시트 폭 대비)
const MIN_PART_RATIO = 0.02; // 이보다 좁은 덩어리는 잡티로 보고 버린다

function fail(msg) {
  process.stderr.write(`heist-ingest: ${msg}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const [src, outDir, ...flags] = argv;
  if (!src || !outDir) fail('사용법: heist-ingest.mjs <원본.png> <출력폴더> --names=a,b,c [--mode=frames|sprites] [--rows=1] [--scale=1] [--pad=4]');
  const opt = Object.fromEntries(flags.map((f) => f.replace(/^--/, '').split('=')));
  const names = (opt.names ?? '').split(',').filter(Boolean);
  if (names.length === 0) fail('--names 가 필요하다');
  const mode = opt.mode ?? 'frames';
  if (mode !== 'frames' && mode !== 'sprites' && mode !== 'panels') fail(`--mode 는 frames, sprites, panels 중 하나 (받은 값: ${mode})`);
  const rows = Number(opt.rows ?? 1);
  const scale = Number(opt.scale ?? 1);
  const pad = Number(opt.pad ?? 4);
  if (!(rows >= 1) || !(scale > 0) || !(pad >= 0)) fail('--rows, --scale, --pad 값이 잘못됐다');
  const autosplit = 'autosplit' in opt;
  const blobs = 'blobs' in opt;
  if (blobs && rows !== 1) fail('--blobs 는 한 줄 시트(--rows=1)에서만 쓴다');
  return { src, outDir, names, mode, rows, scale, pad, autosplit, blobs };
}

function decode(src) {
  const [W, H] = execFileSync(FFPROBE, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', src])
    .toString().trim().split(',').map(Number);
  if (!(W > 0 && H > 0)) fail(`이미지 크기를 읽지 못했다: ${src}`);
  const px = execFileSync(FFMPEG, ['-v', 'error', '-i', src, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], { maxBuffer: W * H * 4 + 1024 });
  if (px.length !== W * H * 4) fail('디코드한 픽셀 수가 맞지 않는다');
  return { W, H, px };
}

function encode(rgba, w, h, outPath, scale) {
  const args = ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-i', '-'];
  if (scale !== 1) args.push('-vf', `scale=${Math.round(w * scale)}:${Math.round(h * scale)}:flags=lanczos`);
  if (outPath.endsWith('.webp')) args.push('-c:v', 'libwebp', '-q:v', '90', '-pix_fmt', 'yuva420p');
  args.push(outPath);
  execFileSync(FFMPEG, args, { input: rgba });
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[sorted.length >> 1];
};

/** 가장자리 2px 띠에서 배경색을 읽어 초록/자홍을 판별한다. */
function detectKey({ W, H, px }) {
  const rs = [];
  const gs = [];
  const bs = [];
  const take = (x, y) => {
    const i = (y * W + x) * 4;
    rs.push(px[i]); gs.push(px[i + 1]); bs.push(px[i + 2]);
  };
  for (let x = 0; x < W; x += 3) { take(x, 0); take(x, 1); take(x, H - 1); take(x, H - 2); }
  for (let y = 0; y < H; y += 3) { take(0, y); take(1, y); take(W - 1, y); take(W - 2, y); }
  const key = [median(rs), median(gs), median(bs)];
  const [r, g, b] = key;
  if (g > r + 60 && g > b + 60) return { type: 'green', key };
  if (r > g + 60 && b > g + 60) return { type: 'magenta', key };
  return fail(`배경이 단색 초록/자홍이 아니다(가장자리 색 rgb ${key.join(',')}). 다시 생성해야 한다`);
}

/**
 * 배경 제거 — "배경색 쏠림"(초록: g - max(r,b), 자홍: min(r,b) - g)으로 알파를 만든다.
 * 밝기가 고르지 않은 배경에도 버티고, 그림 안의 청록·분홍처럼 쏠림이 약한 색은 건드리지 않는다.
 * 반투명 테두리는 배경색을 빼서 원래 색을 되살리고(unmix), 남은 번짐을 눌러 준다(despill).
 */
function removeBackground(img) {
  const { W, H, px } = img;
  const { type, key } = detectKey(img);
  const spillOf = type === 'green' ? (r, g, b) => g - Math.max(r, b) : (r, g, b) => Math.min(r, b) - g;
  const bgSpill = spillOf(key[0], key[1], key[2]);
  const lo = bgSpill * 0.14;
  const hi = bgSpill * 0.8;
  const out = Buffer.from(px);
  for (let i = 0; i < W * H * 4; i += 4) {
    let r = px[i];
    let g = px[i + 1];
    let b = px[i + 2];
    const a = Math.min(Math.max(1 - (spillOf(r, g, b) - lo) / (hi - lo), 0), 1);
    if (a <= 0) { out[i] = 0; out[i + 1] = 0; out[i + 2] = 0; out[i + 3] = 0; continue; } // RGB 도 비운다 — 남겨 두면 손실 압축 때 테두리로 번진다
    if (a < 1) {
      r = (r - (1 - a) * key[0]) / a;
      g = (g - (1 - a) * key[1]) / a;
      b = (b - (1 - a) * key[2]) / a;
    }
    const excess = spillOf(r, g, b) - lo * 0.6;
    if (excess > 0) {
      if (type === 'green') g -= excess;
      else { r -= excess; b -= excess; }
    }
    out[i] = Math.min(Math.max(Math.round(r), 0), 255);
    out[i + 1] = Math.min(Math.max(Math.round(g), 0), 255);
    out[i + 2] = Math.min(Math.max(Math.round(b), 0), 255);
    out[i + 3] = Math.round(a * 255);
  }
  cleanEdgeBand({ W, H, px: out }, type, spillOf);
  return { W, H, px: out, keyType: type };
}

/**
 * 테두리 띠 정리 — 투명 영역에서 EDGE_BAND px 안쪽의 픽셀은 배경색 쏠림을 0 까지 눌러 준다.
 * 어두운 색 테두리에 남는 옅은 초록(자홍) 실선을 없앤다. 안쪽 색은 그대로 둔다.
 */
function cleanEdgeBand({ W, H, px }, type, spillOf) {
  const EDGE_BAND = 2;
  const near = new Uint8Array(W * H); // 1 = 투명 픽셀에서 EDGE_BAND 이내
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (px[(y * W + x) * 4 + 3] >= OPAQUE) continue;
      for (let dy = -EDGE_BAND; dy <= EDGE_BAND; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= H) continue;
        for (let dx = -EDGE_BAND; dx <= EDGE_BAND; dx++) {
          const xx = x + dx;
          if (xx >= 0 && xx < W) near[yy * W + xx] = 1;
        }
      }
    }
  }
  for (let p = 0; p < W * H; p++) {
    const i = p * 4;
    if (!near[p] || px[i + 3] === 0) continue;
    const excess = spillOf(px[i], px[i + 1], px[i + 2]);
    if (excess <= 0) continue;
    if (type === 'green') px[i + 1] -= excess;
    else { px[i] -= excess; px[i + 2] -= excess; }
  }
}

/** counts 에서 "채워진 구간"들을 찾는다. minGap 보다 좁은 빈틈은 같은 구간으로 잇는다. */
function findRuns(counts, minGap, minLen) {
  const runs = [];
  let start = -1;
  let gap = 0;
  for (let i = 0; i <= counts.length; i++) {
    const filled = i < counts.length && counts[i] >= 2;
    if (filled) {
      if (start < 0) start = i;
      gap = 0;
    } else if (start >= 0) {
      gap += 1;
      if (gap >= minGap || i === counts.length) {
        const end = i - gap + 1;
        if (end - start >= minLen) runs.push([start, end]);
        start = -1;
        gap = 0;
      }
    }
  }
  return runs;
}

/** 시트를 낱장 영역(x0,y0,x1,y1)으로 나눈다 — 줄(rows) → 칸 순서, 왼쪽 위부터. */
function splitSheet({ W, H, px }, rows) {
  const opaque = (x, y) => px[(y * W + x) * 4 + 3] >= OPAQUE;
  const count = (x0, y0, x1, y1, alongX) => {
    const counts = new Array(alongX ? x1 - x0 : y1 - y0).fill(0);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (opaque(x, y)) counts[alongX ? x - x0 : y - y0] += 1;
    return counts;
  };
  const minGapX = Math.max(3, Math.round(W * MIN_GAP_RATIO));
  const minGapY = Math.max(3, Math.round(H * MIN_GAP_RATIO));
  const bands = rows === 1 ? [[0, H]] : findRuns(count(0, 0, W, H, false), minGapY, H * MIN_PART_RATIO);
  if (bands.length !== rows) fail(`줄 수가 다르다: ${rows}줄을 기대했는데 ${bands.length}줄을 찾았다`);
  const cells = [];
  for (const [by0, by1] of bands) {
    for (const [x0, x1] of findRuns(count(0, by0, W, by1, true), minGapX, W * MIN_PART_RATIO)) {
      const rowsFilled = findRuns(count(x0, by0, x1, by1, false), H, 1); // 칸 안에서 위아래 여백만 자른다
      if (rowsFilled.length === 0) continue;
      cells.push({ x0, x1, y0: by0 + rowsFilled[0][0], y1: by0 + rowsFilled[rowsFilled.length - 1][1] });
    }
  }
  return cells;
}

/**
 * 낱장이 모자랄 때 개수를 맞춘다 — 가장 넓은 덩어리를 가운데 구간(30~70%)의 가장 빈 세로줄에서 둘로 가른다.
 * 자세끼리 소품(부케·모자 등)이 가로로 겹쳐 한 덩어리로 잡힌 시트용. 자른 뒤 각 조각의 위아래 여백을 다시 잡는다.
 */
function autoSplitCells({ W, px }, cells, wanted) {
  const opaqueInColumn = (x, c) => {
    let n = 0;
    for (let y = c.y0; y < c.y1; y++) if (px[(y * W + x) * 4 + 3] >= OPAQUE) n += 1;
    return n;
  };
  const trimmed = (c) => {
    let x0 = c.x1;
    let x1 = c.x0;
    let y0 = c.y1;
    let y1 = c.y0;
    for (let y = c.y0; y < c.y1; y++) {
      for (let x = c.x0; x < c.x1; x++) {
        if (px[(y * W + x) * 4 + 3] < OPAQUE) continue;
        if (x < x0) x0 = x;
        if (x + 1 > x1) x1 = x + 1;
        if (y < y0) y0 = y;
        if (y + 1 > y1) y1 = y + 1;
      }
    }
    return { x0, x1, y0, y1 };
  };
  const out = [...cells];
  while (out.length < wanted) {
    const idx = out.reduce((best, c, i) => (c.x1 - c.x0 > out[best].x1 - out[best].x0 ? i : best), 0);
    const c = out[idx];
    const from = Math.round(c.x0 + (c.x1 - c.x0) * 0.3);
    const to = Math.round(c.x0 + (c.x1 - c.x0) * 0.7);
    let cut = from;
    let least = Infinity;
    for (let x = from; x < to; x++) {
      const n = opaqueInColumn(x, c);
      if (n < least) { least = n; cut = x; }
    }
    process.stdout.write(`autosplit: x${c.x0}-${c.x1} 덩어리를 x${cut} 에서 가름(그 줄의 그림 픽셀 ${least}개)\n`);
    out.splice(idx, 1, trimmed({ ...c, x1: cut }), trimmed({ ...c, x0: cut }));
  }
  return out;
}

/** 낱장의 가로 무게중심(알파 가중). 팔다리·자루가 흔들려도 몸통 위치가 안정적으로 잡힌다. */
function centroidX({ W, px }, c) {
  let sum = 0;
  let weight = 0;
  for (let y = c.y0; y < c.y1; y++) {
    for (let x = c.x0; x < c.x1; x++) {
      if (c.owner && c.owner[y * W + x] !== c.id) continue; // --blobs: 이 낱장의 픽셀만 센다
      const a = px[(y * W + x) * 4 + 3];
      sum += a * x;
      weight += a;
    }
  }
  return weight > 0 ? sum / weight : (c.x0 + c.x1) / 2;
}

/** 시트에서 가장 많이 쓰인 색(몸통색)의 낱장별 넓이 — 시트끼리 캐릭터 크기를 비교할 때 쓴다. */
function dominantAreas({ W, px }, cells) {
  const bucket = (i) => ((px[i] >> 4) << 8) | ((px[i + 1] >> 4) << 4) | (px[i + 2] >> 4);
  const hist = new Map();
  const each = (c, fn) => {
    for (let y = c.y0; y < c.y1; y++) for (let x = c.x0; x < c.x1; x++) {
      const i = (y * W + x) * 4;
      if (px[i + 3] > 200) fn(i);
    }
  };
  for (const c of cells) each(c, (i) => hist.set(bucket(i), (hist.get(bucket(i)) ?? 0) + 1));
  const top = [...hist.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const tr = ((top >> 8) & 15) * 16 + 8;
  const tg = ((top >> 4) & 15) * 16 + 8;
  const tb = (top & 15) * 16 + 8;
  return cells.map((c) => {
    let n = 0;
    each(c, (i) => { if (Math.abs(px[i] - tr) + Math.abs(px[i + 1] - tg) + Math.abs(px[i + 2] - tb) < 70) n += 1; });
    return n;
  });
}

/** 낱장 영역을 dest 로 옮긴다. c.owner 가 있으면(--blobs) 그 낱장 소유 픽셀만 옮긴다 — 영역에 걸친 옆 자세의 조각은 버린다. */
function blit(img, c, dest, destW, dx, dy) {
  for (let y = c.y0; y < c.y1; y++) {
    const from = (y * img.W + c.x0) * 4;
    const to = ((dy + y - c.y0) * destW + dx) * 4;
    if (!c.owner) {
      img.px.copy(dest, to, from, from + (c.x1 - c.x0) * 4);
      continue;
    }
    for (let x = c.x0; x < c.x1; x++) {
      if (c.owner[y * img.W + x] !== c.id) continue;
      const at = (y * img.W + x) * 4;
      img.px.copy(dest, to + (x - c.x0) * 4, at, at + 4);
    }
  }
}

const BLOB_MIN_AREA = 40;  // 이보다 작은 조각은 잡티로 보고 버린다(px)
const BLOB_SOFT_EDGE = 2;  // 덩어리 가장자리의 반투명 픽셀을 같은 자세로 묶는 폭(px)

/**
 * 이어진 그림 덩어리 기준으로 낱장을 나눈다. 넓이가 큰 순서로 wanted 개가 "자세"이고,
 * 나머지 조각(날아가는 부케·벗겨진 모자 등)은 무게중심이 가장 가까운 자세에 붙인다.
 * 낱장마다 owner(픽셀별 소유 낱장 번호)를 달아 주므로, 영역이 겹쳐도 서로의 조각이 섞이지 않는다.
 */
function blobCells({ W, H, px }, wanted) {
  const label = new Int32Array(W * H);
  const comps = [];
  const stack = new Int32Array(W * H);
  for (let start = 0; start < W * H; start++) {
    if (label[start] !== 0 || px[start * 4 + 3] < OPAQUE) continue;
    const id = comps.length + 1;
    const comp = { id, area: 0, x0: W, x1: 0, y0: H, y1: 0, sx: 0, sy: 0 };
    let top = 0;
    stack[top++] = start;
    label[start] = id;
    while (top > 0) {
      const at = stack[--top];
      const x = at % W;
      const y = (at - x) / W;
      comp.area += 1;
      comp.sx += x;
      comp.sy += y;
      if (x < comp.x0) comp.x0 = x;
      if (x + 1 > comp.x1) comp.x1 = x + 1;
      if (y < comp.y0) comp.y0 = y;
      if (y + 1 > comp.y1) comp.y1 = y + 1;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= H) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= W) continue;
          const next = yy * W + xx;
          if (label[next] !== 0 || px[next * 4 + 3] < OPAQUE) continue;
          label[next] = id;
          stack[top++] = next;
        }
      }
    }
    comps.push(comp);
  }
  const big = comps.filter((c) => c.area >= BLOB_MIN_AREA).sort((a, b) => b.area - a.area);
  if (big.length < wanted) fail(`덩어리가 모자라다: ${wanted}개를 기대했는데 ${big.length}개뿐이다`);
  const mains = big.slice(0, wanted).sort((a, b) => a.sx / a.area - b.sx / b.area); // 왼쪽부터
  const cells = mains.map((m, i) => ({ id: i + 1, x0: m.x0, x1: m.x1, y0: m.y0, y1: m.y1 }));
  const groupOf = new Int32Array(comps.length + 1); // 덩어리 번호 → 낱장 번호(0 = 버림)
  mains.forEach((m, i) => { groupOf[m.id] = i + 1; });
  for (const c of big.slice(wanted)) {
    const cx = c.sx / c.area;
    const cy = c.sy / c.area;
    let best = 0;
    let bestDist = Infinity;
    mains.forEach((m, i) => {
      const dist = Math.hypot(cx - m.sx / m.area, cy - m.sy / m.area);
      if (dist < bestDist) { bestDist = dist; best = i; }
    });
    groupOf[c.id] = best + 1;
    const cell = cells[best];
    cell.x0 = Math.min(cell.x0, c.x0);
    cell.x1 = Math.max(cell.x1, c.x1);
    cell.y0 = Math.min(cell.y0, c.y0);
    cell.y1 = Math.max(cell.y1, c.y1);
    process.stdout.write(`blobs: 떨어진 조각(x${c.x0}-${c.x1} y${c.y0}-${c.y1}, ${c.area}px)을 ${best + 1}번째 낱장에 붙임\n`);
  }
  // 픽셀별 소유 낱장 + 가장자리의 반투명 픽셀을 이웃 덩어리에 묶는다
  let owner = new Int32Array(W * H);
  for (let i = 0; i < W * H; i++) owner[i] = groupOf[label[i]];
  for (let pass = 0; pass < BLOB_SOFT_EDGE; pass++) {
    const next = Int32Array.from(owner);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const at = y * W + x;
        if (owner[at] !== 0 || px[at * 4 + 3] === 0) continue;
        for (let dy = -1; dy <= 1 && next[at] === 0; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= H) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= W) continue;
            const o = owner[yy * W + xx];
            if (o !== 0) { next[at] = o; break; }
          }
        }
      }
    }
    owner = next;
  }
  return cells.map((c) => ({
    id: c.id,
    owner,
    x0: Math.max(c.x0 - BLOB_SOFT_EDGE, 0),
    x1: Math.min(c.x1 + BLOB_SOFT_EDGE, W),
    y0: Math.max(c.y0 - BLOB_SOFT_EDGE, 0),
    y1: Math.min(c.y1 + BLOB_SOFT_EDGE, H),
  }));
}

// ── panels 모드: 흰 띠로 나뉜 삽화 시트 자르기 ─────────────────────────
const PANEL_WHITE_MIN = 232;      // r·g·b 가 모두 이 값 이상이면 "흰 띠" 픽셀로 본다
const PANEL_GUTTER_RATIO = 0.9;   // 한 줄(열)의 이 비율 이상이 흰색이면 그 줄은 띠다
const PANEL_MIN_SIZE_RATIO = 0.08; // 이보다 작은 덩어리는 칸이 아니다(잡티)
const PANEL_INSET_PX = 3;         // 칸 가장자리의 번진 흰색을 잘라 내는 여유
const PANEL_ASPECT = 16 / 9;      // 카드 위쪽 칸의 비율
const PANEL_MAX_W = 720;          // 카드 최대 폭 360px 의 2배(고해상도 화면용)

/** flags[i] 가 false(띠 아님)인 구간들 중 minLen 이상인 것만 돌려준다. */
function contentRuns(isGutter, minLen) {
  const runs = [];
  let start = -1;
  for (let i = 0; i <= isGutter.length; i++) {
    const inContent = i < isGutter.length && !isGutter[i];
    if (inContent && start < 0) start = i;
    if (!inContent && start >= 0) {
      if (i - start >= minLen) runs.push([start, i]);
      start = -1;
    }
  }
  return runs;
}

/** 흰 띠로 나뉜 시트에서 칸(x0,y0,x1,y1)들을 찾는다 — 윗줄 왼쪽부터. */
function splitPanels({ W, H, px }) {
  const isWhite = (x, y) => {
    const i = (y * W + x) * 4;
    return px[i] >= PANEL_WHITE_MIN && px[i + 1] >= PANEL_WHITE_MIN && px[i + 2] >= PANEL_WHITE_MIN;
  };
  const rowGutter = Array.from({ length: H }, (_, y) => {
    let white = 0;
    for (let x = 0; x < W; x++) if (isWhite(x, y)) white += 1;
    return white >= W * PANEL_GUTTER_RATIO;
  });
  const cells = [];
  for (const [y0, y1] of contentRuns(rowGutter, H * PANEL_MIN_SIZE_RATIO)) {
    const colGutter = Array.from({ length: W }, (_, x) => {
      let white = 0;
      for (let y = y0; y < y1; y++) if (isWhite(x, y)) white += 1;
      return white >= (y1 - y0) * PANEL_GUTTER_RATIO;
    });
    for (const [x0, x1] of contentRuns(colGutter, W * PANEL_MIN_SIZE_RATIO)) cells.push({ x0, x1, y0, y1 });
  }
  return cells;
}

/** 칸을 가운데 기준 16:9 로 맞춰 자른 영역을 돌려준다(번진 가장자리는 조금 안쪽으로). */
function fitPanel(c) {
  const x0 = c.x0 + PANEL_INSET_PX;
  const y0 = c.y0 + PANEL_INSET_PX;
  const w = c.x1 - c.x0 - PANEL_INSET_PX * 2;
  const h = c.y1 - c.y0 - PANEL_INSET_PX * 2;
  const cropW = Math.min(w, Math.floor(h * PANEL_ASPECT));
  const cropH = Math.min(h, Math.floor(w / PANEL_ASPECT));
  return { x0: x0 + ((w - cropW) >> 1), y0: y0 + ((h - cropH) >> 1), w: cropW, h: cropH };
}

function ingestPanels(src, outDir, names, rows) {
  const img = decode(src);
  const cells = splitPanels(img);
  const foundRows = new Set(cells.map((c) => c.y0)).size;
  if (foundRows !== rows) fail(`줄 수가 다르다: ${rows}줄을 기대했는데 ${foundRows}줄을 찾았다. 칸 사이 흰 띠가 끊겼거나 --rows 가 틀렸다`);
  if (cells.length !== names.length) {
    fail(`칸 수가 다르다: ${names.length}칸을 기대했는데 ${cells.length}칸을 찾았다 (${cells.map((c) => `x${c.x0}-${c.x1},y${c.y0}-${c.y1}`).join(' | ')})`);
  }
  mkdirSync(outDir, { recursive: true });
  cells.forEach((c, i) => {
    const r = fitPanel(c);
    if (r.w < 16 || r.h < 9) fail(`${names[i]}: 칸이 너무 작다(${r.w}x${r.h})`);
    const outW = Math.min(PANEL_MAX_W, r.w) & ~1; // 짝수 폭
    const outPath = join(outDir, `${names[i]}.webp`);
    // 원본에서 그 칸만 잘라 줄인다(배경 제거 없음, 불투명 WebP)
    execFileSync(FFMPEG, [
      '-v', 'error', '-y', '-i', src,
      '-vf', `crop=${r.w}:${r.h}:${r.x0}:${r.y0},scale=${outW}:-2:flags=lanczos`,
      '-frames:v', '1', '-c:v', 'libwebp', '-q:v', '84', '-pix_fmt', 'yuv420p', outPath,
    ]);
    process.stdout.write(`${names[i]}.webp  폭 ${outW}px  (원본 x${r.x0}-${r.x0 + r.w} y${r.y0}-${r.y0 + r.h}, ${r.w}x${r.h})\n`);
  });
  process.stdout.write(`패널 ${cells.length}칸 · ${rows}줄\n`);
}

function main() {
  const { src, outDir, names, mode, rows, scale, pad, autosplit, blobs } = parseArgs(process.argv.slice(2));
  if (mode === 'panels') {
    ingestPanels(src, outDir, names, rows);
    return;
  }
  const img = removeBackground(decode(src));
  let cells = blobs ? blobCells(img, names.length) : splitSheet(img, rows);
  if (!blobs && autosplit && cells.length < names.length) cells = autoSplitCells(img, cells, names.length);
  if (cells.length !== names.length) {
    fail(`낱장 수가 다르다: ${names.length}개를 기대했는데 ${cells.length}개를 찾았다 (${cells.map((c) => `x${c.x0}-${c.x1}`).join(', ')}). 프레임이 붙었거나 잡티가 있다`);
  }
  mkdirSync(outDir, { recursive: true });

  let layouts;
  if (mode === 'frames') {
    const cxs = cells.map((c) => centroidX(img, c));
    const half = Math.ceil(Math.max(...cells.map((c, i) => Math.max(cxs[i] - c.x0, c.x1 - cxs[i])))) + pad;
    const cellH = Math.max(...cells.map((c) => c.y1 - c.y0)) + pad;
    layouts = cells.map((c, i) => ({ w: half * 2, h: cellH, dx: Math.round(half - (cxs[i] - c.x0)), dy: cellH - (c.y1 - c.y0) })); // 발끝을 칸 아랫변에
  } else {
    layouts = cells.map((c) => ({ w: c.x1 - c.x0 + pad * 2, h: c.y1 - c.y0 + pad, dx: pad, dy: pad }));
  }

  cells.forEach((c, i) => {
    const { w, h, dx, dy } = layouts[i];
    const dest = Buffer.alloc(w * h * 4);
    blit(img, c, dest, w, dx, dy);
    encode(dest, w, h, join(outDir, `${names[i]}.webp`), scale);
    process.stdout.write(`${names[i]}.webp  ${Math.round(w * scale)}x${Math.round(h * scale)}  (원본 x${c.x0}-${c.x1} y${c.y0}-${c.y1})\n`);
  });
  const areas = dominantAreas(img, cells);
  process.stdout.write(`배경: ${img.keyType} · 기준색 넓이(낱장별): ${areas.join(', ')} · 중앙값 ${median(areas)}\n`);
}

main();
