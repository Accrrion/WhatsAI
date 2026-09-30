import * as React from "react";
import { Bot, User, Send, Sparkles, AlertTriangle, Database, FileText, Clock, Truck, Package } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/api";
import { useApp } from "@/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { PageHeader, AiModeBadge } from "../shared";

type Turn = { role: "user" | "assistant"; text: string; meta?: { intent?: string; mode?: string; sources?: any[]; handoff?: boolean; aiError?: string | null } };

const SUGGESTIONS = [
  "How much is the black hoodie?",
  "Do you deliver to Abuja?",
  "What are your opening hours?",
  "Can I return an item?",
  "I want to speak to a human",
];

const SOURCE_ICON: Record<string, any> = { products: Package, faq: FileText, policy: FileText, hours: Clock, delivery: Truck, business: Database };

export default function TestAssistant() {
  const { data } = useApp();
  const provider = data?.aiProvider;
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const send = async (text: string) => {
    const msg = text.trim();
    if (!msg || busy) return;
    setBusy(true);
    setInput("");
    const history = turns.map((t) => ({ role: t.role === "user" ? "user" : "assistant", content: t.text }));
    setTurns((prev) => [...prev, { role: "user", text: msg }]);
    try {
      const r: any = await api.aiTest(msg, history);
      setTurns((prev) => [...prev, { role: "assistant", text: r.reply, meta: { intent: r.intent, mode: r.mode, sources: r.sources || [], handoff: r.handoff, aiError: r.aiError } }]);
    } catch { toast.error("Test failed"); setTurns((prev) => [...prev, { role: "assistant", text: "Sorry, something went wrong running that test.", meta: { aiError: "request_failed" } }]); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Test assistant" description="Try your AI exactly as a customer would. See the reply, detected intent and the sources it used.">
        <AiModeBadge provider={provider} />
      </PageHeader>

      {!provider?.configured && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <div className="text-sm">
              <p className="font-medium">Running on the built-in rule-based engine.</p>
              <p className="text-muted-foreground">Add an <span className="font-mono text-xs">AI_API_KEY</span> in Sites Settings to enable live LLM responses. Grounded retrieval still answers from your real products, FAQs, policies and hours.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <Card className="flex min-h-[28rem] flex-col">
          <CardHeader className="flex-row items-center gap-2"><Bot className="size-4 text-brand" /><CardTitle className="text-base">{data?.aiConfig?.assistant_name || "Assistant"} · sandbox</CardTitle></CardHeader>
          <ScrollArea className="flex-1">
            <CardContent className="space-y-3">
              {turns.length === 0 && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  <Sparkles className="mx-auto mb-2 size-6 text-brand" />
                  Send a message to see how your assistant replies.
                </div>
              )}
              {turns.map((t, i) => (
                <div key={i} className={cn("flex gap-2", t.role === "user" ? "justify-end" : "justify-start")}>
                  {t.role === "assistant" && <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand/15 text-brand"><Bot className="size-4" /></span>}
                  <div className={cn("max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm", t.role === "user" ? "rounded-br-sm bg-brand text-brand-foreground" : "rounded-bl-sm bg-muted")}>
                    <p className="whitespace-pre-wrap leading-relaxed">{t.text}</p>
                    {t.meta && (
                      <div className="mt-2 space-y-1.5 border-t border-border/40 pt-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {t.meta.intent && <Badge variant="outline" className="border-transparent bg-violet-500/15 text-[10px] text-violet-700 dark:text-violet-300">intent: {t.meta.intent}</Badge>}
                          {t.meta.mode && <Badge variant="outline" className="border-transparent bg-muted text-[10px] text-muted-foreground">{t.meta.mode}</Badge>}
                          {t.meta.handoff && <Badge variant="outline" className="border-transparent bg-amber-500/15 text-[10px] text-amber-700 dark:text-amber-300">handoff</Badge>}
                        </div>
                        {t.meta.sources && t.meta.sources.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {t.meta.sources.map((s: any, j: number) => { const Icon = SOURCE_ICON[s.type] || Database; return (
                              <span key={j} className="inline-flex items-center gap-1 rounded-md bg-background/60 px-1.5 py-0.5 text-[10px] text-muted-foreground"><Icon className="size-3" />{s.ref || s.type}</span>
                            ); })}
                          </div>
                        )}
                        {t.meta.aiError && <p className="text-[10px] text-rose-600">AI error: {t.meta.aiError} (fell back to retrieval)</p>}
                      </div>
                    )}
                  </div>
                  {t.role === "user" && <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted"><User className="size-4" /></span>}
                </div>
              ))}
              {busy && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Bot className="size-4 text-brand" />Thinking…</div>}
            </CardContent>
          </ScrollArea>
          <div className="border-t p-3">
            <div className="flex items-end gap-2">
              <Textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }} placeholder="Type a customer message…" rows={1} className="max-h-28 min-h-9 flex-1 resize-none" />
              <Button onClick={() => send(input)} disabled={busy || !input.trim()}><Send className="size-4" /></Button>
            </div>
          </div>
        </Card>

        <div className="space-y-3">
          <Card>
            <CardHeader><CardTitle className="text-sm">Try these</CardTitle></CardHeader>
            <CardContent className="space-y-1.5">
              {SUGGESTIONS.map((s) => <Button key={s} variant="outline" size="sm" className="h-auto w-full justify-start whitespace-normal py-1.5 text-left text-xs" onClick={() => send(s)}>{s}</Button>)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Grounding rules</CardTitle></CardHeader>
            <CardContent className="space-y-1.5 text-xs text-muted-foreground">
              <p>• Never invents prices, stock or delivery times.</p>
              <p>• Only claims an order/payment when the backend confirms it.</p>
              <p>• Says when it doesn't know and escalates.</p>
              <Separator />
              <p className="italic">Fallback: "{data?.aiConfig?.fallback_message || "Let me connect you with a member of our team who can help with that."}"</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
