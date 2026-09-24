import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  meta?: { label: string; tone: NonNullable<BadgeProps["variant"]> } | null;
  label?: string;
  dot?: boolean;
  className?: string;
}

export function StatusBadge({ meta, label, dot = true, className }: StatusBadgeProps) {
  const text = label ?? meta?.label ?? "—";
  return (
    <Badge variant={meta?.tone ?? "secondary"} className={cn("gap-1.5 font-normal", className)}>
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden="true" /> : null}
      {text}
    </Badge>
  );
}