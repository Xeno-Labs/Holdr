"use client";

import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from "wagmi";
import { hardhat, sepolia } from "wagmi/chains";
import { useState } from "react";

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [open, setOpen] = useState(false);

  const isLocal = chainId === hardhat.id;
  const isSepolia = chainId === sepolia.id;
  const knownChain = isLocal || isSepolia;

  if (isConnected && address) {
    return (
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-sm border border-border rounded-lg px-3 py-1.5 hover:bg-surface transition-colors"
        >
          <span
            className={`w-2 h-2 rounded-full ${knownChain ? "bg-accent" : "bg-destructive"}`}
          />
          <span className="font-mono text-xs">{truncate(address)}</span>
          <span className="text-muted text-xs">
            {isLocal ? "local" : isSepolia ? "sepolia" : "wrong network"}
          </span>
        </button>

        {open && (
          <div className="absolute right-0 top-10 bg-background border border-border rounded-xl shadow-lg py-1 w-44 z-50 animate-fade-in">
            {!isLocal && (
              <button
                className="w-full px-4 py-2 text-left text-sm text-muted hover:text-foreground hover:bg-surface"
                onClick={() => { switchChain({ chainId: hardhat.id }); setOpen(false); }}
              >
                Switch to Local
              </button>
            )}
            {!isSepolia && (
              <button
                className="w-full px-4 py-2 text-left text-sm text-muted hover:text-foreground hover:bg-surface"
                onClick={() => { switchChain({ chainId: sepolia.id }); setOpen(false); }}
              >
                Switch to Sepolia
              </button>
            )}
            <button
              className="w-full px-4 py-2 text-left text-sm text-destructive hover:bg-surface"
              onClick={() => { disconnect(); setOpen(false); }}
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      disabled={isPending}
      onClick={() => {
        const preferred = connectors.find((c) => c.id === "injected") ?? connectors[0];
        if (preferred) connect({ connector: preferred });
      }}
      className="text-sm bg-foreground text-background rounded-lg px-4 py-1.5 font-medium hover:opacity-80 transition-opacity disabled:opacity-50"
    >
      {isPending ? "Connecting…" : "Connect wallet"}
    </button>
  );
}
