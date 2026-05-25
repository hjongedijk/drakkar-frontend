import { DRAKKAR_VERSION } from "./version";

declare global {
  interface Window {
    __DRAKKAR_CONFIG__?: {
      API_BASE_URL?: string;
      DRAKKAR_API_TOKEN?: string;
      FRONTEND_API_TOKEN?: string;
      DOCS_URL?: string;
    };
  }
}

export const APP_NAME = "Drakkar";
export const APP_VERSION = DRAKKAR_VERSION;
const DRAKKAR_API_TOKEN_OVERRIDE_KEY = "drakkar.apiTokenOverride";

export function getApiBaseUrl() {
  return window.__DRAKKAR_CONFIG__?.API_BASE_URL ?? "";
}

export function getDrakkarApiToken() {
  const override = window.localStorage.getItem(DRAKKAR_API_TOKEN_OVERRIDE_KEY);
  return override || window.__DRAKKAR_CONFIG__?.DRAKKAR_API_TOKEN || window.__DRAKKAR_CONFIG__?.FRONTEND_API_TOKEN || "";
}

export function getDocsUrl() {
  return window.__DRAKKAR_CONFIG__?.DOCS_URL || "/api/docs";
}

export function setDrakkarApiToken(token: string) {
  if (token.trim()) {
    window.localStorage.setItem(DRAKKAR_API_TOKEN_OVERRIDE_KEY, token);
  } else {
    window.localStorage.removeItem(DRAKKAR_API_TOKEN_OVERRIDE_KEY);
  }
  window.__DRAKKAR_CONFIG__ = {
    ...window.__DRAKKAR_CONFIG__,
    DRAKKAR_API_TOKEN: token,
    FRONTEND_API_TOKEN: token
  };
}

export const getFrontendApiToken = getDrakkarApiToken;
export const setFrontendApiToken = setDrakkarApiToken;

export function apiUrl(path: string) {
  const baseUrl = getApiBaseUrl().replace(/\/$/, "");
  return `${baseUrl}${path}`;
}

export function apiAssetUrl(path: string) {
  const token = getDrakkarApiToken();
  if (!token) return apiUrl(path);
  return `${apiUrl(path)}${path.includes("?") ? "&" : "?"}apiToken=${encodeURIComponent(token)}`;
}
