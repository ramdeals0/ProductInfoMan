import { RefreshIcon, ShieldIcon, TruckIcon } from "@/components/icons/Icons";

const BADGES = [
  {
    icon: TruckIcon,
    title: "Free shipping",
    description: "On orders over $75",
  },
  {
    icon: RefreshIcon,
    title: "Easy returns",
    description: "30-day hassle-free",
  },
  {
    icon: ShieldIcon,
    title: "Secure checkout",
    description: "Encrypted payments",
  },
] as const;

export function TrustBadges({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={
        compact
          ? "grid gap-4 sm:grid-cols-3"
          : "grid gap-6 rounded-2xl border border-brand-100 bg-surface-card p-6 sm:grid-cols-3"
      }
    >
      {BADGES.map((badge) => (
        <div key={badge.title} className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <badge.icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-brand-900">{badge.title}</p>
            <p className="text-sm text-brand-500">{badge.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
