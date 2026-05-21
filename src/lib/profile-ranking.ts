import type { QualityProfile } from "../api/client";

export const activeRankingSignals = [
  "resolution",
  "source",
  "codec",
  "language",
  "HDR/DV gates",
  "proper",
  "repack",
  "seeders",
  "size"
];

export const referenceRankingBuckets = [
  "quality",
  "rips",
  "HDR",
  "audio",
  "extras",
  "trash"
];

export const defaultProfileDraft: Omit<QualityProfile, "id"> = {
  name: "",
  allowedQualities: ["1080p"],
  cutoffQuality: null,
  preferredWords: [],
  rejectedWords: [],
  requiredWords: [],
  minSize: null,
  maxSize: null,
  preferredLanguages: [],
  requiredLanguages: [],
  allowHDR: true,
  allowDV: true,
  allowRemux: true,
  allowBluRay: true,
  allowWebDL: true,
  allowWebRip: true,
  allowX264: true,
  allowX265: true,
  allowAV1: true,
  allowMultiAudio: true,
  rejectCam: true,
  rejectTelesync: true,
  rejectScreener: true,
  rejectPassworded: true,
  rejectSuspicious: true,
  preferProper: true,
  preferRepack: true
};

export function describeProfile(profile: QualityProfile) {
  const signals = [...activeRankingSignals];
  if (profile.preferredWords.length > 0) signals.push("preferred words");
  if (profile.requiredWords.length > 0) signals.push("required words");
  if (profile.preferredLanguages.length > 0) signals.push("preferred audio");
  if (profile.requiredLanguages.length > 0) signals.push("required audio");
  if (!profile.allowMultiAudio) signals.push("single-audio only");
  return signals;
}
