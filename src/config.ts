declare global {
  interface Window {
    __DRAKKAR_CONFIG__?: {
      API_BASE_URL?: string;
      FRONTEND_API_TOKEN?: string;
    };
  }
}

export const APP_NAME = "Drakkar";
export const APP_VERSION = "0.1.0";

export function getApiBaseUrl() {
  return window.__DRAKKAR_CONFIG__?.API_BASE_URL ?? import.meta.env.VITE_API_BASE_URL ?? "";
}

export function getFrontendApiToken() {
  return window.__DRAKKAR_CONFIG__?.FRONTEND_API_TOKEN ?? import.meta.env.VITE_FRONTEND_API_TOKEN ?? "dev-frontend-token";
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
