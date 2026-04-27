import Link from "next/link";
import { ShieldCheck, Lock, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="relative overflow-hidden">
      {/* Dot-grid hero */}
      <div className="absolute inset-0 dot-grid pointer-events-none" />

      {/* Hero */}
      <section className="relative flex flex-col items-center text-center px-6 pt-28 pb-20">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-background text-xs text-muted font-mono mb-8 animate-fade-in">
          <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block" />
          Powered by FHEVM · Zama
        </div>

        <h1 className="text-5xl md:text-6xl font-semibold tracking-tight text-foreground max-w-2xl animate-fade-up">
          Private fundraises.<br />
          <span className="text-muted font-normal">On-chain.</span>
        </h1>

        <p className="mt-6 text-muted text-lg max-w-lg leading-relaxed animate-fade-up" style={{ animationDelay: "60ms" }}>
          Vestr uses Fully Homomorphic Encryption to keep allocation amounts
          and cap-table data encrypted end-to-end — even from the blockchain.
        </p>

        <div className="mt-10 flex items-center gap-3 animate-fade-up" style={{ animationDelay: "120ms" }}>
          <Link
            href="/founder/new"
            className="flex items-center gap-2 bg-foreground text-background text-sm font-medium rounded-xl px-5 py-2.5 hover:opacity-80 transition-opacity"
          >
            Start a round <ArrowRight size={15} />
          </Link>
          <Link
            href="/rounds"
            className="text-sm text-muted hover:text-foreground border border-border rounded-xl px-5 py-2.5 transition-colors hover:bg-surface"
          >
            Browse rounds
          </Link>
        </div>
      </section>

      {/* Feature cards */}
      <section className="relative max-w-4xl mx-auto px-6 pb-24 grid md:grid-cols-3 gap-4">
        {[
          {
            icon: <Lock size={18} className="text-accent" />,
            title: "Encrypted allocations",
            body: "Investor amounts are stored as FHE ciphertexts. Founders see totals, investors see only their slice.",
          },
          {
            icon: <ShieldCheck size={18} className="text-accent" />,
            title: "Selective disclosure",
            body: "Share your allocation with a counterparty via an on-chain ACL grant — no screenshots, no trust.",
          },
          {
            icon: (
              <span className="font-mono text-accent text-sm font-bold">KMS</span>
            ),
            title: "Threshold decryption",
            body: "Round close uses a two-transaction KMS flow to publicly verify total capital raised.",
          },
        ].map(({ icon, title, body }) => (
          <div
            key={title}
            className="border border-border rounded-2xl p-5 bg-background hover:bg-surface transition-colors animate-fade-up"
          >
            <div className="mb-3">{icon}</div>
            <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
            <p className="text-sm text-muted leading-relaxed">{body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
