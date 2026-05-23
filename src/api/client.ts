import { apiUrl, getFrontendApiToken } from "../config";

const API_REQUEST_TIMEOUT_MS = 30000;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body != null && !headers.has("content-type")) headers.set("content-type", "application/json");
  headers.set("x-api-token", getFrontendApiToken());
  const response = await fetchWithTimeout(apiUrl(path), {
    ...init,
    credentials: "include",
    headers
  }).catch((error) => {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("Request timed out or was aborted.", 408, null);
    }
    throw error;
  });

  const data = response.headers.get("content-type")?.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    throw new ApiError(data?.message ?? "Request failed", response.status, data);
  }

  return data as T;
}

export async function downloadBlob(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body != null && !headers.has("content-type")) headers.set("content-type", "application/json");
  headers.set("x-api-token", getFrontendApiToken());
  const response = await fetchWithTimeout(apiUrl(path), {
    ...init,
    credentials: "include",
    headers
  }).catch((error) => {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("Request timed out or was aborted.", 408, null);
    }
    throw error;
  });
  if (!response.ok) {
    const data = response.headers.get("content-type")?.includes("application/json") ? await response.json() : null;
    throw new ApiError(data?.message ?? "Request failed", response.status, data);
  }
  return {
    blob: await response.blob(),
    filename: filenameFromDisposition(response.headers.get("content-disposition"))
  };
}

export function downloadFileUrl(path: string) {
  return apiUrl(path);
}

function filenameFromDisposition(disposition: string | null) {
  const match = disposition?.match(/filename="?([^"]+)"?/i);
  return match?.[1] ?? "release.nzb";
}

async function fetchWithTimeout(input: string, init: RequestInit) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS);
  const upstreamSignal = init.signal;

  if (upstreamSignal) {
    if (upstreamSignal.aborted) controller.abort();
    else upstreamSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export type ApiStatus = {
  appName?: string;
  version?: string;
  backend: string;
  postgresql: string;
  valkey: string;
  nzbhydra: string;
  seerr: string;
  activeDownloads: number;
  queueSize: number;
  storageUsage: { usedBytes: number; totalBytes: number; freeBytes: number } | null;
  queues?: Record<string, number>;
  bandwidth?: BandwidthStatus;
  fuse?: FuseStatus;
};

export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
  isAdmin: boolean;
};

export type AuthApiKey = {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt?: string | null;
};

export type HealthCheckItem = {
  id: string;
  name: string;
  path: string;
  createdAt: string;
  lastCheckAt: string | null;
  nextCheckAt: string | null;
  progress: number;
  health: "healthy" | "repaired" | "deleted" | "unknown";
  status: string;
};

export type HealthChecksResponse = {
  overview: {
    totalChecked: number;
    healthy: number;
    repaired: number;
    deleted: number;
  };
  uncheckedCount: number;
  schedule: HealthCheckItem[];
};

export type DiscoverMediaItem = {
  mediaType: "movie" | "tv";
  title: string;
  year?: number;
  tmdbId?: string;
  tvdbId?: string;
  imdbId?: string;
  posterUrl?: string;
  backdropUrl?: string;
  overview?: string;
};

export type MediaDetails = DiscoverMediaItem & {
  runtimeMinutes?: number;
  status?: string;
  tagline?: string;
  genres: string[];
  voteAverage?: number;
  voteCount?: number;
  popularity?: number;
  originalLanguage?: string;
  budget?: number;
  revenue?: number;
  productionCompanies: string[];
  cast: Array<{
    id?: string;
    name: string;
    character?: string;
    profileUrl?: string;
  }>;
  recommendations: DiscoverMediaItem[];
  similar: DiscoverMediaItem[];
};

export type DiscoverHomeResponse = {
  movies: DiscoverMediaItem[];
  tv: DiscoverMediaItem[];
};

export type DiscoverSearchResponse = {
  query: string;
  movies: DiscoverMediaItem[];
  tv: DiscoverMediaItem[];
};

export type DiscoverListResponse = {
  mediaType: "movie" | "tv";
  page: number;
  totalPages: number;
  items: DiscoverMediaItem[];
};

export type ReleaseCalendarEntry = {
  id: string;
  type: "movie" | "show" | "episode";
  title: string;
  releaseDate: string;
  overview?: string;
  mediaType: "movie" | "tv";
  year?: number;
  tmdbId?: string;
  tvdbId?: string;
  imdbId?: string;
  seriesTitle?: string;
  seasonNumber?: number;
  episodeNumber?: number;
};

export type ReleaseCalendarResponse = {
  month: string;
  startsOn: string;
  endsOn: string;
  entries: ReleaseCalendarEntry[];
};

export function getStatus() {
  return apiRequest<ApiStatus>("/api/status");
}

export function login(payload: { username: string; password: string }) {
  return apiRequest<{ user: AuthUser }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function logout() {
  return apiRequest<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
}

export function authMe() {
  return apiRequest<{ user: AuthUser }>("/api/auth/me");
}

export function updateProfile(payload: { username: string; displayName?: string }) {
  return apiRequest<{ user: AuthUser }>("/api/auth/profile", {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function changePassword(payload: { currentPassword: string; newPassword: string }) {
  return apiRequest<{ ok: boolean }>("/api/auth/password", {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function authTokens() {
  return apiRequest<{ tokens: AuthApiKey[] }>("/api/auth/tokens");
}

export function createAuthToken(payload: { name: string }) {
  return apiRequest<{ token: string; apiKey: AuthApiKey }>("/api/auth/tokens", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function deleteAuthToken(id: string) {
  return apiRequest<{ ok: boolean }>(`/api/auth/tokens/${id}`, { method: "DELETE" });
}

export type Download = {
  id: string;
  title: string;
  source: string;
  status: string;
  statusLabel?: string;
  progress: number;
  size: number;
  downloaded: number;
  speedBytesSec: number;
  etaSeconds: number | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DownloadPage = {
  items: Download[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type NzbTestResult = {
  ok: boolean;
  looksLikeNzb?: boolean;
  contentType?: string;
  bytes: number;
  primaryPath: string;
  backupPath: string;
  title: string;
  fileCount: number;
  segmentCount: number;
  totalSize: number;
  errors: string[];
};

export type QualityProfile = {
  id: string;
  name: string;
  allowedQualities: string[];
  cutoffQuality?: string | null;
  preferredWords: string[];
  rejectedWords: string[];
  requiredWords: string[];
  preferredLanguages: string[];
  requiredLanguages: string[];
  minSize?: number | null;
  maxSize?: number | null;
  allowHDR: boolean;
  allowDV: boolean;
  allowRemux: boolean;
  allowBluRay: boolean;
  allowWebDL: boolean;
  allowWebRip: boolean;
  allowX264: boolean;
  allowX265: boolean;
  allowAV1: boolean;
  allowMultiAudio: boolean;
  rejectCam: boolean;
  rejectTelesync: boolean;
  rejectScreener: boolean;
  rejectPassworded: boolean;
  rejectSuspicious: boolean;
  preferProper: boolean;
  preferRepack: boolean;
};

export type MediaRequest = {
  id: string;
  mediaType: string;
  title: string;
  year?: number | null;
  tmdbId?: string | null;
  tvdbId?: string | null;
  imdbId?: string | null;
  status: string;
  requestedBy?: string | null;
  requestedQuality?: string | null;
  selectedProfileId?: string | null;
  externalStatus?: string | null;
  seasons?: unknown;
  episodes?: unknown;
  downloadId?: string | null;
  createdAt: string;
  updatedAt: string;
  download?: {
    id: string;
    status: string;
  } | null;
};

export type RequestSyncResult = {
  imported: number;
  failedProviders: number;
  providerResults: {
    providerId: string;
    providerName: string;
    imported: number;
    ok: boolean;
    error?: string;
  }[];
};

export type RequestMonitorSeason = {
  seasonNumber: number;
  name?: string;
  episodeCount: number;
  monitored: boolean;
  availableCount: number;
  missingCount: number;
  downloadingCount: number;
  episodes: Array<{
    episodeNumber: number;
    title?: string;
    monitored: boolean;
    available: boolean;
    downloading: boolean;
    status: "available" | "downloading" | "missing_monitored" | "missing_unmonitored";
  }>;
};

export type RequestMonitor = {
  request: MediaRequest;
  structure: {
    tmdbId?: string;
    tvdbId?: string;
    title?: string;
    posterUrl?: string;
    backdropUrl?: string;
    overview?: string;
    status?: string;
    numberOfSeasons: number;
    numberOfEpisodes: number;
    seasons: Array<{
      seasonNumber: number;
      name?: string;
      episodeCount: number;
      airDate?: string;
    }>;
  } | null;
  seasons: RequestMonitorSeason[];
  available?: boolean;
};

export type Release = {
  title: string;
  guid: string;
  indexer: string;
  category?: string;
  size?: number;
  seeders?: number;
  publishDate?: string;
  resolution?: string;
  source?: string;
  codec?: string;
  audio?: string;
  downloadUrl?: string;
  hdr: boolean;
  dv: boolean;
  isRepack: boolean;
  isProper: boolean;
  isRemux: boolean;
  rawAttributes: Record<string, unknown>;
};

export type ReleaseDecision = {
  accepted: boolean;
  score: number;
  reasons: string[];
};

export type RequestReleaseCandidate = {
  release: Release;
  decision: ReleaseDecision;
};

export type VfsNode = {
  name: string;
  path: string;
  type: string;
  size: number;
  modifiedAt: string;
  status?: string;
};

export type VfsTreeNode = {
  name: string;
  path: string;
  type: "folder" | "virtual-release";
  children: VfsTreeNode[];
};

export type ImportItem = {
  id: string;
  title: string;
  mediaType: string;
  completedPath: string;
  status: string;
  createdAt: string;
  symlinks?: SymlinkItem[];
};

export type SymlinkItem = {
  id: string;
  sourcePath: string;
  linkPath: string;
  status: string;
  exists?: boolean;
};

export type RepairJob = {
  id: string;
  downloadId: string;
  type: string;
  status: string;
  message?: string | null;
  createdAt: string;
};

export type LogEvent = {
  id: string;
  time: string;
  level: "info" | "warn" | "error";
  service: string;
  message: string;
};

export type StreamSession = {
  id: string;
  path: string;
  fileId?: string;
  range: string;
  status: string;
  bytesSent: number;
  size: number;
  start: number;
  end: number;
  currentOffset: number;
  createdAt: string;
  updatedAt: string;
  source?: string;
  userAgent?: string;
};

export type StreamMetrics = {
  activeStreamCount: number;
  bytesServed: number;
  cacheHits: number;
  memoryCacheHits: number;
  cacheMisses: number;
  dedupedSegmentFetches: number;
  readAheadBytes: number;
  readAheadRequests: number;
  readAheadFailures: number;
  providerHits: number;
  sessionsStarted: number;
  sessionsStopped: number;
  sessions: StreamSession[];
};

export type FuseStatus = {
  enabled: boolean;
  mounted: boolean;
  path: string;
  error?: string | null;
};

export type BandwidthStatus = {
  activeStreamCount: number;
  queueThrottleActive: boolean;
  policy: {
    streamingPriority: number;
    maxDownloadConnections: number;
    maxStreamingConnections: number;
    maxTotalUsenetConnections: number;
    streamReadAheadBytes: number;
    streamChunkSizeBytes: number;
    streamCacheEnabled: boolean;
  };
  allocation: {
    streaming: number;
    perStream: number;
    downloads: number;
    maintenance: number;
  };
};

export type ScheduledTask = {
  id: string;
  name: string;
  description: string;
  intervalMs?: number | null;
  enabled: boolean;
  manualRunnable?: boolean;
  status: "idle" | "running" | "success" | "failed" | "disabled";
  lastStartedAt: string | null;
  lastCompletedAt: string | null;
  lastDurationMs: number | null;
  nextRunAt: string | null;
  lastError: string | null;
};

export type Settings = {
  nzbhydraUrl?: string;
  nzbhydraApiKey?: string;
  nzbhydraCategories: string[];
  nzbhydraTimeoutMs: number;
  nzbhydraCacheTtlSeconds: number;
  nzbhydraFeedCacheTtlSeconds: number;
  nzbhydraFeedMaxResults: number;
  backupNzbFiles: boolean;
  tmdbApiKey?: string;
  tvdbApiKey?: string;
  metadataLanguage: string;
  metadataCacheTtlHours: number;
  defaultMovieProfile: string;
  defaultTvProfile: string;
  monitorQueueSeedTarget: number;
  plexServerUrl?: string;
  plexToken?: string;
  plexLibraryPath: string;
  plexSectionId?: string;
  plexClientIdentifier: string;
};

export type PlexLibrary = {
  key: string;
  title: string;
  type?: string;
  locations: string[];
};

export type SetupStatus = {
  completed: boolean;
  adminRequired: boolean;
  checks: {
    admin: boolean;
    nzbhydra: boolean;
    metadata: boolean;
    requestProvider: boolean;
    usenet: boolean;
    plex: boolean;
  };
};

export type CompleteSetupInput = {
  admin?: {
    username: string;
    displayName?: string;
    password: string;
  };
};

export type RequestProvider = {
  id: string;
  type: "seerr";
  name: string;
  baseUrl: string;
  enabled: boolean;
  syncIntervalMinutes: number;
  defaultMovieProfile?: string | null;
  defaultTvProfile?: string | null;
  lastSyncAt?: string | null;
  lastError?: string | null;
};

export type RequestProviderInput = {
  type: "seerr";
  name: string;
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
  syncIntervalMinutes: number;
  defaultMovieProfile?: string;
  defaultTvProfile?: string;
};

export type UsenetServer = {
  id: string;
  name: string;
  host: string;
  port: number;
  ssl: boolean;
  username?: string | null;
  password?: string | null;
  connections: number;
  priority: number;
  enabled: boolean;
  isBackup: boolean;
  retentionDays?: number | null;
};

export type UsenetServerInput = {
  name: string;
  host: string;
  port: number;
  ssl: boolean;
  username?: string;
  password?: string;
  connections: number;
  priority: number;
  enabled: boolean;
  isBackup: boolean;
  retentionDays?: number;
};

export type PolicySettings = {
  streamingPriority: number;
  maxDownloadConnections: number;
  maxStreamingConnections: number;
  maxTotalUsenetConnections: number;
  streamCacheEnabled: boolean;
  streamCacheMaxSizeGb: number;
  streamCacheMaxAgeHours: number;
  streamChunkSizeBytes: number;
  streamReadAheadBytes: number;
  duplicateNzbBehavior: "download_again_with_suffix" | "mark_failed" | "ignore_existing" | "replace_existing";
  failNzbWithoutVideo: boolean;
  manualUploadCategory: string;
  importStrategy: "symlink" | "strm" | "copy";
  queueDecisionActions: Record<string, "do_nothing" | "remove" | "remove_and_blocklist" | "remove_blocklist_and_search" | "search_again">;
};

export type BlocklistItem = {
  id: string;
  guid?: string | null;
  title: string;
  reason: string;
  source?: string | null;
  release?: unknown;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  active?: boolean;
  expired?: boolean;
};

export type BlocklistStats = {
  total: number;
  active: number;
  expired: number;
  reasons: Record<string, number>;
  sources: Record<string, number>;
};

export type NamingSettings = {
  movieFolderFormat: string;
  movieFileFormat: string;
  tvFolderFormat: string;
  seasonFolderFormat: string;
  episodeFileFormat: string;
};

export type NamingPreview = {
  naming: NamingSettings;
  completedPath: string;
  libraryPath: string;
};

export type MediaLibraryItem = {
  id: string;
  sourceKey: string;
  mediaType: string;
  title: string;
  tmdbId?: string | null;
  tvdbId?: string | null;
  imdbId?: string | null;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  overview?: string | null;
  metadataProvider?: string | null;
  metadataUpdatedAt?: string | null;
  year?: number | null;
  season?: number | null;
  episode?: number | null;
  episodeTitle?: string | null;
  episodeOverview?: string | null;
  episodeAirDate?: string | null;
  requestedBy?: string | null;
  requestProvider?: string | null;
  requestId?: string | null;
  downloadId?: string | null;
  nzbId?: string | null;
  vfsMountId?: string | null;
  importStrategy?: string | null;
  libraryStatus: string;
  streamStatus: string;
  healthStatus: string;
  folderPath?: string | null;
  filePath?: string | null;
  symlinkPath?: string | null;
  strmPath?: string | null;
  quality?: string | null;
  source?: string | null;
  codec?: string | null;
  audio?: string | null;
  releaseGroup?: string | null;
  size?: number | null;
  lastStreamedAt?: string | null;
  streamCount: number;
  createdAt: string;
  updatedAt: string;
};

export const api = {
  login,
  logout,
  authMe,
  updateProfile,
  changePassword,
  authTokens,
  createAuthToken,
  deleteAuthToken,
  status: getStatus,
  healthChecks: () => apiRequest<HealthChecksResponse>("/api/health/checks"),
  discoverHome: () => apiRequest<DiscoverHomeResponse>("/api/discover/home"),
  discoverSearch: (query: string) => apiRequest<DiscoverSearchResponse>(`/api/discover/search?query=${encodeURIComponent(query)}`),
  discoverList: (mediaType: "movie" | "tv", page = 1) => apiRequest<DiscoverListResponse>(`/api/discover/${mediaType}?page=${page}`),
  discoverDetails: (item: { mediaType: "movie" | "tv"; title?: string | null; year?: number | null; tmdbId?: string | null; tvdbId?: string | null; imdbId?: string | null }) => {
    const params = new URLSearchParams();
    if (item.title) params.set("title", item.title);
    if (item.year) params.set("year", String(item.year));
    if (item.tmdbId) params.set("tmdbId", item.tmdbId);
    if (item.tvdbId) params.set("tvdbId", item.tvdbId);
    if (item.imdbId) params.set("imdbId", item.imdbId);
    return apiRequest<MediaDetails>(`/api/discover/details/${item.mediaType}?${params.toString()}`);
  },
  releaseCalendar: (month?: string) => apiRequest<ReleaseCalendarResponse>(`/api/release-calendar${month ? `?month=${encodeURIComponent(month)}` : ""}`),
  settings: () => apiRequest<Settings>("/api/settings"),
  updateSettings: (settings: Settings) => apiRequest<Settings>("/api/settings", { method: "PUT", body: JSON.stringify(settings) }),
  setupStatus: () => apiRequest<SetupStatus>("/api/setup/status"),
  completeSetup: (input: CompleteSetupInput = {}) => apiRequest<{ ok: boolean }>("/api/setup/complete", { method: "POST", body: JSON.stringify(input) }),
  plexLibraries: () => apiRequest<{ libraries: PlexLibrary[] }>("/api/plex/libraries"),
  plexTest: () => apiRequest<{ ok: boolean; libraries: PlexLibrary[] }>("/api/plex/test", { method: "POST", body: "{}" }),
  plexRefresh: (path: string) => apiRequest<unknown>("/api/plex/refresh", { method: "POST", body: JSON.stringify({ path }) }),
  plexOauthStart: () => apiRequest<{ pinId: number; code: string; authUrl: string; clientIdentifier: string }>("/api/plex/oauth/start", { method: "POST", body: "{}" }),
  plexOauthPoll: (pinId: number) => apiRequest<{ authorized: boolean; token?: string }>("/api/plex/oauth/poll", { method: "POST", body: JSON.stringify({ pinId }) }),
  resetEnvironment: () => apiRequest<{ ok: boolean; cleared: Record<string, unknown> }>("/api/system/reset-environment", { method: "POST", body: "{}" }),
  policies: () => apiRequest<PolicySettings>("/api/settings/policies"),
  updatePolicies: (policies: PolicySettings) => apiRequest<PolicySettings>("/api/settings/policies", { method: "PUT", body: JSON.stringify(policies) }),
  ignoredFiles: () => apiRequest<string[]>("/api/ignored-files"),
  updateIgnoredFiles: (patterns: string[]) => apiRequest<string[]>("/api/ignored-files", { method: "PUT", body: JSON.stringify(patterns) }),
  testIgnoredFile: (path: string) => apiRequest<{ path: string; ignored: boolean; matches: string[] }>("/api/ignored-files/test", { method: "POST", body: JSON.stringify({ path }) }),
  blocklist: (query?: { q?: string; reason?: string; source?: string; state?: "all" | "active" | "expired"; limit?: number }) =>
    apiRequest<BlocklistItem[]>(`/api/blocklist${query ? `?${new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)])).toString()}` : ""}`),
  blocklistStats: () => apiRequest<BlocklistStats>("/api/blocklist/stats"),
  addBlocklistItem: (item: { title: string; guid?: string; reason?: string; source?: string; expiresAt?: string }) =>
    apiRequest<BlocklistItem>("/api/blocklist", { method: "POST", body: JSON.stringify(item) }),
  updateBlocklistItem: (id: string, item: { title?: string; guid?: string | null; reason?: string; source?: string | null; expiresAt?: string | null }) =>
    apiRequest<BlocklistItem>(`/api/blocklist/${id}`, { method: "PUT", body: JSON.stringify(item) }),
  deleteBlocklistItem: (id: string) => apiRequest<{ ok: boolean }>(`/api/blocklist/${id}`, { method: "DELETE" }),
  clearBlocklistItems: () => apiRequest<{ deleted: number }>("/api/blocklist", { method: "DELETE" }),
  cleanupExpiredBlocklistItems: () => apiRequest<{ deleted: number }>("/api/blocklist/cleanup-expired", { method: "POST", body: "{}" }),
  matchBlocklistRelease: (release: { title: string; guid?: string }) =>
    apiRequest<BlocklistItem[]>("/api/blocklist/match", { method: "POST", body: JSON.stringify(release) }),
  naming: () => apiRequest<NamingSettings>("/api/naming"),
  updateNaming: (naming: NamingSettings) => apiRequest<NamingSettings>("/api/naming", { method: "PUT", body: JSON.stringify(naming) }),
  previewNaming: (body: { media?: Record<string, unknown>; sourcePath?: string; strategy?: string }) =>
    apiRequest<NamingPreview>("/api/naming/preview", { method: "POST", body: JSON.stringify(body) }),
  library: () => apiRequest<MediaLibraryItem[]>("/api/library"),
  libraryStats: () => apiRequest<{ total: number; byStatus: Record<string, number>; byHealth: Record<string, number> }>("/api/library/stats"),
  refreshLibrary: () => apiRequest<{ refreshed: number; items: MediaLibraryItem[] }>("/api/library/refresh", { method: "POST" }),
  reimportLibraryItem: (id: string) => apiRequest<unknown>(`/api/library/${id}/reimport`, { method: "POST" }),
  deleteLibraryItem: (id: string) => apiRequest<{ deleted: boolean }>(`/api/library/${id}`, { method: "DELETE" }),
  searchLibraryReplacements: (id: string) => apiRequest<{ item: MediaLibraryItem; releases: Release[] }>(`/api/library/${id}/replacements`),
  autoReplaceLibraryItem: (id: string) => apiRequest<unknown>(`/api/library/${id}/replace-auto`, { method: "POST" }),
  replaceLibraryItem: (id: string, release: Release) =>
    apiRequest<unknown>(`/api/library/${id}/replace-release`, { method: "POST", body: JSON.stringify({ release }) }),
  profiles: () => apiRequest<QualityProfile[]>("/api/profiles"),
  scoreRelease: (profileId: string, release: Release) =>
    apiRequest<{ accepted: boolean; score: number; reasons: string[] }>("/api/releases/score", {
      method: "POST",
      body: JSON.stringify({ profileId, release })
    }),
  requests: () => apiRequest<MediaRequest[]>("/api/requests"),
  createRequest: (item: { mediaType: "movie" | "tv"; title: string; year?: number | null; tmdbId?: string | null; tvdbId?: string | null; imdbId?: string | null }) =>
    apiRequest<{ request: MediaRequest; seerr: { ok: boolean; status: number; body?: unknown } | null }>("/api/requests", { method: "POST", body: JSON.stringify(item) }),
  requestMonitor: (id: string) => apiRequest<RequestMonitor>(`/api/requests/${id}/monitor`),
  syncRequests: () => apiRequest<RequestSyncResult>("/api/requests/sync", { method: "POST", body: "{}" }),
  approveRequest: (id: string) => apiRequest<MediaRequest>(`/api/requests/${id}/approve`, { method: "POST" }),
  rejectRequest: (id: string) => apiRequest<MediaRequest>(`/api/requests/${id}/reject`, { method: "POST" }),
  searchRequest: (id: string) => apiRequest<{ releases: RequestReleaseCandidate[] }>(`/api/requests/${id}/search`, { method: "POST" }),
  searchRequestEpisode: (id: string, season: number, episode: number) =>
    apiRequest<{ releases: RequestReleaseCandidate[] }>(`/api/requests/${id}/episodes/${season}/${episode}/search`, { method: "POST" }),
  grabRequestEpisode: (id: string, season: number, episode: number) =>
    apiRequest<unknown>(`/api/requests/${id}/episodes/${season}/${episode}/download`, { method: "POST" }),
  grabRequest: (id: string) => apiRequest<unknown>(`/api/requests/${id}/download`, { method: "POST" }),
  grabRequestRelease: (id: string, release: Release) =>
    apiRequest<unknown>(`/api/requests/${id}/grab-release`, { method: "POST", body: JSON.stringify({ release }) }),
  search: (kind: "manual" | "movie" | "tv" | "season" | "episode", body: Record<string, unknown>) =>
    apiRequest<Release[]>(`/api/search/${kind}`, { method: "POST", body: JSON.stringify(body) }),
  downloadRelease: (release: Release) => apiRequest<unknown>("/api/search/download", { method: "POST", body: JSON.stringify({ release }) }),
  testNzbDownload: (release: Release) =>
    apiRequest<NzbTestResult>("/api/search/download-nzb-test", { method: "POST", body: JSON.stringify({ release }) }),
  downloadNzbFile: (release: Release) =>
    downloadBlob("/api/search/download-nzb-file", { method: "POST", body: JSON.stringify({ release }) }),
  queue: () => apiRequest<Download[]>("/api/downloads/queue"),
  queuePage: (page = 1, limit = 25) => apiRequest<DownloadPage>(`/api/downloads/queue/page?page=${page}&limit=${limit}`),
  history: () => apiRequest<Download[]>("/api/downloads/history"),
  historyPage: (page = 1, limit = 25) => apiRequest<DownloadPage>(`/api/downloads/history/page?page=${page}&limit=${limit}`),
  cleanupHistory: () => apiRequest<{ deleted: number; cleanedFailedJobs: number; keptFailed: number; keptCancelled: number }>("/api/downloads/history/cleanup", { method: "POST", body: JSON.stringify({ keepFailed: 0, keepCancelled: 0 }) }),
  addUrl: (url: string, title?: string) => apiRequest<Download>("/api/downloads/add-url", { method: "POST", body: JSON.stringify({ url, title }) }),
  testNzbUrl: (url: string, title?: string) => apiRequest<NzbTestResult>("/api/downloads/test-nzb-url", { method: "POST", body: JSON.stringify({ url, title }) }),
  addNzb: (input: { filename?: string; title?: string; content: string }) =>
    apiRequest<Download>("/api/downloads/add-nzb", { method: "POST", body: JSON.stringify(input) }),
  pause: (id: string) => apiRequest<Download>(`/api/downloads/${id}/pause`, { method: "POST" }),
  resume: (id: string) => apiRequest<Download>(`/api/downloads/${id}/resume`, { method: "POST" }),
  cancel: (id: string) => apiRequest<Download>(`/api/downloads/${id}/cancel`, { method: "POST" }),
  retry: (id: string) => apiRequest<Download>(`/api/downloads/${id}/retry`, { method: "POST" }),
  makeAvailable: (id: string) => apiRequest<{ downloadId: string; streamPath: string }>(`/api/downloads/${id}/make-available`, { method: "POST" }),
  deleteDownload: (id: string) => apiRequest<{ ok: boolean }>(`/api/downloads/${id}`, { method: "DELETE" }),
  repair: (id: string) => apiRequest<RepairJob>(`/api/repair/${id}`, { method: "POST" }),
  repairJobs: () => apiRequest<RepairJob[]>("/api/repair/jobs"),
  logs: () => apiRequest<LogEvent[]>("/api/logs"),
  logsDownloadUrl: () => downloadFileUrl("/api/logs/download"),
  vfsList: (path: string) => apiRequest<VfsNode[]>(`/api/vfs/list?path=${encodeURIComponent(path)}`),
  vfsTree: (path = "/", depth = 4) => apiRequest<VfsTreeNode>(`/api/vfs/tree?path=${encodeURIComponent(path)}&depth=${depth}`),
  streamSessions: () => apiRequest<StreamSession[]>("/api/vfs/streams"),
  streamMetrics: () => apiRequest<StreamMetrics>("/api/vfs/streams/metrics"),
  stopStream: (id: string) => apiRequest<{ ok: boolean }>(`/api/vfs/streams/${id}/stop`, { method: "POST" }),
  fuseStatus: () => apiRequest<FuseStatus>("/api/vfs/fuse"),
  bandwidthStatus: () => apiRequest<BandwidthStatus>("/api/vfs/bandwidth"),
  tasks: () => apiRequest<{ tasks: ScheduledTask[] }>("/api/tasks"),
  runTask: (id: string) => apiRequest<{ task: ScheduledTask | null; skipped: boolean; reason?: string }>(`/api/tasks/${id}/run`, { method: "POST", body: "{}" }),
  refreshVfs: () => apiRequest<{ ok: boolean }>("/api/vfs/refresh", { method: "POST" }),
  imports: () => apiRequest<ImportItem[]>("/api/imports"),
  symlinks: () => apiRequest<SymlinkItem[]>("/api/symlinks"),
  repairSymlinks: () => apiRequest<{ repaired: number }>("/api/symlinks/repair", { method: "POST" }),
  cleanupSymlinks: () => apiRequest<{ orphaned: number }>("/api/symlinks/cleanup", { method: "POST" }),
  requestProviders: () => apiRequest<RequestProvider[]>("/api/request-providers"),
  createRequestProvider: (provider: RequestProviderInput) =>
    apiRequest<RequestProvider>("/api/request-providers", { method: "POST", body: JSON.stringify(provider) }),
  updateRequestProvider: (id: string, provider: Partial<RequestProviderInput>) =>
    apiRequest<RequestProvider>(`/api/request-providers/${id}`, { method: "PUT", body: JSON.stringify(provider) }),
  deleteRequestProvider: (id: string) => apiRequest<RequestProvider>(`/api/request-providers/${id}`, { method: "DELETE" }),
  testRequestProvider: (id: string) => apiRequest<{ ok: boolean; status: number; endpoint: string; message?: string }>(`/api/request-providers/${id}/test`, { method: "POST" }),
  usenetServers: () => apiRequest<UsenetServer[]>("/api/usenet/servers"),
  createUsenetServer: (server: UsenetServerInput) =>
    apiRequest<UsenetServer>("/api/usenet/servers", { method: "POST", body: JSON.stringify(server) }),
  updateUsenetServer: (id: string, server: Partial<UsenetServerInput>) =>
    apiRequest<UsenetServer>(`/api/usenet/servers/${id}`, { method: "PUT", body: JSON.stringify(server) }),
  deleteUsenetServer: (id: string) => apiRequest<UsenetServer>(`/api/usenet/servers/${id}`, { method: "DELETE" })
};
