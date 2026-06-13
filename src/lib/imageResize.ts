// 이미지 파일을 Canvas 로 리사이즈해서 data URL 반환
// - 최대 300x300 (가로/세로 중 큰 쪽 기준), 비율 유지
// - 원본이 300x300 이하면 확대 없이 그대로
// - JPEG 출력 (품질 0.85)

const MAX_SIDE = 300;
const QUALITY = 0.85;

export interface ResizeResult {
  dataUrl: string;
  width: number;
  height: number;
  bytes: number; // 대략적인 byte 크기 (data URL 길이 기반)
}

export async function resizeImage(file: File): Promise<ResizeResult> {
  if (!file.type.startsWith('image/')) {
    throw new Error('이미지 파일만 가능해요');
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('파일이 너무 커요 (10MB 이하)');
  }

  const dataUrl = await fileToDataUrl(file);
  const img = await loadImage(dataUrl);

  const w0 = img.naturalWidth;
  const h0 = img.naturalHeight;
  const ratio = Math.min(1, MAX_SIDE / Math.max(w0, h0)); // 확대 X
  const w = Math.round(w0 * ratio);
  const h = Math.round(h0 * ratio);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 컨텍스트 생성 실패');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);

  const outUrl = canvas.toDataURL('image/jpeg', QUALITY);
  // BASE64 길이 * 0.75 ≈ 실제 바이트
  const bytes = Math.round((outUrl.length - outUrl.indexOf(',') - 1) * 0.75);
  return { dataUrl: outUrl, width: w, height: h, bytes };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('파일 읽기 실패'));
    r.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('이미지 디코딩 실패'));
    img.src = src;
  });
}
