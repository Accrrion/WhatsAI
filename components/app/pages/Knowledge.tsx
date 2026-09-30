import * as React from "react";
import { BookOpen, Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { api, type Faq, type Hour, type Policy } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, EmptyState, LoadingRows, Field } from "../shared";

const POLICY_KINDS = [
  { kind: "delivery", label: "Delivery" },
  { kind: "returns", label: "Returns" },
  { kind: "refunds", label: "Refunds" },
  { kind: "exchanges", label: "Exchanges" },
  { kind: "payments", label: "Payments" },
  { kind: "cancellations", label: "Cancellations" },
];
const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

export default function Knowledge() {
  // FAQs
  const [faqs, setFaqs] = React.useState<Faq[] | null>(null);
  const [faqDraft, setFaqDraft] = React.useState<{ id?: string; question: string; answer: string } | null>(null);
  // Policies
  const [policies, setPolicies] = React.useState<Record<string, string> | null>(null);
  // Hours
  const [hours, setHours] = React.useState<Hour[] | null>(null);

  React.useEffect(() => {
    api.listFaqs().then((r) => setFaqs(r.items)).catch(() => setFaqs([]));
    api.getPolicies().then((r) => { const m: Record<string, string> = {}; for (const p of r.policies) m[p.kind] = p.body || ""; setPolicies(m); }).catch(() => setPolicies({}));
    api.getHours().then((r) => {
      const byDay = new Map(r.hours.map((h) => [h.day, h]));
      setHours(DAYS.map((d) => byDay.get(d) || { day: d, is_open: d !== "sunday", open_time: "09:00", close_time: "18:00" }));
    }).catch(() => setHours(DAYS.map((d) => ({ day: d, is_open: d !== "sunday", open_time: "09:00", close_time: "18:00" }))));
  }, []);

  const saveFaq = async () => {
    if (!faqDraft?.question.trim() || !faqDraft.answer.trim()) { toast.error("Question and answer required"); return; }
    try { await api.saveFaq(faqDraft); setFaqDraft(null); const r = await api.listFaqs(); setFaqs(r.items); toast.success("FAQ saved"); }
    catch { toast.error("Could not save FAQ"); }
  };
  const deleteFaq = async (id: string) => {
    try { await api.deleteFaq(id); const r = await api.listFaqs(); setFaqs(r.items); toast.success("FAQ deleted"); }
    catch { toast.error("Could not delete FAQ"); }
  };
  const savePolicies = async () => {
    if (!policies) return;
    try { await api.savePolicies(POLICY_KINDS.map((p) => ({ kind: p.kind, body: policies[p.kind] || "" }))); toast.success("Policies saved"); }
    catch { toast.error("Could not save policies"); }
  };
  const saveHours = async () => {
    if (!hours) return;
    try { await api.setHours(hours); toast.success("Opening hours saved"); }
    catch { toast.error("Could not save hours"); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Knowledge base" description="Teach the AI about your business. Answers are grounded only in what you enter here." />
      <Tabs defaultValue="faqs">
        <TabsList><TabsTrigger value="faqs">FAQs</TabsTrigger><TabsTrigger value="policies">Policies</TabsTrigger><TabsTrigger value="hours">Opening hours</TabsTrigger></TabsList>

        <TabsContent value="faqs" className="mt-4 space-y-3">
          <div className="flex justify-end"><Button size="sm" onClick={() => setFaqDraft({ question: "", answer: "" })}><Plus className="size-4" />Add FAQ</Button></div>
          {faqDraft && (
            <Card><CardContent className="space-y-3 p-4">
              <Field label="Question"><Input value={faqDraft.question} onChange={(e) => setFaqDraft({ ...faqDraft, question: e.target.value })} placeholder="Do you deliver outside Lagos?" /></Field>
              <Field label="Answer"><Textarea rows={3} value={faqDraft.answer} onChange={(e) => setFaqDraft({ ...faqDraft, answer: e.target.value })} /></Field>
              <div className="flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => setFaqDraft(null)}>Cancel</Button><Button size="sm" onClick={saveFaq}>Save FAQ</Button></div>
            </CardContent></Card>
          )}
          {faqs === null ? <LoadingRows rows={4} /> : faqs.length === 0 && !faqDraft ? (
            <EmptyState icon={BookOpen} title="No FAQs yet" description="Add common questions so the AI can answer them consistently." />
          ) : (
            <div className="space-y-2">
              {faqs.map((f) => (
                <Card key={f.id}><CardContent className="flex items-start gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{f.question}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{f.answer}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setFaqDraft({ id: f.id, question: f.question, answer: f.answer })}><Save className="size-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteFaq(f.id)}><Trash2 className="size-3.5 text-rose-600" /></Button>
                  </div>
                </CardContent></Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="policies" className="mt-4 space-y-3">
          {policies === null ? <LoadingRows rows={4} /> : (
            <>
              {POLICY_KINDS.map((p) => (
                <Field key={p.kind} label={p.label}>
                  <Textarea rows={2} value={policies[p.kind] || ""} onChange={(e) => setPolicies({ ...policies, [p.kind]: e.target.value })} placeholder={`${p.label} policy…`} />
                </Field>
              ))}
              <div className="flex justify-end"><Button onClick={savePolicies}><Save className="size-4" />Save policies</Button></div>
            </>
          )}
        </TabsContent>

        <TabsContent value="hours" className="mt-4 space-y-3">
          {hours === null ? <LoadingRows rows={4} /> : (
            <>
              <Card><CardContent className="divide-y p-0">
                {hours.map((h, i) => (
                  <div key={h.day} className="flex items-center gap-3 p-3">
                    <span className="w-24 capitalize">{h.day}</span>
                    <Switch checked={h.is_open} onCheckedChange={(v) => { const next = [...hours]; next[i] = { ...h, is_open: v }; setHours(next); }} />
                    {h.is_open ? (
                      <div className="flex items-center gap-2">
                        <Input type="time" className="w-32" value={h.open_time || ""} onChange={(e) => { const next = [...hours]; next[i] = { ...h, open_time: e.target.value }; setHours(next); }} />
                        <span className="text-muted-foreground">–</span>
                        <Input type="time" className="w-32" value={h.close_time || ""} onChange={(e) => { const next = [...hours]; next[i] = { ...h, close_time: e.target.value }; setHours(next); }} />
                      </div>
                    ) : <span className="text-sm text-muted-foreground">Closed</span>}
                  </div>
                ))}
              </CardContent></Card>
              <div className="flex justify-end"><Button onClick={saveHours}><Save className="size-4" />Save hours</Button></div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
