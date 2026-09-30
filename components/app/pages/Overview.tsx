import * as React from "react";
import { MessagesSquare, Bot, UserRound, Target, ShoppingCart, AlertCircle, ArrowRight, CheckCircle2, Smartphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api, type Conversation } from "@/api";
import { useApp } from "@/store";
import { formatMoney, relativeTime } from "@/lib/config";
import { PageHeader, StatCard, StatusBadge, EmptyState, LoadingRows } from "../shared";

export default function Overview() {
  const { data, setRoute, refresh } = useApp();
  const counts = data?.counts || {};
  const business = data?.business!;
  const currency = business?.currency || "NGN";
  const [convs, setConvs] = React.useState<Conversation[] | null>(null);

  React.useEffect(() => { api.listConversations().then((r) => setConvs(r.items.slice(0, 6))).catch(() => setConvs([])); }, []);

  const step = business?.onboarding_step || 0;
  const checklist = [
    { label: "Add your products & prices", done: step >= 4, go: "products" as const },
    { label: "Add FAQs, policies & hours", done: step >= 7, go: "knowledge" as const },
    { label: "Configure your AI assistant", done: step >= 8, go: "assistant" as const },
    { label: "Connect WhatsApp", done: step >= 9, go: "whatsapp" as const },
    { label: "Test & activate", done: step >= 11, go: "assistant" as const },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title={`Welcome back${business?.name ? ` — ${business.name}` : ""}`} description="Here's what's happening across your WhatsApp assistant.">
        <Button variant="outline" onClick={() => setRoute("conversations")}>Open inbox <ArrowRight /></Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Conversations today" value={counts.conversationsToday ?? 0} icon={MessagesSquare} />
        <StatCard label="AI responses today" value={counts.aiResponsesToday ?? 0} icon={Bot} tone="brand" />
        <StatCard label="Human handoffs" value={counts.humanHandoffs ?? 0} icon={UserRound} tone="warn" />
        <StatCard label="Open now" value={counts.unresolved ?? 0} icon={AlertCircle} />
        <StatCard label="Leads" value={counts.leads ?? 0} icon={Target} />
        <StatCard label="Orders" value={counts.orders ?? 0} icon={ShoppingCart} />
        <StatCard label="Revenue (paid)" value={formatMoney(counts.revenueMinor ?? 0, currency)} icon={CheckCircle2} tone="brand" />
        <StatCard label="Assistant" value={data?.aiConfig?.is_active ? "Active" : "Paused"} sub={data?.aiConfig?.assistant_name} icon={Smartphone} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Recent conversations</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setRoute("conversations")}>View all <ArrowRight /></Button>
          </CardHeader>
          <CardContent>
            {convs === null ? <LoadingRows rows={4} /> : convs.length === 0 ? (
              <EmptyState icon={MessagesSquare} title="No conversations yet" description="Once customers message you on WhatsApp, they'll appear here." action={<Button onClick={() => setRoute("whatsapp")} variant="outline">Connect WhatsApp</Button>} />
            ) : (
              <ul className="divide-y">
                {convs.map((c) => (
                  <li key={c.id}>
                    <button onClick={() => { refresh(); setRoute("conversations"); }} className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-muted/50">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium">{(c.customer?.name || "?").slice(0, 1).toUpperCase()}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{c.customer?.name || "Unknown"}</span>
                          {c.mode === "ai" ? <Badge variant="outline" className="border-transparent bg-violet-500/15 px-1.5 text-[10px] text-violet-700 dark:text-violet-300">AI</Badge> : <Badge variant="outline" className="border-transparent bg-amber-500/15 px-1.5 text-[10px] text-amber-700 dark:text-amber-300">Human</Badge>}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">{c.last_message}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {c.unread > 0 && <span className="grid size-5 place-items-center rounded-full bg-brand text-[10px] font-semibold text-brand-foreground">{c.unread}</span>}
                        <span className="text-xs text-muted-foreground">{relativeTime(c.last_message_at)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Setup progress</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {checklist.map((item) => (
              <button key={item.label} onClick={() => setRoute(item.go)} className="flex w-full items-center gap-2.5 rounded-lg border p-2.5 text-left text-sm transition-colors hover:bg-muted/60">
                {item.done ? <CheckCircle2 className="size-4 shrink-0 text-emerald-600" /> : <span className="size-4 shrink-0 rounded-full border-2 border-muted-foreground/40" />}
                <span className={item.done ? "text-muted-foreground line-through" : ""}>{item.label}</span>
                <ArrowRight className="ml-auto size-4 text-muted-foreground" />
              </button>
            ))}
            <p className="pt-1 text-xs text-muted-foreground">Step {Math.min(step, 11)} of 11</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
