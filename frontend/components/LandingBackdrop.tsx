"use client";

import { usePathname } from "next/navigation";

/** Full-viewport treatment so the hero grid + glow continue behind the home nav. */
export function LandingBackdrop() {
  const pathname = usePathname();
  if (pathname !== "/") return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 mix-blend-normal"
    >
      <div className="absolute left-1/2 top-0 h-[520px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-[100%] bg-[#8624FF]/15 blur-[120px]" />
      <div className="landing-bg-dots landing-mask-radial absolute inset-0 opacity-70" />
    </div>
  );
}
