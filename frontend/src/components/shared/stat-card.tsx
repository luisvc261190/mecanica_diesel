import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type StatTone = "default" | "primary" | "success" | "warning" | "destructive" | "info";

const toneStyles: Record<StatTone, string> = {
  default: "text-foreground",
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
  info: "text-info",
};

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  tone?: StatTone;
  hint?: string;
  icon?: React.ReactNode;
  loading?: boolean;
  className?: string;
}

export function StatCard({ label, value, tone = "default", hint, icon, loading, className }: StatCardProps) {
  return (
    <div className={cn("rounded-lg border bg-card p-4 shadow-sm", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        {icon ? <div className="text-muted-foreground [&_svg]:size-4">{icon}</div> : null}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-16" />
      ) : (
        <p className={cn("mt-1.5 text-2xl font-semibold tracking-tight tabular", toneStyles[tone])}>{value}</p>
      )}
      {hint && !loading ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}