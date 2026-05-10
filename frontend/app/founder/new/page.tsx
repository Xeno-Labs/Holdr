'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useWriteContract, usePublicClient } from 'wagmi';
import { parseEventLogs, isAddress } from 'viem';
import {
  ADDRESSES,
  ROUND_FACTORY_ABI,
  ALLOCATIONS_ABI,
  parseUSDT,
} from '@/lib/contracts';
import { encryptUint64 } from '@/lib/fhe';
import { useTxToast } from '@/components/ui/Toast';
import {
  Check,
  Lock,
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  ShieldCheck,
  Sparkles,
  FileText,
  Upload,
  X,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import Link from 'next/link';

type Step = 'details' | 'terms' | 'investors' | 'review' | 'done';
const STEPS: Step[] = ['details', 'terms', 'investors', 'review'];
const STEP_META: Record<Step, { n: number; title: string; sub: string }> = {
  details: { n: 1, title: 'Round details', sub: 'Name, target & timeline' },
  terms: { n: 2, title: 'Terms & docs', sub: 'Instrument, terms, filings' },
  investors: { n: 3, title: 'Allocations', sub: 'Who gets in and how much' },
  review: { n: 4, title: 'Review & deploy', sub: 'Confirm and go on-chain' },
  done: { n: 4, title: 'Review & deploy', sub: 'Confirm and go on-chain' },
};

type Instrument = 'SAFE' | 'KISS' | 'Convertible Note' | 'Priced Equity';

interface InvestorEntry {
  address: string;
  amount: string;
}
interface UploadedFile {
  name: string;
  size: string;
}

// ─── shared primitives ───────────────────────────────────────────────────────

function Field({
  label,
  hint,
  children,
  tag,
}: {
  label: string;
  hint?: string;
  tag?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-sm font-medium text-zinc-800 flex items-center gap-2">
          {label} {tag}
        </label>
        {hint && <span className="text-xs text-zinc-400 shrink-0">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function FheCallout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#8624FF]/20 bg-[#8624FF]/5 px-4 py-3">
      <ShieldCheck size={15} className="mt-0.5 shrink-0 text-[#8624FF]" />
      <p className="text-xs leading-relaxed text-[#6b21c8]">{children}</p>
    </div>
  );
}

function OptionalTag() {
  return (
    <span className="text-[10px] font-normal text-zinc-400 border border-zinc-200 rounded-full px-1.5 py-px">
      optional
    </span>
  );
}

function inputCls(error?: boolean) {
  return `w-full border rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 transition-all ${
    error
      ? 'border-red-300 focus:ring-red-100'
      : 'border-zinc-200 focus:ring-[#8624FF]/20 focus:border-[#8624FF]/40'
  }`;
}

function PrimaryBtn({
  disabled,
  loading,
  onClick,
  children,
}: {
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="flex items-center gap-2 bg-[#8624FF] text-white text-sm font-medium rounded-xl px-6 py-3 shadow-[0_0_24px_rgba(134,36,255,0.25)] hover:opacity-90 transition-opacity disabled:opacity-40 disabled:shadow-none"
    >
      {loading ? (
        <>
          <span className="w-3.5 h-3.5 border border-white/30 border-t-white rounded-full animate-spin" />{' '}
          Processing…
        </>
      ) : (
        children
      )}
    </button>
  );
}

function GhostBtn({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 border border-zinc-200 rounded-xl px-5 py-2.5 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
    >
      {children}
    </button>
  );
}

// ─── main ────────────────────────────────────────────────────────────────────

export default function NewRoundPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const publicClient = usePublicClient();
  const { write } = useTxToast();

  // step
  const [step, setStep] = useState<Step>('details');

  // step 1 — details
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [deadlineDays, setDeadlineDays] = useState('30');

  // step 2 — terms
  const [instrument, setInstrument] = useState<Instrument>('SAFE');
  const [valCap, setValCap] = useState('');
  const [discount, setDiscount] = useState('20');
  const [proRata, setProRata] = useState(true);
  const [requireAccredited, setRequireAccredited] = useState(true);
  const [docs, setDocs] = useState<Record<string, UploadedFile>>({});
  const fileRefs = {
    pitch: useRef<HTMLInputElement>(null),
    incorp: useRef<HTMLInputElement>(null),
    safe: useRef<HTMLInputElement>(null),
  };

  // step 3 — investors
  const [investors, setInvestors] = useState<InvestorEntry[]>([
    { address: '', amount: '' },
  ]);

  // done
  const [createdId, setCreatedId] = useState<bigint | null>(null);

  const validInvestors = investors.filter(
    (i) => isAddress(i.address) && Number(i.amount) > 0,
  );
  const totalAlloc = validInvestors.reduce((s, i) => s + Number(i.amount), 0);
  const currentIndex = STEPS.indexOf(step === 'done' ? 'review' : step);

  // ── helpers ──────────────────────────────────────────────────────────────

  function handleFilePick(key: string, file: File | undefined) {
    if (!file) return;
    const kb = file.size / 1024;
    const size =
      kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(0)} KB`;
    setDocs((d) => ({ ...d, [key]: { name: file.name, size } }));
  }
  function removeDoc(key: string) {
    setDocs((d) => {
      const n = { ...d };
      delete n[key];
      return n;
    });
  }

  function addRow() {
    setInvestors((p) => [...p, { address: '', amount: '' }]);
  }
  function removeRow(i: number) {
    setInvestors((p) => p.filter((_, idx) => idx !== i));
  }
  function updateRow(i: number, field: keyof InvestorEntry, val: string) {
    setInvestors((p) =>
      p.map((r, idx) => (idx === i ? { ...r, [field]: val } : r)),
    );
  }

  async function createRound() {
    if (!isConnected || !publicClient || !address) return;
    const deadlineTs = BigInt(
      Math.floor(Date.now() / 1000) + Number(deadlineDays) * 86400,
    );
    const hash = await write('Creating round', () =>
      writeContractAsync({
        address: ADDRESSES.RoundFactory,
        abi: ROUND_FACTORY_ABI,
        functionName: 'createRound',
        args: [name, parseUSDT(Number(target)), deadlineTs],
      }),
    );
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const logs = parseEventLogs({ abi: ROUND_FACTORY_ABI, logs: receipt.logs });
    const evt = logs.find((l) => l.eventName === 'RoundCreated');
    const roundId = evt ? (evt.args as { roundId: bigint }).roundId : null;
    if (roundId === null) return;

    for (const inv of validInvestors) {
      const rawAmount = parseUSDT(Number(inv.amount));
      const { handle, inputProof } = await encryptUint64(
        rawAmount,
        ADDRESSES.Allocations,
        address,
        publicClient,
      );
      await write(`Adding ${inv.address.slice(0, 8)}…`, () =>
        writeContractAsync({
          address: ADDRESSES.Allocations,
          abi: ALLOCATIONS_ABI,
          functionName: 'addInvestor',
          args: [roundId, inv.address as `0x${string}`, handle, inputProof],
        }),
      );
    }
    setCreatedId(roundId);
    setStep('done');
  }

  // ── not connected ─────────────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <div className="flex min-h-[calc(100vh-60px)] items-center justify-center px-6">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#8624FF]/10 border border-[#8624FF]/20 flex items-center justify-center mx-auto">
            <Lock size={20} className="text-[#8624FF]" />
          </div>
          <div>
            <p className="text-base font-semibold text-zinc-900">
              Connect your wallet
            </p>
            <p className="text-sm text-zinc-500 mt-1">
              You need a connected wallet to create a fundraise round.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── done ──────────────────────────────────────────────────────────────────
  if (step === 'done' && createdId !== null) {
    return (
      <div className="flex min-h-[calc(100vh-60px)] items-center justify-center px-6">
        <div className="max-w-md w-full text-center space-y-6 animate-fade-up">
          <div className="relative mx-auto w-16 h-16">
            <div className="absolute inset-0 rounded-full bg-[#8624FF]/15 blur-xl" />
            <div className="relative w-16 h-16 rounded-2xl bg-[#8624FF] flex items-center justify-center shadow-[0_0_32px_rgba(134,36,255,0.4)]">
              <Sparkles size={24} className="text-white" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-zinc-900">
              Round deployed
            </h2>
            <p className="text-sm text-zinc-500 mt-2 leading-relaxed">
              Round #{createdId.toString()} is live on Sepolia. Investor
              allocations are encrypted and access-controlled on-chain.
            </p>
          </div>
          <div className="border border-zinc-200 rounded-2xl divide-y divide-zinc-100 text-left overflow-hidden bg-zinc-50/50">
            {[
              { label: 'Round name', value: name },
              { label: 'Instrument', value: instrument },
              {
                label: 'Valuation cap',
                value: valCap ? `$${Number(valCap).toLocaleString()}` : '—',
              },
              {
                label: 'Target',
                value: `$${Number(target).toLocaleString()} USDT`,
              },
              {
                label: 'Investors',
                value: `${validInvestors.length} encrypted`,
              },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="flex items-center justify-between px-4 py-3"
              >
                <span className="text-xs text-zinc-400 font-mono">{label}</span>
                <span className="text-sm font-medium text-zinc-800">
                  {value}
                </span>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push(`/round/${createdId.toString()}`)}
              className="flex-1 flex items-center justify-center gap-2 bg-[#8624FF] text-white text-sm font-medium rounded-xl px-5 py-2.5 shadow-[0_0_24px_rgba(134,36,255,0.3)] hover:opacity-90 transition-opacity"
            >
              Open round <ArrowRight size={14} />
            </button>
            <button
              onClick={() => {
                setStep('details');
                setName('');
                setTarget('');
                setInvestors([{ address: '', amount: '' }]);
                setCreatedId(null);
                setDocs({});
              }}
              className="border border-zinc-200 text-sm text-zinc-700 rounded-xl px-5 py-2.5 hover:bg-zinc-50 transition-colors"
            >
              New round
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── main ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[calc(100vh-60px)] flex bg-white">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-72 border-r border-zinc-100 bg-zinc-50/60 px-6 py-10 shrink-0">
        <Link
          href="/rounds"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-700 mb-10 transition-colors"
        >
          <ArrowLeft size={12} /> Back to rounds
        </Link>
        <p className="text-[11px] font-mono uppercase tracking-widest text-zinc-400 mb-5">
          New round
        </p>

        <nav className="space-y-1">
          {STEPS.map((s, i) => {
            const done = i < currentIndex;
            const current = i === currentIndex;
            const meta = STEP_META[s];
            return (
              <button
                key={s}
                onClick={() => (done ? setStep(s) : undefined)}
                disabled={!done && !current}
                className={`w-full text-left flex items-start gap-3 px-3 py-3 rounded-xl transition-colors ${
                  current
                    ? 'bg-white border border-zinc-200 shadow-sm'
                    : done
                    ? 'hover:bg-white/80 cursor-pointer'
                    : 'cursor-default opacity-50'
                }`}
              >
                <div
                  className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-mono shrink-0 transition-colors ${
                    done
                      ? 'bg-[#8624FF] text-white'
                      : current
                      ? 'bg-zinc-900 text-white'
                      : 'bg-zinc-200 text-zinc-400'
                  }`}
                >
                  {done ? <Check size={10} /> : meta.n}
                </div>
                <div>
                  <p
                    className={`text-sm font-medium ${
                      current || done ? 'text-zinc-900' : 'text-zinc-400'
                    }`}
                  >
                    {meta.title}
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5">{meta.sub}</p>
                </div>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto pt-8 border-t border-zinc-100">
          <div className="rounded-xl border border-[#8624FF]/20 bg-[#8624FF]/5 p-3.5 space-y-1.5">
            <div className="flex items-center gap-2">
              <ShieldCheck size={13} className="text-[#8624FF] shrink-0" />
              <span className="text-xs font-medium text-[#6b21c8]">
                FHE-encrypted
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-[#7c3aed]/70">
              Allocations are stored as{' '}
              <code className="font-mono">euint64</code> ciphertexts. Only
              wallets you grant access can decrypt their own row.
            </p>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto px-6 md:px-10 py-10 animate-fade-up">
          {/* Mobile progress */}
          <div className="flex items-center gap-1.5 mb-8 md:hidden">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={`h-1 rounded-full flex-1 transition-all ${
                  i < currentIndex
                    ? 'bg-[#8624FF]'
                    : i === currentIndex
                    ? 'bg-zinc-800'
                    : 'bg-zinc-200'
                }`}
              />
            ))}
          </div>

          {/* ── Step 1: Details ──────────────────────────────────────────── */}
          {step === 'details' && (
            <div className="space-y-8">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-widest text-zinc-400 mb-1">
                  Step 1 of 4
                </p>
                <h1 className="text-2xl font-semibold text-zinc-900">
                  Round details
                </h1>
                <p className="text-sm text-zinc-500 mt-1">
                  Basic information about your fundraise.
                </p>
              </div>
              <div className="space-y-5">
                <Field label="Round name" hint="e.g. Seed, Series A">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Cipher Labs Seed Round"
                    className={inputCls()}
                  />
                </Field>

                <Field label="Target raise" hint="USDT on Sepolia">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-sm font-mono">
                      $
                    </span>
                    <input
                      type="number"
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                      placeholder="500,000"
                      className="w-full border border-zinc-200 rounded-xl pl-8 pr-16 py-3 text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-[#8624FF]/20 focus:border-[#8624FF]/40 transition-all"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-mono">
                      USDT
                    </span>
                  </div>
                </Field>

                <Field
                  label="Round deadline"
                  hint={
                    deadlineDays
                      ? `closes ${new Date(
                          Date.now() + Number(deadlineDays) * 86400000,
                        ).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}`
                      : ''
                  }
                >
                  <div className="grid grid-cols-4 gap-2">
                    {['14', '30', '60', '90'].map((d) => (
                      <button
                        key={d}
                        onClick={() => setDeadlineDays(d)}
                        className={`border rounded-xl py-2.5 text-sm font-mono transition-all ${
                          deadlineDays === d
                            ? 'border-[#8624FF] bg-[#8624FF] text-white shadow-[0_0_12px_rgba(134,36,255,0.3)]'
                            : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 text-zinc-700'
                        }`}
                      >
                        {d}d
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
              <PrimaryBtn
                disabled={!name || !target}
                onClick={() => setStep('terms')}
              >
                Continue <ArrowRight size={14} />
              </PrimaryBtn>
            </div>
          )}

          {/* ── Step 2: Terms & Docs ─────────────────────────────────────── */}
          {step === 'terms' && (
            <div className="space-y-8">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-widest text-zinc-400 mb-1">
                  Step 2 of 4
                </p>
                <h1 className="text-2xl font-semibold text-zinc-900">
                  Terms & documents
                </h1>
                <p className="text-sm text-zinc-500 mt-1">
                  Specify the legal instrument and attach round documents.
                </p>
              </div>

              {/* Instrument */}
              <Field label="Investment instrument">
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      'SAFE',
                      'KISS',
                      'Convertible Note',
                      'Priced Equity',
                    ] as Instrument[]
                  ).map((inst) => (
                    <button
                      key={inst}
                      onClick={() => setInstrument(inst)}
                      className={`border rounded-xl px-4 py-3 text-sm text-left transition-all ${
                        instrument === inst
                          ? 'border-[#8624FF] bg-[#8624FF]/5 text-[#8624FF] font-medium'
                          : 'border-zinc-200 hover:border-zinc-300 text-zinc-700 hover:bg-zinc-50'
                      }`}
                    >
                      <span className="block font-medium">{inst}</span>
                      <span className="block text-xs mt-0.5 opacity-60">
                        {inst === 'SAFE' && 'Y Combinator standard'}
                        {inst === 'KISS' && '500 Startups standard'}
                        {inst === 'Convertible Note' && 'Debt instrument'}
                        {inst === 'Priced Equity' && 'Preferred shares'}
                      </span>
                    </button>
                  ))}
                </div>
              </Field>

              {/* Key terms */}
              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="Valuation cap"
                  tag={<OptionalTag />}
                  hint="pre-money"
                >
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-sm font-mono">
                      $
                    </span>
                    <input
                      type="number"
                      value={valCap}
                      onChange={(e) => setValCap(e.target.value)}
                      placeholder="10,000,000"
                      className="w-full border border-zinc-200 rounded-xl pl-8 pr-3 py-3 text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-[#8624FF]/20 focus:border-[#8624FF]/40 transition-all"
                    />
                  </div>
                </Field>
                <Field
                  label="Discount rate"
                  hint={instrument === 'Priced Equity' ? 'n/a' : ''}
                >
                  <div className="relative">
                    <input
                      type="number"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      placeholder="20"
                      min={0}
                      max={50}
                      disabled={instrument === 'Priced Equity'}
                      className="w-full border border-zinc-200 rounded-xl px-4 pr-8 py-3 text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-[#8624FF]/20 focus:border-[#8624FF]/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-mono">
                      %
                    </span>
                  </div>
                </Field>
              </div>

              {/* Toggles */}
              <div className="space-y-3">
                {[
                  {
                    label: 'Pro-rata rights',
                    sub: 'Investors can maintain ownership % in future rounds',
                    val: proRata,
                    set: setProRata,
                  },
                  {
                    label: 'Require accredited investors',
                    sub: 'Investors must self-certify accreditation status',
                    val: requireAccredited,
                    set: setRequireAccredited,
                  },
                ].map(({ label, sub, val, set }) => (
                  <button
                    key={label}
                    onClick={() => set(!val)}
                    className="w-full flex items-center justify-between gap-4 border border-zinc-200 rounded-xl px-4 py-3.5 hover:bg-zinc-50/80 transition-colors text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-zinc-800">
                        {label}
                      </p>
                      <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>
                    </div>
                    {val ? (
                      <ToggleRight
                        size={22}
                        className="text-[#8624FF] shrink-0"
                      />
                    ) : (
                      <ToggleLeft
                        size={22}
                        className="text-zinc-300 shrink-0"
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* Documents */}
              <Field label="Round documents" tag={<OptionalTag />}>
                <div className="space-y-2">
                  {[
                    {
                      key: 'pitch',
                      label: 'Pitch deck',
                      accept: '.pdf,.pptx,.key',
                    },
                    {
                      key: 'incorp',
                      label: 'Incorporation certificate',
                      accept: '.pdf',
                    },
                    {
                      key: 'safe',
                      label: `${instrument} template`,
                      accept: '.pdf,.docx',
                    },
                  ].map(({ key, label, accept }) => {
                    const uploaded = docs[key];
                    const ref = fileRefs[key as keyof typeof fileRefs];
                    return (
                      <div key={key}>
                        <input
                          ref={ref}
                          type="file"
                          accept={accept}
                          className="hidden"
                          onChange={(e) =>
                            handleFilePick(key, e.target.files?.[0])
                          }
                        />
                        {uploaded ? (
                          <div className="flex items-center gap-3 border border-zinc-200 rounded-xl px-4 py-3 bg-zinc-50/60">
                            <FileText
                              size={15}
                              className="text-[#8624FF] shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-zinc-800 truncate font-medium">
                                {uploaded.name}
                              </p>
                              <p className="text-xs text-zinc-400">
                                {uploaded.size}
                              </p>
                            </div>
                            <button
                              onClick={() => removeDoc(key)}
                              className="text-zinc-400 hover:text-zinc-700 transition-colors shrink-0"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => ref.current?.click()}
                            className="w-full flex items-center gap-3 border border-dashed border-zinc-200 rounded-xl px-4 py-3 hover:border-[#8624FF]/30 hover:bg-[#8624FF]/2 transition-all text-left group"
                          >
                            <Upload
                              size={14}
                              className="text-zinc-400 group-hover:text-[#8624FF] transition-colors shrink-0"
                            />
                            <span className="text-sm text-zinc-400 group-hover:text-zinc-600 transition-colors">
                              {label}
                            </span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Field>

              <div className="flex gap-3">
                <GhostBtn onClick={() => setStep('details')}>
                  <ArrowLeft size={14} /> Back
                </GhostBtn>
                <PrimaryBtn onClick={() => setStep('investors')}>
                  Continue <ArrowRight size={14} />
                </PrimaryBtn>
              </div>
            </div>
          )}

          {/* ── Step 3: Investors ────────────────────────────────────────── */}
          {step === 'investors' && (
            <div className="space-y-8">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-widest text-zinc-400 mb-1">
                  Step 3 of 4
                </p>
                <h2 className="text-2xl font-semibold text-zinc-900">
                  Allocations
                </h2>
                <p className="text-sm text-zinc-500 mt-1">
                  Add investor wallets and their allocation amounts.
                </p>
              </div>

              <FheCallout>
                Each amount is encrypted into a{' '}
                <code className="font-mono">euint64</code> ciphertext before
                hitting the chain. Investors read only their own row.
                {requireAccredited &&
                  ' Investors will need to self-certify accredited status before access is granted.'}
              </FheCallout>

              <div className="space-y-3">
                <div className="grid grid-cols-[1fr_140px_32px] gap-2 px-1">
                  <span className="text-[11px] text-zinc-400 font-mono uppercase tracking-wide">
                    Wallet
                  </span>
                  <span className="text-[11px] text-zinc-400 font-mono uppercase tracking-wide">
                    Amount (USDT)
                  </span>
                  <span />
                </div>
                {investors.map((inv, i) => {
                  const addrOk = !inv.address || isAddress(inv.address);
                  return (
                    <div
                      key={i}
                      className="grid grid-cols-[1fr_140px_32px] gap-2 items-center"
                    >
                      <input
                        placeholder="0x…"
                        value={inv.address}
                        onChange={(e) =>
                          updateRow(i, 'address', e.target.value)
                        }
                        className={`border rounded-xl px-3 py-2.5 text-sm font-mono bg-white focus:outline-none focus:ring-2 transition-all ${
                          !addrOk
                            ? 'border-red-300 focus:ring-red-100'
                            : 'border-zinc-200 focus:ring-[#8624FF]/20 focus:border-[#8624FF]/40'
                        }`}
                      />
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-mono">
                          $
                        </span>
                        <input
                          type="number"
                          placeholder="0"
                          value={inv.amount}
                          onChange={(e) =>
                            updateRow(i, 'amount', e.target.value)
                          }
                          className="w-full border border-zinc-200 rounded-xl pl-6 pr-3 py-2.5 text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-[#8624FF]/20 focus:border-[#8624FF]/40 transition-all"
                        />
                      </div>
                      <button
                        onClick={() => removeRow(i)}
                        disabled={investors.length === 1}
                        className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-red-500 transition-colors disabled:opacity-30"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
                <button
                  onClick={addRow}
                  className="flex items-center gap-1.5 text-sm text-zinc-400 border border-dashed border-zinc-200 rounded-xl w-full py-2.5 justify-center hover:border-[#8624FF]/30 hover:text-[#8624FF] transition-colors"
                >
                  <Plus size={14} /> Add investor
                </button>
                {validInvestors.length > 0 && (
                  <div className="flex items-center justify-between text-xs border border-zinc-200 rounded-xl px-4 py-2.5 bg-zinc-50 font-mono">
                    <span className="text-zinc-500">
                      {validInvestors.length} investor
                      {validInvestors.length !== 1 ? 's' : ''}
                    </span>
                    <span className="text-zinc-800 font-semibold">
                      ${totalAlloc.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <GhostBtn onClick={() => setStep('terms')}>
                  <ArrowLeft size={14} /> Back
                </GhostBtn>
                <PrimaryBtn
                  disabled={validInvestors.length === 0}
                  onClick={() => setStep('review')}
                >
                  Review <ArrowRight size={14} />
                </PrimaryBtn>
              </div>
            </div>
          )}

          {/* ── Step 4: Review ───────────────────────────────────────────── */}
          {step === 'review' && (
            <div className="space-y-8">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-widest text-zinc-400 mb-1">
                  Step 4 of 4
                </p>
                <h2 className="text-2xl font-semibold text-zinc-900">
                  Review & deploy
                </h2>
                <p className="text-sm text-zinc-500 mt-1">
                  Review everything before it goes on-chain. This cannot be
                  undone.
                </p>
              </div>

              {/* Round summary */}
              <div className="border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-3.5 bg-zinc-50 border-b border-zinc-200">
                  <p className="text-[11px] font-mono text-zinc-400 uppercase tracking-wide">
                    Round
                  </p>
                </div>
                <div className="divide-y divide-zinc-100">
                  {[
                    { label: 'Name', value: name },
                    {
                      label: 'Target',
                      value: `$${Number(target).toLocaleString()} USDT`,
                    },
                    { label: 'Deadline', value: `${deadlineDays} days` },
                    { label: 'Instrument', value: instrument },
                    {
                      label: 'Val. cap',
                      value: valCap
                        ? `$${Number(valCap).toLocaleString()}`
                        : '—',
                    },
                    {
                      label: 'Discount',
                      value:
                        instrument !== 'Priced Equity' ? `${discount}%` : '—',
                    },
                    { label: 'Pro-rata', value: proRata ? 'Yes' : 'No' },
                    {
                      label: 'Accredited',
                      value: requireAccredited ? 'Required' : 'Not required',
                    },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="flex items-center justify-between px-5 py-3"
                    >
                      <span className="text-xs font-mono text-zinc-400">
                        {label}
                      </span>
                      <span className="text-sm text-zinc-900 font-medium">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Docs */}
              {Object.keys(docs).length > 0 && (
                <div className="border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="px-5 py-3.5 bg-zinc-50 border-b border-zinc-200">
                    <p className="text-[11px] font-mono text-zinc-400 uppercase tracking-wide">
                      Documents
                    </p>
                  </div>
                  <ul className="divide-y divide-zinc-100">
                    {Object.values(docs).map((doc) => (
                      <li
                        key={doc.name}
                        className="flex items-center gap-3 px-5 py-3"
                      >
                        <FileText
                          size={13}
                          className="text-[#8624FF] shrink-0"
                        />
                        <span className="text-sm text-zinc-700 flex-1 truncate">
                          {doc.name}
                        </span>
                        <span className="text-xs text-zinc-400 font-mono">
                          {doc.size}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Allocations */}
              <div className="border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-3.5 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
                  <p className="text-[11px] font-mono text-zinc-400 uppercase tracking-wide">
                    Allocations
                  </p>
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#8624FF] border border-[#8624FF]/20 bg-[#8624FF]/5 rounded-full px-2.5 py-0.5">
                    <Lock size={9} /> will be encrypted
                  </div>
                </div>
                <ul className="divide-y divide-zinc-100">
                  {validInvestors.map((inv, i) => (
                    <li
                      key={i}
                      className="px-5 py-3 flex items-center justify-between"
                    >
                      <span className="text-xs font-mono text-zinc-700">
                        {inv.address.slice(0, 10)}…{inv.address.slice(-6)}
                      </span>
                      <span className="text-xs font-mono text-zinc-500">
                        ${Number(inv.amount).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <FheCallout>
                Deploying submits one transaction to create the round, then one
                per investor to store their encrypted{' '}
                <code className="font-mono">euint64</code> allocation with a{' '}
                <code className="font-mono">TFHE.allow</code> ACL grant.
              </FheCallout>

              <div className="flex gap-3">
                <GhostBtn onClick={() => setStep('investors')}>
                  <ArrowLeft size={14} /> Edit
                </GhostBtn>
                <button
                  onClick={createRound}
                  disabled={isPending}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#8624FF] text-white text-sm font-medium rounded-xl px-6 py-2.5 shadow-[0_0_24px_rgba(134,36,255,0.25)] hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isPending ? (
                    <>
                      <span className="w-3.5 h-3.5 border border-white/30 border-t-white rounded-full animate-spin" />{' '}
                      Deploying…
                    </>
                  ) : (
                    <>
                      <Lock size={14} /> Deploy round
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
