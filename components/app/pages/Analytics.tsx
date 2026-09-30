import * as React from "react";
import { BarChart3, MessagesSquare, Bot, UserRound, Target, ShoppingCart, TrendingUp, Percent } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar } from "recharts";
import { api } from "@/api";
import { useApp } from "@/store";
import { formatMoney, titleCase } from "@/lib/config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, StatCard, LoadingRows, EmptyState } from "../shared";

export default function Analytics() {
  const { data } = useApp();
  const currency = data?.business?.currency || "NGN";
  const [a, setA] = React.useState<any | null>(null);
  React.useEffect(() => { api.analytics().then(setA).catch(() => setA({ totals: {}, intents: [], series: [] })); }, []);

  if (a === null) return <div className="space-y-5"><PageHeader title="Analytics" /><LoadingRows rows={6} /></div>;

  const t = a.totals || {};
  const series = (a.series || []).map((s: any) => ({ ...s, label: s.day?.slice(5) }));
  const intents = (a.intents || []).map((i: any) => ({ ...i, label: titleCase(i.intent) }));

  return (
    <div className="space-y-5">
      <PageHeader title="Analytics" description="Last 30 days of assistant activity, intents and results." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Conversations" value={t.conversations ?? 0} icon={MessagesSquare} />
        <StatCard label="AI handled" value={t.aiHandled ?? 0} sub={`${t.aiMessages ?? 0} AI messages`} icon={Bot} tone="brand" />
        <StatCard label="Human handled" value={t.humanHandled ?? 0} icon={UserRound} />
        <StatCard label="Handoff rate" value={`${t.handoffRate ?? 0}%`} icon={Percent} tone="warn" />
        <StatCard label="Leads" value={t.leads ?? 0} sub={`${t.convertedLeads ?? 0} converted`} icon={Target} />
        <StatCard label="Orders" value={t.orders ?? 0} icon={ShoppingCart} />
        <StatCard label="Revenue" value={formatMoney(t.revenueMinor ?? 0, currency)} icon={TrendingUp} tone="brand" />
        <StatCard label="Est. AI cost" value={t.estimatedCostMicro ? `$${(t.estimatedCostMicro / 1e6).toFixed(4)}` : "$0.0000"} sub={t.aiInteractions ? `${t.aiInteractions} calls` : undefined} icon={BarChart3} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Conversations — last 14 days</CardTitle></CardHeader>
        <CardContent>
          {series.length === 0 ? <EmptyState icon={BarChart3} title="No activity yet" description="Charts populate as customers message you." /> : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <defs><linearGradient id="gConv" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--color-brand)" stopOpacity={0.5} /><stop offset="100%" stopColor="var(--color-brand)" stopOpacity={0.02} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "var(--foreground)" }} />
                  <Area type="monotone" dataKey="conversations" stroke="var(--color-brand)" strokeWidth={2} fill="url(#gConv)" name="Conversations" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Top customer intents</CardTitle></CardHeader>
        <CardContent>
          {intents.length === 0 ? <EmptyState icon={BarChart3} title="No intents recorded" description="Detected intents appear here." /> : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={intents} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" fill="var(--primary)" radius={[0, 6, 6, 0]} name="Count" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
