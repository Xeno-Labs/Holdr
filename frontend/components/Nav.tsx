"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "./ConnectButton";

export function Nav() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  const links = [
    { href: "/rounds", label: "Rounds" },
    { href: "/founder/new", label: "Create" },
    { href: "/portfolio", label: "Portfolio" },
  ];

  if (isHome) {
    return (
      <header className="relative z-50 flex w-full justify-center bg-transparent px-6 pb-6 pt-6">
        <nav className="flex w-full max-w-7xl items-center justify-between">
          <Link
            href="/"
            className="cursor-pointer text-xl font-medium tracking-tighter text-zinc-900"
          >
            holdr
          </Link>

          <div className="hidden items-center gap-8 text-sm font-normal text-zinc-600 md:flex">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="transition-colors duration-200 hover:text-zinc-900"
              >
                {label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <ConnectButton variant="minimal" />
          </div>
        </nav>
      </header>
    );
  }

  return (
    <nav className="flex h-[60px] items-center gap-8 border-b border-border px-6">
      <Link
        href="/"
        className="shrink-0 font-mono text-sm font-semibold tracking-tight text-foreground"
      >
        holdr
      </Link>

      <div className="hidden flex-1 items-center gap-6 md:flex">
        {[{ href: "/", label: "Home" }, ...links].map(({ href, label }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`text-sm transition-colors ${
                active
                  ? "font-medium text-foreground"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>

      <div className="ml-auto">
        <ConnectButton />
      </div>
    </nav>
  );
}
