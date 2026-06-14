/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_WS_URL?: string; // 배틀 실시간 서버(typrun-ws). 미설정 시 dev 폴백 ws://localhost:3001/ws
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
