import { createConfig, http } from "wagmi";
import { hardhat, sepolia } from "wagmi/chains";
import { injected, metaMask } from "wagmi/connectors";

export const config = createConfig({
  chains: [hardhat, sepolia],
  connectors: [injected(), metaMask()],
  transports: {
    [hardhat.id]:  http("http://127.0.0.1:8545"),
    [sepolia.id]:  http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ?? ""),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
