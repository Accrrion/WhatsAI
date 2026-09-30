import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty";

export function PageHeader({ title, description, children, className }: { title: string; description?: string; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}

export function StatCard({ label, value, sub, icon: Icon, tone = "default" }: { label: string; value: React.ReactNode; sub?: string; icon?: React.ComponentType<{ className?: string }>; tone?: "default" | "brand" | "warn" }) {
  return (
    <Card className="gap-0 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
          {sub && <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>}
        </div>
        {Icon && (
          <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg",
            tone === "brand" ? "bg-brand/15 text-brand" : tone === "warn" ? "bg-amber-500/15 text-amber-600" : "bg-muted text-muted-foreground")}>
            <Icon className="size-4.5" />
          </span>
        )}
      </div>
    </Card>
  );
}

const STATUS_TONES: Record<string, string> = {
  open: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-transparent",
  human_handoff: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-transparent",
  resolved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-transparent",
  new: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-transparent",
  contacted: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-transparent",
  qualified: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-transparent",
  converted: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-transparent",
  lost: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-transparent",
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-transparent",
  confirmed: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-transparent",
  processing: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-transparent",
  shipped: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-transparent",
  delivered: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-transparent",
  cancelled: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-transparent",
  in_stock: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-transparent",
  low_stock: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-transparent",
  out_of_stock: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-transparent",
  preorder: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-transparent",
  connected: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-transparent",
  connecting: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-transparent",
  not_connected: "bg-muted text-muted-foreground border-transparent",
  disconnected: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-transparent",
  error: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-transparent",
  paid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-transparent",
  unpaid: "bg-muted text-muted-foreground border-transparent",
  failed: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-transparent",
  refunded: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-transparent",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <Badge variant="outline" className={cn("font-medium capitalize", STATUS_TONES[status] || "bg-muted text-muted-foreground border-transparent")}>{label || status.replace(/_/g, " ")}</Badge>;
}

export function ModeBadge({ mode }: { mode: string }) {
  if (mode === "demo") return <Badge variant="outline" className="border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300">Demo data</Badge>;
  if (mode === "live") return <Badge variant="outline" className="border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">Live</Badge>;
  return null;
}

export function AiModeBadge({ provider }: { provider?: { configured: boolean; model: string } }) {
  if (!provider) return null;
  return provider.configured
    ? <Badge variant="outline" className="border-transparent bg-violet-500/15 text-violet-700 dark:text-violet-300">AI: {provider.model}</Badge>
    : <Badge variant="outline" className="border-transparent bg-muted text-muted-foreground">AI: rule-based demo</Badge>;
}

export function LoadingRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return <div className={cn("space-y-2", className)}>{Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>;
}

export function EmptyState({ title, description, action, icon: Icon }: { title: string; description?: string; action?: React.ReactNode; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <Empty className="border border-dashed py-12">
      <EmptyHeader>
        {Icon && <div className="grid size-11 place-items-center rounded-xl bg-muted text-muted-foreground"><Icon className="size-5" /></div>}
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="text-sm font-medium">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
