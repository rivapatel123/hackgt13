import { CATEGORIES, type CategoryKey, type Urgency } from "@/app/lib/data";

export function CategoryDot({
  category,
  className = "",
}: {
  category: CategoryKey;
  className?: string;
}) {
  const c = CATEGORIES[category];
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-2.5 shrink-0 rounded-full bg-[var(--c)] dark:bg-[var(--cd)] ${className}`}
      style={{ ["--c" as string]: c.color, ["--cd" as string]: c.darkColor }}
    />
  );
}

export function CategoryBadge({ category }: { category: CategoryKey }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-0.5 text-xs font-semibold text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">
      <CategoryDot category={category} />
      {CATEGORIES[category].label}
    </span>
  );
}

const URGENCY_STYLE: Record<Urgency, string> = {
  high: "bg-red-600 text-white",
  medium:
    "bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100",
  low: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${URGENCY_STYLE[urgency]}`}
    >
      {urgency === "high" ? "Urgent" : urgency === "medium" ? "Medium" : "Low"}
    </span>
  );
}
