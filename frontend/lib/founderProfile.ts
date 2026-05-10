/**
 * Founder / company profile for onboarding.
 * Primary store: localStorage (per wallet). Optional: Pin via API → IPFS CID on RoundFactory.
 */

export type FounderProfile = {
  version: 1;
  wallet: `0x${string}`;
  companyDisplayName: string;
  companyLegalName: string;
  website: string;
  jurisdiction: string;
  entityType: string;
  twitter: string;
  linkedin: string;
  email: string;
  updatedAt: string;
};

export function profileStorageKey(wallet: string) {
  return `holdr-founder-profile:${wallet.toLowerCase()}`;
}

export function skipStorageKey(wallet: string) {
  return `holdr-onboarding-skip:${wallet.toLowerCase()}`;
}

export function loadFounderProfile(wallet: string): FounderProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(profileStorageKey(wallet));
    if (!raw) return null;
    const data = JSON.parse(raw) as FounderProfile;
    if (data.version !== 1 || !data.companyDisplayName) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveFounderProfile(profile: FounderProfile) {
  if (typeof window === "undefined") return;
  localStorage.setItem(profileStorageKey(profile.wallet), JSON.stringify(profile));
}

export function isOnboardingSkipped(wallet: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(skipStorageKey(wallet)) === "1";
}

export function setOnboardingSkipped(wallet: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(skipStorageKey(wallet), "1");
}

export function clearOnboardingSkipped(wallet: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(skipStorageKey(wallet));
}

export function ipfsGatewayUrl(cid: string): string {
  const base =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_IPFS_GATEWAY) ||
    "https://ipfs.io/ipfs";
  return `${base.replace(/\/$/, "")}/${cid}`;
}
