import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { Providers } from "@/lib/providers";
import { LandingBackdrop } from "@/components/LandingBackdrop";
import { Nav } from "@/components/Nav";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const instrumentSerif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-instrument-serif",
});

export const metadata: Metadata = {
  title: "Holdr — Encrypted Capital Markets",
  description: "Private fundraises and cap tables encrypted on-chain by default. Powered by Zama FHE.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${instrumentSerif.variable} antialiased min-h-screen flex flex-col selection:bg-[#8624FF]/20 selection:text-[#8624FF]`}
      >
        <Providers>
          <LandingBackdrop />
          <div className="relative z-10 flex min-h-screen flex-1 flex-col">
            <Nav />
            <main className="flex min-h-0 flex-1 flex-col">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
