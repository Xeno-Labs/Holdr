import { RoundStatus } from "@/lib/contracts";

const MAP: Record<
  RoundStatus,
  { label: string; cls: string }
> = {
  [RoundStatus.DRAFT]:     { label: "Draft",     cls: "bg-chip text-chip-text"         },
  [RoundStatus.OPEN]:      { label: "Open",      cls: "bg-accent-dim text-accent-text"  },
  [RoundStatus.CLOSED]:    { label: "Closed",    cls: "bg-chip text-muted"              },
  [RoundStatus.CANCELLED]: { label: "Cancelled", cls: "bg-red-50 text-destructive"      },
};

export function StatusBadge({ status }: { status: RoundStatus }) {
  const { label, cls } = MAP[status] ?? MAP[RoundStatus.DRAFT];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium font-mono ${cls}`}>
      {label}
    </span>
  );
}
