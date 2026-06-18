// 타자 테스트용 번들 단어셋 — 백엔드 없이 즉시 시작 가능(monkeytype 방식).
// 영어: 최빈어 200. 한국어: 받침/모음 분포가 고른 생활 단어(공백 없는 낱말).
import type { TestLocale } from './score';

const EN_COMMON = [
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'it',
  'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this',
  'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or',
  'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so',
  'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when',
  'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take', 'people',
  'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than',
  'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back',
  'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even',
  'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us', 'world',
  'water', 'music', 'place', 'great', 'where', 'every', 'point', 'house', 'happy', 'light',
  'story', 'small', 'large', 'group', 'while', 'change', 'night', 'often', 'order', 'power',
  'paper', 'phone', 'human', 'level', 'sound', 'value', 'money', 'price', 'plant', 'voice',
  'green', 'white', 'black', 'space', 'field', 'heart', 'dream', 'smile', 'shape', 'color',
  'table', 'river', 'mountain', 'forest', 'garden', 'window', 'memory', 'future', 'simple', 'bright',
  'quiet', 'strong', 'gentle', 'travel', 'create', 'wonder', 'moment', 'always', 'friend', 'family',
  'school', 'number', 'letter', 'morning', 'evening', 'season', 'reason', 'nature', 'planet', 'science',
  'answer', 'common', 'better', 'follow', 'listen', 'modern', 'normal', 'object', 'office', 'pretty',
  'silver', 'spring', 'summer', 'winter', 'autumn', 'pencil', 'circle', 'square', 'middle', 'corner',
  'ocean', 'island', 'energy', 'effort', 'growth', 'health', 'wealth', 'wisdom', 'beauty', 'silence',
];

const KO_COMMON = [
  '사람', '시간', '사랑', '친구', '가족', '학교', '행복', '음악', '영화', '여행',
  '자연', '바다', '하늘', '노래', '그림', '사진', '운동', '건강', '마음', '생각',
  '약속', '미래', '희망', '용기', '노력', '성공', '도전', '변화', '시작', '계절',
  '봄날', '여름', '가을', '겨울', '아침', '저녁', '새벽', '햇살', '바람', '구름',
  '별빛', '달빛', '단풍', '벚꽃', '강물', '호수', '숲속', '산책', '골목', '도시',
  '시골', '마을', '거리', '광장', '공원', '정원', '나무', '풀잎', '새싹', '열매',
  '향기', '온기', '미소', '웃음', '눈물', '손길', '표정', '모습', '거울', '창문',
  '잠시', '오늘', '내일', '어제', '주말', '하루', '한낮', '한밤', '계단', '지붕',
  '의자', '책상', '연필', '공책', '가방', '신발', '모자', '우산', '시계', '전화',
  '편지', '소식', '이름', '얼굴', '목소리', '발걸음', '이야기', '추억', '기억', '약수',
  '여유', '평화', '자유', '진심', '정성', '겸손', '지혜', '재능', '열정', '응원',
  '감사', '축하', '선물', '잔치', '명절', '나들이', '소풍', '캠핑', '등산', '낚시',
  '요리', '간식', '과일', '채소', '나물', '국수', '김밥', '떡국', '비빔밥', '냉면',
  '커피', '녹차', '주스', '우유', '물병', '접시', '수저', '냄비', '주방', '식탁',
  '학생', '선생', '의사', '간호', '경찰', '농부', '화가', '가수', '배우', '작가',
  '회사', '시장', '은행', '병원', '서점', '도서관', '박물관', '미술관', '극장', '정류장',
  '기차', '버스', '지하철', '비행기', '자전거', '도로', '다리', '터널', '항구', '공항',
];

const POOL: Record<TestLocale, readonly string[]> = {
  en: EN_COMMON,
  ko: KO_COMMON,
};

/** length 개의 단어를 무작위로 뽑은 스트림(중복 허용, 연속 중복은 회피). */
export function makeWordStream(locale: TestLocale, length: number): string[] {
  const pool = POOL[locale];
  const out: string[] = [];
  let prev = '';
  for (let i = 0; i < length; i++) {
    let w = pool[Math.floor(Math.random() * pool.length)];
    if (w === prev && pool.length > 1) {
      w = pool[(pool.indexOf(w) + 1) % pool.length];
    }
    out.push(w);
    prev = w;
  }
  return out;
}
