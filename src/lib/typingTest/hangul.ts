// 한글 타수(打數) 계산 — 두벌식 기준 자모 입력 횟수.
// 한국어 타자 속도는 분당 "타수"(키 입력 수)로 측정한다. 한 음절은 초성+중성(+종성)으로
// 분해되며, 쌍자음(ㄲ 등)·복합모음(ㅘ 등)·겹받침(ㄳ 등)은 2타로 센다.
// 한글이 아닌 문자(영문/숫자/공백/문장부호)는 1타로 센다.

const HANGUL_BASE = 0xac00; // '가'
const HANGUL_LAST = 0xd7a3; // '힣'

// 초성 19개 — ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ
const LEAD_STROKES = [1, 2, 1, 1, 2, 1, 1, 1, 2, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1];

// 중성 21개 — ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ
const VOWEL_STROKES = [1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 1, 1, 2, 2, 2, 1, 1, 2, 1];

// 종성 28개 (index 0 = 받침 없음) — ''ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ
const TAIL_STROKES = [0, 1, 2, 2, 1, 2, 2, 1, 1, 2, 2, 2, 2, 2, 2, 2, 1, 1, 2, 1, 2, 1, 1, 1, 1, 1, 1, 1];

/** 완성형 음절(가~힣) 한 글자의 타수. */
function syllableStrokes(code: number): number {
  const offset = code - HANGUL_BASE;
  const lead = Math.floor(offset / 588);
  const vowel = Math.floor((offset % 588) / 28);
  const tail = offset % 28;
  return LEAD_STROKES[lead] + VOWEL_STROKES[vowel] + TAIL_STROKES[tail];
}

/** 문자열 전체의 타수 합. */
export function hangulStrokeCount(text: string): number {
  let total = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= HANGUL_BASE && code <= HANGUL_LAST) {
      total += syllableStrokes(code);
    } else {
      // 영문/숫자/공백/문장부호/낱자 자모 등은 1타로 근사
      total += 1;
    }
  }
  return total;
}
