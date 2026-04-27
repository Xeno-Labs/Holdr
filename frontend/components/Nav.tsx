"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "./ConnectButton";

export function Nav() {
  const pathname = usePathname();

  const links = [
    { href: "/",            label: "Home"      },
    { href: "/rounds",      label: "Rounds"    },
    { href: "/founder/new", label: "Create"    },
    { href: "/portfolio",   label: "Portfolio" },
  ];

  return (
    <nav className="h-[60px] border-b border-border flex items-center px-6 gap-8">
      {/* Logo */}
      <Link href="/" className="font-mono text-sm font-semibold tracking-tight text-foreground shrink-0">
        vestr
      </Link>

      {/* Links */}
      <div className="hidden md:flex items-center gap-6 flex-1">
        {links.map(({ href, label }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`text-sm transition-colors ${
                active
                  ? "text-foreground font-medium"
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
