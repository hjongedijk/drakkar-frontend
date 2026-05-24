import { DRAKKAR_VERSION } from "./version";

declare global {
  interface Window {
    __DRAKKAR_CONFIG__?: {
      API_BASE_URL?: string;
      FRONTEND_API_TOKEN?: string;
      DOCS_URL?: string;
    };
  }
}

export const APP_NAME = "Drakkar";
export const APP_VERSION = DRAKKAR_VERSION;
const FRONTEND_API_TOKEN_OVERRIDE_KEY = "drakkar.frontendApiTokenOverride";

export function getApiBaseUrl() {
  return window.__DRAKKAR_CONFIG__?.API_BASE_URL ?? "";
}

export function getFrontendApiToken() {
  const override = window.localStorage.getItem(FRONTEND_API_TOKEN_OVERRIDE_KEY);
  return override || window.__DRAKKAR_CONFIG__?.FRONTEND_API_TOKEN || "";
}

export function getDocsUrl() {
  return window.__DRAKKAR_CONFIG__?.DOCS_URL || "https://hjongedijk.github.io/drakkar-wiki/";
}

export function setFrontendApiToken(token: string) {
  if (token.trim()) {
    window.localStorage.setItem(FRONTEND_API_TOKEN_OVERRIDE_KEY, token);
  } else {
    window.localStorage.removeItem(FRONTEND_API_TOKEN_OVERRIDE_KEY);
  }
  window.__DRAKKAR_CONFIG__ = {
    ...window.__DRAKKAR_CONFIG__,
    FRONTEND_API_TOKEN: token
  };
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
