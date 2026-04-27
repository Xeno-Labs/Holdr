"use client";

import { useParams } from "next/navigation";
import { useAccount, usePublicClient, useSignTypedData } from "wagmi";
import { useState } from "react";
import { useRound, useInvestors } from "@/lib/hooks/useRound";
import { ADDRESSES, ALLOCATIONS_ABI } from "@/lib/contracts";
import { decryptHandle } from "@/lib/fhe";
import { PublicView } from "@/components/CapTable/PublicView";
import { InvestorView } from "@/components/CapTable/InvestorView";
import { FounderView } from "@/components/CapTable/FounderView";
import { useReadContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";

type ViewTab = "public" | "investor" | "founder";

export default function RoundPage() {
  const { id } = useParams<{ id: string }>();
  const roundId = id ? BigInt(id) : undefined;

  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { signTypedDataAsync } = useSignTypedData();
  const qc = useQueryClient();

  const { round, isLoading } = useRound(roundId);
  const { investors } = useInvestors(roundId);

  // Detect the user's role
  const isFounder  = !!round && !!address && round.founder.toLowerCase() === address.toLowerCase();
  const isInvestor = !!address && investors.includes(address);

  const [activeTab, setActiveTab] = useState<ViewTab>("public");
  const [decryptedAmount, setDecryptedAmount] = useState<bigint | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);

  // Encrypted handle for this investor's allocation
  const { data: allocHandle } = useReadContract({
    address:      ADDRESSES.Allocations,
    abi:          ALLOCATIONS_ABI,
    functionName: "getAllocation",
    args:         roundId !== undefined && address ? [roundId, address] : undefined,
    query:        { enabled: !!isInvestor },
  });

  async function handleDecrypt() {
    if (!allocHandle || !address || !publicClient) return;
    setIsDecrypting(true);
    try {
      const amount = await decryptHandle(
        allocHandle as `0x${string}`,
        ADDRESSES.Allocations,
        publicClient,
        address,
        signTypedDataAsync,
      );
      setDecryptedAmount(amount);
    } catch (e) {
      console.error("Decryption failed:", e);
    } finally {
      setIsDecrypting(false);
    }
  }

  function refetch() {
    qc.invalidateQueries();
  }

  if (isLoading || !round) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="space-y-4">
          <div className="skeleton h-8 w-48" />
          <div className="skeleton h-4 w-64" />
          <div className="skeleton h-32 w-full" />
        </div>
      </div>
    );
  }

  const tabs: { id: ViewTab; label: string; visible: boolean }[] = [
    { id: "public",   label: "Public",   visible: true        },
    { id: "investor", label: "Investor", visible: isInvestor  },
    { id: "founder",  label: "Founder",  visible: isFounder   },
  ];

  const visibleTabs = tabs.filter((t) => t.visible);

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 animate-fade-up">
      {/* Tab bar */}
      {visibleTabs.length > 1 && (
        <div className="flex gap-1 mb-8 border border-border rounded-xl p-1 w-fit bg-surface">
          {visibleTabs.map(({ id: tid, label }) => (
            <button
              key={tid}
              onClick={() => setActiveTab(tid)}
              className={`text-sm px-4 py-1.5 rounded-lg transition-all ${
                activeTab === tid
                  ? "bg-background text-foreground shadow-sm font-medium"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Views */}
      {activeTab === "public" && (
        <PublicView round={round} investorCount={investors.length} />
      )}

      {activeTab === "investor" && isInvestor && (
        <InvestorView
          round={round}
          decryptedAmount={decryptedAmount}
          isDecrypting={isDecrypting}
          onDecrypt={handleDecrypt}
        />
      )}

      {activeTab === "founder" && isFounder && (
        <FounderView round={round} investors={investors} refetch={refetch} />
      )}

      {/* Wallet prompt */}
      {!isConnected && activeTab !== "public" && (
        <div className="text-center py-12 text-sm text-muted">
          Connect your wallet to see your role-based view.
        </div>
      )}
    </div>
  );
}
