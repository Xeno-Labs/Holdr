'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAccount, useWriteContract } from 'wagmi';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Globe,
  MapPin,
  Share2,
} from 'lucide-react';
import {
  type FounderProfile,
  saveFounderProfile,
  loadFounderProfile,
  setOnboardingSkipped,
  clearOnboardingSkipped,
} from '@/lib/founderProfile';
import { ADDRESSES, ROUND_FACTORY_ABI } from '@/lib/contracts';
import { useTxToast } from '@/components/ui/Toast';

const inter = 'font-[family-name:var(--font-inter),sans-serif]';

type Step = 1 | 2 | 3;

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') || '/founder/new';

  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { write } = useTxToast();

  const [step, setStep] = useState<Step>(1);
  const [pinning, setPinning] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [website, setWebsite] = useState('');
  const [jurisdiction, setJurisdiction] = useState('');
  const [entityType, setEntityType] = useState('Delaware C-Corp');
  const [twitter, setTwitter] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (!address) return;
    const existing = loadFounderProfile(address);
    if (existing) {
      setDisplayName(existing.companyDisplayName);
      setLegalName(existing.companyLegalName);
      setWebsite(existing.website);
      setJurisdiction(existing.jurisdiction);
      setEntityType(existing.entityType);
      setTwitter(existing.twitter);
      setLinkedin(existing.linkedin);
      setEmail(existing.email);
    }
  }, [address]);

  function buildProfile(): FounderProfile | null {
    if (!address) return null;
    return {
      version: 1,
      wallet: address,
      companyDisplayName: displayName.trim(),
      companyLegalName: legalName.trim() || displayName.trim(),
      website: website.trim(),
      jurisdiction: jurisdiction.trim(),
      entityType: entityType.trim(),
      twitter: twitter.trim(),
      linkedin: linkedin.trim(),
      email: email.trim(),
      updatedAt: new Date().toISOString(),
    };
  }

  function handleFinish(saveLocal: boolean, pinOnChain: boolean) {
    const p = buildProfile();
    if (!p || !p.companyDisplayName || !address) return;
    if (saveLocal) saveFounderProfile(p);
    clearOnboardingSkipped(address);
    if (!pinOnChain) {
      router.push(nextPath);
      return;
    }
    void (async () => {
      setPinning(true);
      setPinError(null);
      try {
        const res = await fetch('/api/pin-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(p),
        });
        const data = (await res.json()) as { cid?: string; error?: string };
        if (!res.ok) {
          setPinError(data.error || 'Pin failed');
          setPinning(false);
          return;
        }
        if (!data.cid) {
          setPinError('No CID returned');
          setPinning(false);
          return;
        }
        const cid = data.cid as string;
        await write('Save profile CID', () =>
          writeContractAsync({
            address: ADDRESSES.RoundFactory,
            abi: ROUND_FACTORY_ABI,
            functionName: 'setFounderProfileCid',
            args: [cid],
          }),
        );
        router.push(nextPath);
      } catch (e) {
        setPinError((e as Error).message || 'Pin failed');
      } finally {
        setPinning(false);
      }
    })();
  }

  if (!isConnected || !address) {
    return (
      <div className={`mx-auto max-w-lg px-6 py-20 text-center ${inter}`}>
        <Building2
          className="mx-auto size-10 text-[#8624FF]"
          strokeWidth={1.25}
        />
        <h1 className="mt-4 text-xl font-semibold text-zinc-900">
          Company onboarding
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Connect your wallet to save company information.
        </p>
      </div>
    );
  }

  return (
    <div className={`min-h-[calc(100vh-60px)] bg-zinc-50/50 ${inter}`}>
      <div className="mx-auto max-w-xl px-6 py-10">
        <Link
          href={nextPath}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-700 mb-8"
        >
          <ArrowLeft size={12} /> Skip to destination
        </Link>

        <div className="flex items-center gap-2 mb-2">
          <span className="text-[11px] font-mono uppercase tracking-widest text-[#8624FF]">
            Onboarding
          </span>
          <span className="text-xs text-zinc-400">Step {step} of 3</span>
        </div>
        <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">
          Company profile
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Investors see pinned details after you record an IPFS CID on-chain.
          Otherwise this device only.
        </p>

        <div className="mt-2 flex gap-1">
          {([1, 2, 3] as const).map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                s <= step ? 'bg-[#8624FF]' : 'bg-zinc-200'
              }`}
            />
          ))}
        </div>

        <div className="mt-8 space-y-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          {step === 1 && (
            <>
              <div>
                <label className="text-sm font-medium text-zinc-800">
                  Company display name
                </label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Cipher Labs"
                  className="mt-1.5 w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm focus:border-[#8624FF]/40 focus:outline-none focus:ring-2 focus:ring-[#8624FF]/15"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-zinc-800">
                  Legal entity name
                </label>
                <input
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="Cipher Labs, Inc."
                  className="mt-1.5 w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm focus:border-[#8624FF]/40 focus:outline-none focus:ring-2 focus:ring-[#8624FF]/15"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-zinc-800">
                  Website
                </label>
                <div className="relative mt-1.5">
                  <Globe className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://cipherlabs.example"
                    className="w-full rounded-xl border border-zinc-200 py-3 pl-10 pr-4 text-sm focus:border-[#8624FF]/40 focus:outline-none focus:ring-2 focus:ring-[#8624FF]/15"
                  />
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <label className="text-sm font-medium text-zinc-800">
                  Jurisdiction
                </label>
                <div className="relative mt-1.5">
                  <MapPin className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    value={jurisdiction}
                    onChange={(e) => setJurisdiction(e.target.value)}
                    placeholder="Delaware, USA"
                    className="w-full rounded-xl border border-zinc-200 py-3 pl-10 pr-4 text-sm focus:border-[#8624FF]/40 focus:outline-none focus:ring-2 focus:ring-[#8624FF]/15"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-zinc-800">
                  Entity type
                </label>
                <select
                  value={entityType}
                  onChange={(e) => setEntityType(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm focus:border-[#8624FF]/40 focus:outline-none focus:ring-2 focus:ring-[#8624FF]/15"
                >
                  {[
                    'Delaware C-Corp',
                    'Delaware LLC',
                    'UK Ltd',
                    'Cayman exempted company',
                    'Other',
                  ].map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <label className="text-sm font-medium text-zinc-800">
                  X / Twitter
                </label>
                <input
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value)}
                  placeholder="@cipherlabs"
                  className="mt-1.5 w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm focus:border-[#8624FF]/40 focus:outline-none focus:ring-2 focus:ring-[#8624FF]/15"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-zinc-800">
                  LinkedIn
                </label>
                <input
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                  placeholder="Company page URL"
                  className="mt-1.5 w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm focus:border-[#8624FF]/40 focus:outline-none focus:ring-2 focus:ring-[#8624FF]/15"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-zinc-800">
                  Contact email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="founders@cipherlabs.example"
                  className="mt-1.5 w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm focus:border-[#8624FF]/40 focus:outline-none focus:ring-2 focus:ring-[#8624FF]/15"
                />
              </div>
            </>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
                className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm text-zinc-600 hover:bg-zinc-50"
              >
                Back
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setOnboardingSkipped(address);
                  router.push(nextPath);
                }}
                className="text-sm text-zinc-400 hover:text-zinc-600"
              >
                Skip for now
              </button>
            )}
            {step < 3 ? (
              <button
                type="button"
                disabled={step === 1 && !displayName.trim()}
                onClick={() => setStep((s) => (s < 3 ? ((s + 1) as Step) : s))}
                className="inline-flex items-center gap-2 rounded-xl bg-[#8624FF] px-5 py-2.5 text-sm font-medium text-white shadow-[0_0_20px_rgba(134,36,255,0.25)] hover:opacity-90 disabled:opacity-40"
              >
                Continue <ArrowRight size={14} />
              </button>
            ) : (
              <div className="flex flex-col gap-2 w-full sm:w-auto sm:flex-row sm:items-center">
                <button
                  type="button"
                  disabled={!displayName.trim() || pinning}
                  onClick={() => handleFinish(true, false)}
                  className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
                >
                  Save locally & continue
                </button>
                <button
                  type="button"
                  disabled={!displayName.trim() || pinning}
                  onClick={() => handleFinish(true, true)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#8624FF] px-5 py-2.5 text-sm font-medium text-white shadow-[0_0_20px_rgba(134,36,255,0.25)] hover:opacity-90 disabled:opacity-40"
                >
                  <Share2 size={14} />
                  {pinning ? 'Pinning…' : 'Pin to IPFS & save on-chain'}
                </button>
              </div>
            )}
          </div>

          {pinError && (
            <p className="text-xs text-red-600 border border-red-100 bg-red-50 rounded-lg px-3 py-2">
              {pinError}. You can still use &quot;Save locally & continue&quot;
              or set <code className="font-mono">PINATA_JWT</code> in{' '}
              <code className="font-mono">.env.local</code>.
            </p>
          )}
        </div>

        <p className="mt-6 text-xs text-zinc-400 leading-relaxed">
          <Building2 className="inline size-3.5 mr-1 align-text-bottom text-zinc-400" />
          This flow does not create a legal relationship. Company fields are for
          credibility in the product UI only.
        </p>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-60px)] flex items-center justify-center">
          <div className="size-8 animate-spin rounded-full border-2 border-[#8624FF] border-t-transparent" />
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
