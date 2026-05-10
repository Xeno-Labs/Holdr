import Link from 'next/link';
import { ArrowRight, ChevronRight, PlayCircle } from 'lucide-react';
import { CapTableDemo } from '@/components/landing/CapTableDemo';

const instrument = 'font-[family-name:var(--font-instrument-serif),serif]';
const inter = 'font-[family-name:var(--font-inter),sans-serif]';

export default function Home() {
  return (
    <div className="relative flex min-h-full flex-1 flex-col overflow-x-hidden text-zinc-900">
      <div className="relative flex flex-1 flex-col">
        {/* ─── Hero ─── */}
        <section
          className={`flex flex-col items-center justify-center px-6 pb-16 pt-4 text-center md:pb-20 md:pt-8 ${instrument}`}
        >
          <div className="flex w-full max-w-4xl flex-col items-center mt-8">
            <h1 className="mb-6 bg-linear-to-b from-black via-zinc-900 to-zinc-500 bg-clip-text text-5xl font-normal leading-[1.1] tracking-tight text-transparent sm:text-6xl md:text-7xl">
              <span className="block">Encrypted capital markets.</span>
              <span className="block bg-linear-to-b from-zinc-700 to-zinc-400 bg-clip-text text-transparent">
                On-chain.
              </span>
            </h1>

            <p
              className={`mb-10 max-w-2xl text-lg font-normal leading-relaxed text-zinc-600 md:text-sm ${inter}`}
            >
              Holdr uses Fully Homomorphic Encryption to put fundraise
              allocations and cap-table ownership on-chain, without exposing a
              single number to anyone who shouldn&apos;t see it. Founders see
              everything. Investors see their slice. The public sees the
              aggregate.
            </p>

            <div
              className={`flex w-full flex-col items-center gap-4 sm:w-auto sm:flex-row ${inter}`}
            >
              <Link
                href="/founder/new"
                className="flex w-full items-center justify-center gap-2 rounded-full bg-[#8624FF] px-6 py-3 text-sm font-medium text-white shadow-[0_0_24px_rgba(134,36,255,0.25)] transition-all duration-200 hover:opacity-90 active:scale-[0.98] hover:scale-[1.02] sm:w-auto"
              >
                Start a round
                <ArrowRight
                  className="size-[1.2rem] shrink-0"
                  strokeWidth={1.5}
                />
              </Link>
              <Link
                href="/rounds"
                className="flex w-full items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white/50 px-6 py-3 text-sm font-medium text-zinc-900 shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-zinc-300 hover:bg-zinc-50 sm:w-auto"
              >
                <PlayCircle
                  className="size-[1.2rem] shrink-0 text-zinc-500"
                  strokeWidth={1.5}
                />
                Browse rounds
              </Link>
            </div>

            <div className={`mt-8 ${inter}`}>
              <Link
                href="/portfolio"
                className="group flex items-center gap-1.5 text-sm font-normal text-zinc-500 transition-colors duration-200 hover:text-[#8624FF]"
              >
                View portfolio
                <ChevronRight
                  className="size-4 transition-transform duration-200 group-hover:translate-x-1"
                  strokeWidth={1.5}
                />
              </Link>
            </div>
          </div>
        </section>

        {/* ─── Demo ─── */}
        <section className="border-t border-zinc-200 bg-white px-6 pt-10 pb-20 md:px-12">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10">
              <p
                className={`mb-2 text-xs font-normal uppercase tracking-widest text-[#8624FF] ${inter}`}
              >
                Same URL. Three views.
              </p>
              <h2
                className={`text-2xl font-normal tracking-tight text-zinc-900 md:text-3xl ${instrument}`}
              >
                One link. Three different worlds.
              </h2>
              <p
                className={`mt-3 max-w-xl text-sm leading-relaxed text-zinc-600 ${inter}`}
              >
                The chain holds one ciphertext. The Zama relayer SDK decrypts
                only what each wallet has been granted permission to see — at
                read time, not write time.
              </p>
            </div>

            <CapTableDemo />

            <div
              className={`mt-4 grid gap-3 text-xs text-zinc-500 sm:grid-cols-3 ${inter}`}
            >
              <p>
                <span className="font-medium text-zinc-900">Founder</span> —
                permanent{' '}
                <code className="rounded border border-zinc-200 bg-zinc-50 px-1 font-mono">
                  TFHE.allow
                </code>{' '}
                on every allocation at round creation.
              </p>
              <p>
                <span className="font-medium text-zinc-900">Investor</span> —
                per-row{' '}
                <code className="rounded border border-zinc-200 bg-zinc-50 px-1 font-mono">
                  TFHE.allow
                </code>{' '}
                granted when the founder adds them. Their row only.
              </p>
              <p>
                <span className="font-medium text-zinc-900">Public</span> —
                aggregate decrypted via KMS after round close. Per-investor
                ciphertexts stay locked forever.
              </p>
            </div>
          </div>
        </section>

        {/* ─── Problem / Fix ─── */}
        <section className="border-t border-zinc-200 bg-zinc-50/80 py-20 px-6 md:px-12">
          <div className="mx-auto grid max-w-7xl gap-16 md:grid-cols-2 md:gap-24">
            <div>
              <p
                className={`mb-6 text-xs font-normal uppercase tracking-widest text-zinc-500 ${inter}`}
              >
                The problem
              </p>
              <h2
                className={`text-2xl font-normal leading-snug tracking-tight text-zinc-900 ${instrument}`}
              >
                Carta stays off-chain for a reason.
              </h2>
              <p
                className={`mt-4 text-sm leading-relaxed text-zinc-600 ${inter}`}
              >
                The moment allocations hit a public chain, every investor&apos;s
                check size, every employee&apos;s compensation, and every
                founder&apos;s dilution are permanently visible to anyone with a
                block explorer. That&apos;s not a regulation problem.
                That&apos;s not a tooling problem. The chain itself is the
                problem.
              </p>
              <p
                className={`mt-3 text-sm leading-relaxed text-zinc-600 ${inter}`}
              >
                ZK can prove facts about hidden data. But a cap table isn&apos;t
                one proof — it&apos;s a relational structure where different
                parties need different read access to the same underlying
                values.
              </p>
            </div>

            <div>
              <p
                className={`mb-6 text-xs font-normal uppercase tracking-widest text-[#8624FF] ${inter}`}
              >
                The fix
              </p>
              <h2
                className={`text-2xl font-normal leading-snug tracking-tight text-zinc-900 ${instrument}`}
              >
                FHE is the only primitive that works.
              </h2>
              <p
                className={`mt-4 text-sm leading-relaxed text-zinc-600 ${inter}`}
              >
                Fully Homomorphic Encryption lets the contract compute over
                encrypted values — sum allocations, validate payments, close
                rounds — without ever operating on plaintext. Access control is
                cryptographic, not application-layer. The ACL lives on-chain.{' '}
                <code className="rounded border border-zinc-200 bg-white px-1 font-mono text-xs">
                  TFHE.allow
                </code>{' '}
                is the primitive. The relayer SDK is the interface.
              </p>
              <p
                className={`mt-3 text-sm leading-relaxed text-zinc-600 ${inter}`}
              >
                Holdr is the first application to map this primitive directly to
                cap-table access semantics: founder, investor, public — three
                permission levels, one encrypted data structure.
              </p>
            </div>
          </div>
        </section>

        {/* ─── Zama / Tech ─── */}
        <section className="border-t border-zinc-200 px-6 py-20 md:px-12">
          <div className="mx-auto max-w-7xl">
            <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-950 shadow-[0_0_60px_rgba(134,36,255,0.12)]">
              <div className="grid md:grid-cols-2">
                <div className="border-b border-white/10 p-8 md:border-b-0 md:border-r md:p-12">
                  <p
                    className={`mb-6 text-xs font-normal uppercase tracking-widest text-[#c4b5fd] ${inter}`}
                  >
                    Built on Zama FHEVM
                  </p>
                  <h2
                    className={`mb-4 text-2xl font-normal leading-snug tracking-tight text-white ${instrument}`}
                  >
                    The chain computes.
                    <br />
                    It never sees.
                  </h2>
                  <p
                    className={`mb-8 text-sm leading-relaxed text-zinc-400 ${inter}`}
                  >
                    Every allocation is an{' '}
                    <code className="font-mono text-[#c4b5fd]">euint64</code>{' '}
                    ciphertext stored on Sepolia. Round close sums them using{' '}
                    <code className="font-mono text-[#c4b5fd]">TFHE.add</code> —
                    no plaintext leaves the FHE domain. The Zama KMS decrypts
                    only the aggregate, publicly. Everything else stays
                    encrypted.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'euint64', desc: 'Encrypted allocations' },
                      { label: 'TFHE.allow', desc: 'Per-viewer ACL grants' },
                      { label: 'ERC-7984', desc: 'Confidential cEquity' },
                      { label: 'Threshold KMS', desc: 'Decryption oracle' },
                    ].map(({ label, desc }) => (
                      <div
                        key={label}
                        className="rounded-xl border border-white/10 bg-white/3 p-3"
                      >
                        <code className="font-mono text-xs text-[#c4b5fd]">
                          {label}
                        </code>
                        <p className="mt-0.5 text-xs text-zinc-500">{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-8 font-mono text-xs leading-[1.8] text-zinc-400 md:p-12">
                  <p className="mb-4 text-zinc-600">{'// Allocations.sol'}</p>
                  <p>
                    <span className="text-zinc-200">struct</span> Allocation{' '}
                    {'{'}
                  </p>
                  <p className="pl-4">
                    <span className="text-[#c4b5fd]">euint64</span>{' '}
                    <span className="text-zinc-200">encAmount</span>;
                  </p>
                  <p className="pl-4">
                    <span className="text-zinc-200">bool</span> subscribed;
                  </p>
                  <p>{'}'}</p>
                  <p className="mt-6 text-zinc-600">
                    {'// addInvestor() — founder only'}
                  </p>
                  <p>
                    <span className="text-zinc-200">TFHE</span>.allow(
                  </p>
                  <p className="pl-4">alloc.encAmount, founder</p>
                  <p className="pl-4">{'// ← full table'}</p>
                  <p>);</p>
                  <p>
                    <span className="text-zinc-200">TFHE</span>.allow(
                  </p>
                  <p className="pl-4">alloc.encAmount, investor</p>
                  <p className="pl-4">{'// ← their row only'}</p>
                  <p>);</p>
                  <p className="mt-6 text-zinc-600">
                    {'// closeRound() — public KMS reveal'}
                  </p>
                  <p>
                    <span className="text-[#c4b5fd]">euint64</span> total =
                  </p>
                  <p className="pl-4">
                    <span className="text-zinc-200">TFHE</span>.add(a1, a2
                    <span className="text-zinc-600">{'/* … */'}</span>);
                  </p>
                  <p>
                    Gateway.requestDecryption(total
                    <span className="text-zinc-600">{'/* public */'}</span>);
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── CTA ─── */}
        <section className="border-t border-zinc-200 bg-white px-6 py-20 md:px-12">
          <div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 md:flex-row md:items-end">
            <div>
              <h2
                className={`text-2xl font-normal tracking-tight text-zinc-900 md:text-3xl ${instrument}`}
              >
                Raise your first confidential round.
              </h2>
              <p className={`mt-2 text-sm text-zinc-600 ${inter}`}>
                Deployed on Sepolia. FHE-native. Fully auditable aggregate.
              </p>
            </div>
            <div
              className={`flex shrink-0 flex-col items-stretch gap-3 sm:flex-row sm:items-center ${inter}`}
            >
              <Link
                href="/founder/new"
                className="flex items-center justify-center gap-2 rounded-full bg-[#8624FF] px-6 py-3 text-sm font-medium text-white shadow-[0_0_24px_rgba(134,36,255,0.25)] transition-all duration-200 hover:opacity-90"
              >
                Start a round
                <ArrowRight className="size-4" strokeWidth={1.5} />
              </Link>
              <Link
                href="/rounds"
                className="flex items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white/50 px-6 py-3 text-sm font-medium text-zinc-900 shadow-sm backdrop-blur-sm transition-all hover:border-zinc-300 hover:bg-zinc-50"
              >
                Browse rounds
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
