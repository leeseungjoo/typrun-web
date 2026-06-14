import type { ClientMsg, ServerMsg } from './battleProtocol';

// 배틀 실시간 서버(typrun-ws) 네이티브 WS 래퍼.
// - 쿠키 세션(typrun_session)으로 핸드셰이크 인증(브라우저가 자동 첨부; 커스텀 헤더 불가).
// - 끊기면 지수 백오프로 재연결, OPEN 전 보낸 메시지는 버퍼링 후 flush.
// - app-level ping/pong 으로 keepalive + 서버 시계 오프셋 추정(카운트다운 동기화용).

const DEFAULT_WS_URL = 'ws://localhost:3001/ws';
const PING_MS = 20000;
const BACKOFF_BASE_MS = 500;
const BACKOFF_MAX_MS = 8000;

export type SocketState = 'connecting' | 'open' | 'closed';

type MsgListener = (msg: ServerMsg) => void;
type StateListener = (state: SocketState) => void;

function resolveUrl(): string {
  const env = import.meta.env.VITE_WS_URL;
  const url = env && env.length > 0 ? env : DEFAULT_WS_URL;
  // 프로덕션 빌드에 평문 ws:// 가 들어가면 쿠키/메시지가 노출되거나 Mixed Content 로 막힌다.
  if (import.meta.env.PROD && !url.startsWith('wss://')) {
    // eslint-disable-next-line no-console
    console.error('[battleSocket] 프로덕션에는 VITE_WS_URL=wss://… 가 필요합니다. 현재:', url);
  }
  return url;
}

export class BattleSocket {
  private ws: WebSocket | null = null;
  private readonly msgListeners = new Set<MsgListener>();
  private readonly stateListeners = new Set<StateListener>();
  private outbox: ClientMsg[] = [];
  private pingTimer?: ReturnType<typeof setInterval>;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private attempts = 0;
  private closedByUser = false;
  private clockOffset = 0; // 서버시계 - 클라시계 추정치(ms)

  constructor(private readonly url: string = resolveUrl()) {}

  connect(): void {
    this.closedByUser = false;
    this.open();
  }

  private open(): void {
    this.emitState('connecting');
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this.attempts = 0;
      this.emitState('open');
      const pending = this.outbox;
      this.outbox = [];
      for (const m of pending) this.rawSend(m);
      // 즉시 1회 ping → 첫 pong 으로 clockOffset 을 조기 보정(카운트다운이 match:found 전에 동기화되도록).
      this.rawSend({ t: 'ping', c: Date.now() });
      this.startPing();
    };

    ws.onmessage = (ev: MessageEvent) => {
      let msg: ServerMsg;
      try {
        msg = JSON.parse(String(ev.data)) as ServerMsg;
      } catch {
        return;
      }
      if (msg.t === 'pong') {
        this.clockOffset = msg.srvT - Date.now();
        return;
      }
      for (const l of this.msgListeners) l(msg);
    };

    ws.onclose = () => {
      this.stopPing();
      this.emitState('closed');
      if (!this.closedByUser) this.scheduleReconnect();
    };

    ws.onerror = () => {
      try {
        ws.close();
      } catch {
        /* onclose 가 재연결 처리 */
      }
    };
  }

  private scheduleReconnect(): void {
    if (this.closedByUser) return;
    const delay = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** this.attempts);
    this.attempts += 1;
    this.reconnectTimer = setTimeout(() => this.open(), delay);
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => this.rawSend({ t: 'ping', c: Date.now() }), PING_MS);
  }

  private stopPing(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = undefined;
  }

  isOpen(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /** OPEN 이면 즉시 전송, 아니면 버퍼링 후 재연결 시 flush. */
  send(msg: ClientMsg): void {
    if (this.isOpen()) this.rawSend(msg);
    else this.outbox.push(msg);
  }

  private rawSend(msg: ClientMsg): void {
    try {
      this.ws?.send(JSON.stringify(msg));
    } catch {
      /* 다음 재연결에서 복구 */
    }
  }

  onMessage(l: MsgListener): () => void {
    this.msgListeners.add(l);
    return () => this.msgListeners.delete(l);
  }

  onState(l: StateListener): () => void {
    this.stateListeners.add(l);
    return () => this.stateListeners.delete(l);
  }

  private emitState(s: SocketState): void {
    for (const l of this.stateListeners) l(s);
  }

  /** 서버 시계 추정(ms). 카운트다운(matchStartTs) 비교용. */
  serverNow(): number {
    return Date.now() + this.clockOffset;
  }

  close(): void {
    this.closedByUser = true;
    this.stopPing();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    const ws = this.ws;
    this.ws = null;
    try {
      ws?.close();
    } catch {
      /* ignore */
    }
    this.msgListeners.clear();
    this.stateListeners.clear();
    this.outbox = [];
  }
}
