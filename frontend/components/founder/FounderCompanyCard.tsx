"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Globe, MapPin, Pin, ExternalLink } from "lucide-react";
import { useFounderProfileCid } from "@/lib/hooks/useFounderProfileCid";
import type { FounderProfile } from "@/lib/founderProfile";
import { ipfsGatewayUrl, loadFounderProfile } from "@/lib/founderProfile";

export function FounderCompanyCard({
  founder,
  isFounder,
}: {
  founder: `0x${string}`;
  isFounder: boolean;
}) {
  const { cid } = useFounderProfileCid(founder);
  const [local, setLocal] = useState<FounderProfile | null>(null);
  const [remote, setRemote] = useState<FounderProfile | null>(null);
  const [ipfsError, setIpfsError] = useState(false);

  useEffect(() => {
    if (isFounder) setLocal(loadFounderProfile(founder));
  }, [founder, isFounder]);

  useEffect(() => {
    if (!cid) {
      setRemote(null);
      setIpfsError(false);
      return;
    }
    let cancelled = false;
    setIpfsError(false);
    fetch(ipfsGatewayUrl(cid))
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.json();
      })
      .then((j) => {
        if (!cancelled) setRemote(j as FounderProfile);
      })
      .catch(() => {
        if (!cancelled) setIpfsError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [cid]);

  const display = remote ?? (isFounder ? local : null);

  if (!display && !isFounder && !cid) return null;

  if (!display) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-4">
        <p className="text-xs font-mono uppercase tracking-wide text-muted">Issuer</p>
        <p className="mt-2 text-sm text-muted">
          No public profile pinned yet. Founders can add company details in onboarding.
        </p>
      </div>
    );
  }

  const pinned = !!cid && !!remote && !ipfsError;

  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-3">
        <Building2 size={13} className="text-[#8624FF]" />
        <p className="text-xs font-mono uppercase tracking-wide text-muted">Company</p>
        {pinned && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-[#8624FF]/25 bg-[#8624FF]/8 px-2 py-0.5 text-[10px] font-medium text-[#6b21c8]">
            <Pin size={10} />
            IPFS
          </span>
        )}
        {isFounder && !pinned && (
          <span className="ml-auto text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5">
            Local only
          </span>
        )}
      </div>
      <div className="space-y-2.5 px-4 py-4 bg-background">
        <div>
          <p className="text-sm font-semibold text-foreground">{display.companyDisplayName}</p>
          {display.companyLegalName !== display.companyDisplayName && (
            <p className="text-xs text-muted mt-0.5">{display.companyLegalName}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
          {(display.entityType || display.jurisdiction) && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={12} className="shrink-0" />
              {[display.entityType, display.jurisdiction].filter(Boolean).join(" · ")}
            </span>
          )}
          {display.website && (
            <a
              href={display.website.startsWith("http") ? display.website : `https://${display.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[#8624FF] hover:underline"
            >
              <Globe size={12} />
              Website
              <ExternalLink size={10} />
            </a>
          )}
        </div>
        {isFounder && (
          <Link href="/onboarding" className="text-xs text-muted hover:text-foreground underline underline-offset-2">
            Edit company profile
          </Link>
        )}
      </div>
    </div>
  );
}
