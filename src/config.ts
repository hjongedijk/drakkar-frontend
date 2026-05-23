import { DRAKKAR_VERSION } from "./version";

declare global {
  interface Window {
    __DRAKKAR_CONFIG__?: {
      API_BASE_URL?: string;
      FRONTEND_API_TOKEN?: string;
    };
  }
}

export const APP_NAME = "Drakkar";
export const APP_VERSION = DRAKKAR_VERSION;

export function getApiBaseUrl() {
  return window.__DRAKKAR_CONFIG__?.API_BASE_URL ?? "";
}

export function getFrontendApiToken() {
  return window.__DRAKKAR_CONFIG__?.FRONTEND_API_TOKEN ?? "";
}

export function apiUrl(path: string) {
  const baseUrl = getApiBaseUrl().replace(/\/$/, "");
  return `${baseUrl}${path}`;
}

export function apiAssetUrl(path: string) {
  const token = getFrontendApiToken();
  if (!token) return apiUrl(path);
  return `${apiUrl(path)}${path.includes("?") ? "&" : "?"}apiToken=${encodeURIComponent(token)}`;
}
