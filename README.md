# Typrain Web (게임 프론트)

Vite + React + TypeScript + Tailwind + Framer Motion.

## 셋업

```powershell
cd "d:\#내부프로젝트\20260526 타자게임\#typrain_개발폴더\web\typrain-web"

# 의존성 설치 (최초 1회)
npm install

# dev server (http://localhost:5173)
npm run dev

# 프로덕션 빌드
npm run build

# 빌드 결과 미리보기
npm run preview
```

## 환경변수

`.env` 에 API 베이스 URL 설정 (이미 생성됨):

```
VITE_API_BASE_URL=https://kioskadmin.co.kr/typrain_api
```

로컬 JSP에서 테스트하려면 이 값만 바꾸면 됨.

## 폴더 구조

```
src/
├── main.tsx              ─ 엔트리
├── App.tsx               ─ 라우팅
├── index.css             ─ Tailwind + 글로벌
├── api/
│   ├── client.ts         ─ API 호출 함수
│   └── types.ts          ─ 응답 타입
├── pages/
│   ├── MainPage.tsx      ─ 메인 (시즌 표시)
│   ├── LeaguePage.tsx    ─ 리그 선택 (카테고리 목록)
│   ├── GamePage.tsx      ─ 게임 (개발중)
│   ├── GameOverPage.tsx  ─ 게임 오버 (개발중)
│   └── RankingsPage.tsx  ─ 랭킹 보기
├── components/           ─ 공용 컴포넌트
└── game/                 ─ 게임 엔진 (다음 턴 작성)
```

## 라우트

- `/`                       ─ 메인
- `/league`                 ─ 리그 선택
- `/game/:categorySeq`      ─ 게임 (개발중)
- `/over`                   ─ 게임 오버 (개발중)
- `/rankings/:categorySeq`  ─ 랭킹

## 현재 진행 상태

- ✅ 프로젝트 셋업 (Vite + React + TS + Tailwind + Framer Motion + React Router)
- ✅ API 클라이언트 (5개 엔드포인트 다 래핑)
- ✅ 메인 페이지 (시즌 정보 표시)
- ✅ 리그 선택 페이지 (연습 리그 / 랭킹 리그 분리)
- ✅ 랭킹 페이지 (Top 50)
- ⏳ 게임 화면 (다음 턴 — 단어 낙하 + 입력 + 점수)
- ⏳ 게임오버 + 점수 저장 (다음 턴)
- ⏳ 디자인 입히기 (피그마 도착 후)

## 다음 작업

- `src/game/` 아래 게임 엔진 구현
  - 단어 스폰 / 낙하 / 입력 매칭 / 콤보 / 점수
  - 아이템 발동 / 하트 / 시간
- GamePage / GameOverPage 본격 구현
