import { createConfig, http } from "wagmi";
import { hardhat, sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

const sepoliaRpc =
  process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
  "https://eth-sepolia.g.alchemy.com/v2/E_dlIDN3pFe5kVq7I-Jr-Y8jraQXzcaw";

export const config = createConfig({
  chains: [sepolia, hardhat],
  connectors: [injected()],
  transports: {
    [sepolia.id]:  http(sepoliaRpc),
    [hardhat.id]:  http("http://127.0.0.1:8545"),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
