import { request } from './client';

export type AppStatus = {
  maintenance: boolean;
  maintenanceMessage: string;
  externalAds: boolean;
  minClientVersion: string;
};

// 부팅 시 1회 조회 — 점검모드/외부광고/최소버전.
export function getAppStatus(): Promise<AppStatus> {
  return request<AppStatus>('/app-status');
}
