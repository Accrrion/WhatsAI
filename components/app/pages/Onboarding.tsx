import * as React from "react";
import { MessagesSquare, ArrowRight, ArrowLeft, Check, Plus, Trash2, Bot, Smartphone, Sparkles, Building2, Clock, Package, BookOpen, FileText, Send } from "lucide-react";
import { toast } from "sonner";
import { api, type Hour, type Product, type Faq } from "@/api";
import { useApp } from "@/store";
import { BRAND, titleCase, formatMoney, STOCK_LABELS } from "@/lib/config";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "../shared";

const TYPES = ["fashion", "restaurant", "salon", "barber", "beauty", "electronics", "retail", "services", "real_estate", "other"];
const CURRENCIES = ["NGN", "USD", "GBP", "EUR", "GHS", "KES"];
const TONES = ["professional", "friendly", "casual", "luxury", "energetic"];
const LANGS = [{ v: "en", l: "English" }, { v: "pcm", l: "Nigerian Pidgin" }, { v: "yo", l: "Yoruba" }, { v: "ig", l: "Igbo" }, { v: "ha", l: "Hausa" }];
const LENGTHS = ["short", "medium", "detailed"];
const HANDOFF = [{ v: "on_request", l: "When the customer asks" }, { v: "on_unknown", l: "When it doesn't know" }, { v: "always", l: "Always" }, { v: "never", l: "Never" }];
const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const POLICY_KINDS = [{ kind: "delivery", label: "Delivery" }, { kind: "returns", label: "Returns" }, { kind: "refunds", label: "Refunds" }];
const TOTAL = 11;

export default function Onboarding() {
  const { data, refresh, setRoute } = useApp();
  const business = data?.business;
  const [step, setStep] = React.useState(business ? Math.min(business.onboarding_step || 1, TOTAL) : 1);
  const [busy, setBusy] = React.useState(false);

  // step 1
  const [s1, setS1] = React.useState({ name: business?.name || "", business_type: business?.business_type || "retail" });
  // step 2
  const [s2, setS2] = React.useState({ description: business?.description || "", location: business?.location || "", phone: business?.phone || "", email: business?.email || "", website: business?.website || "", currency: business?.currency || "NGN" });
  // step 3 hours
  const [hours, setHours] = React.useState<Hour[]>(DAYS.map((d) => ({ day: d, is_open: d !== "sunday", open_time: "09:00", close_time: "18:00" })));
  // step 4 products
  const [products, setProducts] = React.useState<Product[]>([]);
  const [pForm, setPForm] = React.useState({ name: "", priceMajor: "", stock_status: "in_stock" });
  // step 5 faqs
  const [faqs, setFaqs] = React.useState<Faq[]>([]);
  const [fForm, setFForm] = React.useState({ question: "", answer: "" });
  // step 6 policies
  const [policies, setPolicies] = React.useState<Record<string, string>>({});
  // step 7 ai
  const [ai, setAi] = React.useState({ assistant_name: "Amaka", tone: "friendly", language: "en", response_length: "medium", handoff_behavior: "on_request", welcome_message: "", fallback_message: "Let me connect you with a member of our team who can help with that.", is_active: true });
  // step 8 whatsapp
  const [wa, setWa] = React.useState({ phone_number_id: "", waba_id: "", display_phone: "" });
  // step 9 test
  const [testMsg, setTestMsg] = React.useState("");
  const [testOut, setTestOut] = React.useState<any | null>(null);

  React.useEffect(() => {
    if (!business) return;
    api.getHours().then((r) => { if (r.hours?.length) { const m = new Map(r.hours.map((h) => [h.day, h])); setHours(DAYS.map((d) => m.get(d) || { day: d, is_open: d !== "sunday", open_time: "09:00", close_time: "18:00" })); } }).catch(() => {});
    api.listProducts().then((r) => setProducts(r.items)).catch(() => {});
    api.listFaqs().then((r) => setFaqs(r.items)).catch(() => {});
    api.getPolicies().then((r) => { const m: Record<string, string> = {}; for (const p of r.policies) m[p.kind] = p.body || ""; setPolicies(m); }).catch(() => {});
    api.getAiConfig().then((r: any) => { if (r.aiConfig) setAi((prev) => ({ ...prev, ...r.aiConfig })); }).catch(() => {});
    api.getWhatsapp().then((r: any) => { if (r.whatsapp) setWa({ phone_number_id: r.whatsapp.phone_number_id || "", waba_id: r.whatsapp.waba_id || "", display_phone: r.whatsapp.display_phone || "" }); }).catch(() => {});
  }, [business?.id]);

  const advance = async (to: number, onboarding_step: number) => {
    setBusy(true);
    try { await api.saveBusiness({ onboarding_step }); await refresh(); setStep(to); }
    catch { toast.error("Could not save progress"); }
    finally { setBusy(false); }
  };

  // ---- step handlers ----
  const doStep1 = async () => {
    if (!s1.name.trim()) { toast.error("Enter your business name"); return; }
    setBusy(true);
    try { await api.saveBusiness({ name: s1.name.trim(), business_type: s1.business_type, onboarding_step: 1 }); await refresh(); setStep(2); }
    catch { toast.error("Could not create business"); }
    finally { setBusy(false); }
  };
  const doStep2 = async () => { setBusy(true); try { await api.saveBusiness({ ...s2, onboarding_step: 2 }); await refresh(); setStep(3); } catch { toast.error("Could not save profile"); } finally { setBusy(false); } };
  const doStep3 = async () => { setBusy(true); try { await api.setHours(hours); await advance(4, 3); } catch { toast.error("Could not save hours"); } finally { setBusy(false); } };
  const addProduct = async () => {
    if (!pForm.name.trim()) return;
    try { const r: any = await api.createProduct({ name: pForm.name.trim(), price: pForm.priceMajor ? Number(pForm.priceMajor) : null, stock_status: pForm.stock_status, currency: s2.currency }); const list = await api.listProducts(); setProducts(list.items); setPForm({ name: "", priceMajor: "", stock_status: "in_stock" }); }
    catch { toast.error("Could not add product"); }
  };
  const delProduct = async (id: string) => { try { await api.deleteProduct(id); const list = await api.listProducts(); setProducts(list.items); } catch { toast.error("Could not delete"); } };
  const doStep4 = () => advance(5, 4);
  const addFaq = async () => {
    if (!fForm.question.trim() || !fForm.answer.trim()) return;
    try { await api.saveFaq(fForm); const list = await api.listFaqs(); setFaqs(list.items); setFForm({ question: "", answer: "" }); }
    catch { toast.error("Could not add FAQ"); }
  };
  const delFaq = async (id: string) => { try { await api.deleteFaq(id); const list = await api.listFaqs(); setFaqs(list.items); } catch { toast.error("Could not delete"); } };
  const doStep5 = () => advance(6, 5);
  const doStep6 = async () => { setBusy(true); try { await api.savePolicies(POLICY_KINDS.map((p) => ({ kind: p.kind, body: policies[p.kind] || "" }))); await advance(7, 7); } catch { toast.error("Could not save policies"); } finally { setBusy(false); } };
  const doStep7 = async () => { setBusy(true); try { await api.saveAiConfig(ai); await advance(8, 8); } catch { toast.error("Could not save assistant"); } finally { setBusy(false); } };
  const doStep8 = async () => { setBusy(true); try { await api.saveWhatsapp({ ...wa, status: wa.phone_number_id ? "connecting" : "not_connected" }); await advance(9, 9); } catch { toast.error("Could not save WhatsApp"); } finally { setBusy(false); } };
  const runTest = async () => { if (!testMsg.trim()) return; try { const r: any = await api.aiTest(testMsg.trim()); setTestOut(r); } catch { toast.error("Test failed"); } };
  const doStep9 = () => advance(10, 10);
  const doStep10 = async () => { setBusy(true); try { await api.saveAiConfig({ ...ai, is_active: true }); await advance(11, 11); } catch { toast.error("Could not activate"); } finally { setBusy(false); } };
  const finish = () => { refresh(); setRoute("overview"); };

  const stepMeta = [
    { icon: Building2, title: "Create your business" },
    { icon: Building2, title: "Business profile" },
    { icon: Clock, title: "Opening hours" },
    { icon: Package, title: "Add products" },
    { icon: BookOpen, title: "Common questions" },
    { icon: FileText, title: "Policies" },
    { icon: Bot, title: "Meet your AI assistant" },
    { icon: Smartphone, title: "Connect WhatsApp" },
    { icon: Sparkles, title: "Test the assistant" },
    { icon: Check, title: "Review & activate" },
    { icon: Check, title: "You're all set!" },
  ][step - 1];

  const Shell = ({ children, next, nextLabel = "Continue", onNext, canBack = true, hideNext = false }: any) => (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-8">
      <div className="mb-6 flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-brand text-brand-foreground"><MessagesSquare className="size-4.5" /></span>
        <span className="font-semibold tracking-tight">{BRAND.name}</span>
        <span className="ml-auto text-xs text-muted-foreground">Step {step} of {TOTAL}</span>
      </div>
      <Progress value={(step / TOTAL) * 100} className="mb-6" />
      <div className="mb-5 flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><stepMeta.icon className="size-4.5" /></span>
        <h1 className="text-xl font-semibold tracking-tight">{stepMeta.title}</h1>
      </div>
      <Card className="flex-1"><CardContent className="space-y-4 p-5">{children}</CardContent></Card>
      {!hideNext && (
        <div className="mt-5 flex items-center gap-2">
          {canBack && step > 1 && <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={busy}><ArrowLeft className="size-4" />Back</Button>}
          <div className="flex-1" />
          <Button onClick={onNext} disabled={busy}>{busy ? "Saving…" : nextLabel}{!busy && <ArrowRight className="size-4" />}</Button>
        </div>
      )}
    </div>
  );

  // ---- render per step ----
  if (step === 1) return <Shell onNext={doStep1} canBack={false} nextLabel="Create business">
    <p className="text-sm text-muted-foreground">Let's set up your AI WhatsApp assistant. First, tell us about your business.</p>
    <Field label="Business name"><Input value={s1.name} onChange={(e) => setS1({ ...s1, name: e.target.value })} placeholder="Paul's Fashion Store" /></Field>
    <Field label="Business type">
      <Select value={s1.business_type} onValueChange={(v) => setS1({ ...s1, business_type: v })}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{titleCase(t)}</SelectItem>)}</SelectContent>
      </Select>
    </Field>
  </Shell>;

  if (step === 2) return <Shell onNext={doStep2}>
    <Field label="Description"><Textarea rows={2} value={s2.description} onChange={(e) => setS2({ ...s2, description: e.target.value })} placeholder="What do you sell?" /></Field>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Location"><Input value={s2.location} onChange={(e) => setS2({ ...s2, location: e.target.value })} /></Field>
      <Field label="Currency"><Select value={s2.currency} onValueChange={(v) => setS2({ ...s2, currency: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="Phone"><Input value={s2.phone} onChange={(e) => setS2({ ...s2, phone: e.target.value })} /></Field>
      <Field label="Email"><Input type="email" value={s2.email} onChange={(e) => setS2({ ...s2, email: e.target.value })} /></Field>
    </div>
    <Field label="Website"><Input value={s2.website} onChange={(e) => setS2({ ...s2, website: e.target.value })} placeholder="https://" /></Field>
  </Shell>;

  if (step === 3) return <Shell onNext={doStep3}>
    <p className="text-sm text-muted-foreground">When are you open? The AI uses this to answer "are you open?" accurately.</p>
    <div className="divide-y rounded-lg border">
      {hours.map((h, i) => (
        <div key={h.day} className="flex items-center gap-3 p-2.5">
          <span className="w-24 capitalize text-sm">{h.day}</span>
          <Switch checked={h.is_open} onCheckedChange={(v) => { const n = [...hours]; n[i] = { ...h, is_open: v }; setHours(n); }} />
          {h.is_open ? (<>
            <Input type="time" className="w-28" value={h.open_time || ""} onChange={(e) => { const n = [...hours]; n[i] = { ...h, open_time: e.target.value }; setHours(n); }} />
            <span className="text-muted-foreground">–</span>
            <Input type="time" className="w-28" value={h.close_time || ""} onChange={(e) => { const n = [...hours]; n[i] = { ...h, close_time: e.target.value }; setHours(n); }} />
          </>) : <span className="text-sm text-muted-foreground">Closed</span>}
        </div>
      ))}
    </div>
  </Shell>;

  if (step === 4) return <Shell onNext={doStep4}>
    <p className="text-sm text-muted-foreground">Add your products and real prices. The AI will only quote what you enter here — it never invents prices.</p>
    <div className="space-y-2 rounded-lg border p-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_7rem_9rem_auto]">
        <Input value={pForm.name} onChange={(e) => setPForm({ ...pForm, name: e.target.value })} placeholder="Product name" />
        <Input type="number" min="0" step="0.01" value={pForm.priceMajor} onChange={(e) => setPForm({ ...pForm, priceMajor: e.target.value })} placeholder="Price" />
        <Select value={pForm.stock_status} onValueChange={(v) => setPForm({ ...pForm, stock_status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.keys(STOCK_LABELS).map((s) => <SelectItem key={s} value={s}>{STOCK_LABELS[s]}</SelectItem>)}</SelectContent></Select>
        <Button onClick={addProduct} disabled={!pForm.name.trim()}><Plus className="size-4" /></Button>
      </div>
    </div>
    {products.length > 0 && <ul className="space-y-1.5">{products.map((p) => (
      <li key={p.id} className="flex items-center gap-2 rounded-lg border p-2.5 text-sm">
        <span className="flex-1 truncate font-medium">{p.name}</span>
        <span className="text-brand">{p.price != null ? formatMoney(p.price, p.currency) : "—"}</span>
        <Button size="icon" variant="ghost" onClick={() => delProduct(p.id)}><Trash2 className="size-3.5 text-rose-600" /></Button>
      </li>
    ))}</ul>}
    {products.length === 0 && <p className="text-xs text-muted-foreground">You can add more later from the Products page.</p>}
  </Shell>;

  if (step === 5) return <Shell onNext={doStep5}>
    <p className="text-sm text-muted-foreground">Add questions customers ask often. The AI answers these verbatim.</p>
    <div className="space-y-2 rounded-lg border p-3">
      <Input value={fForm.question} onChange={(e) => setFForm({ ...fForm, question: e.target.value })} placeholder="Question" />
      <Textarea rows={2} value={fForm.answer} onChange={(e) => setFForm({ ...fForm, answer: e.target.value })} placeholder="Answer" />
      <Button size="sm" onClick={addFaq} disabled={!fForm.question.trim() || !fForm.answer.trim()}><Plus className="size-4" />Add FAQ</Button>
    </div>
    {faqs.length > 0 && <ul className="space-y-1.5">{faqs.map((f) => (
      <li key={f.id} className="flex items-start gap-2 rounded-lg border p-2.5 text-sm">
        <span className="flex-1"><span className="font-medium">{f.question}</span><span className="block text-xs text-muted-foreground">{f.answer}</span></span>
        <Button size="icon" variant="ghost" onClick={() => delFaq(f.id)}><Trash2 className="size-3.5 text-rose-600" /></Button>
      </li>
    ))}</ul>}
  </Shell>;

  if (step === 6) return <Shell onNext={doStep6}>
    <p className="text-sm text-muted-foreground">Your delivery, returns and refund policies. The AI quotes these instead of guessing.</p>
    {POLICY_KINDS.map((p) => <Field key={p.kind} label={p.label}><Textarea rows={2} value={policies[p.kind] || ""} onChange={(e) => setPolicies({ ...policies, [p.kind]: e.target.value })} placeholder={`${p.label} policy…`} /></Field>)}
  </Shell>;

  if (step === 7) return <Shell onNext={doStep7}>
    <p className="text-sm text-muted-foreground">Shape how your assistant sounds. You can change this any time in Settings.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Assistant name"><Input value={ai.assistant_name} onChange={(e) => setAi({ ...ai, assistant_name: e.target.value })} /></Field>
      <Field label="Tone"><Select value={ai.tone} onValueChange={(v) => setAi({ ...ai, tone: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TONES.map((t) => <SelectItem key={t} value={t}>{titleCase(t)}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="Language"><Select value={ai.language} onValueChange={(v) => setAi({ ...ai, language: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{LANGS.map((x) => <SelectItem key={x.v} value={x.v}>{x.l}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="Response length"><Select value={ai.response_length} onValueChange={(v) => setAi({ ...ai, response_length: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{LENGTHS.map((l) => <SelectItem key={l} value={l}>{titleCase(l)}</SelectItem>)}</SelectContent></Select></Field>
    </div>
    <Field label="Hand off to a human…"><Select value={ai.handoff_behavior} onValueChange={(v) => setAi({ ...ai, handoff_behavior: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{HANDOFF.map((h) => <SelectItem key={h.v} value={h.v}>{h.l}</SelectItem>)}</SelectContent></Select></Field>
    <Field label="Welcome message"><Textarea rows={2} value={ai.welcome_message} onChange={(e) => setAi({ ...ai, welcome_message: e.target.value })} placeholder="Hi! Welcome — ask me about products, prices or delivery." /></Field>
    <Field label="Fallback message" hint="Used when it can't answer — it must never invent details."><Textarea rows={2} value={ai.fallback_message} onChange={(e) => setAi({ ...ai, fallback_message: e.target.value })} /></Field>
  </Shell>;

  if (step === 8) return <Shell onNext={doStep8} nextLabel="Save & continue">
    <p className="text-sm text-muted-foreground">Connect using the official Meta WhatsApp Business Platform. Enter the IDs from your Meta app's WhatsApp → API setup. You can finish this later in Settings.</p>
    <Field label="Phone Number ID"><Input value={wa.phone_number_id} onChange={(e) => setWa({ ...wa, phone_number_id: e.target.value })} placeholder="1055XXXXXXXXXXX" /></Field>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="WABA ID"><Input value={wa.waba_id} onChange={(e) => setWa({ ...wa, waba_id: e.target.value })} /></Field>
      <Field label="Display phone"><Input value={wa.display_phone} onChange={(e) => setWa({ ...wa, display_phone: e.target.value })} placeholder="+234…" /></Field>
    </div>
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
      Message delivery also requires the <span className="font-mono">META_ACCESS_TOKEN</span>, <span className="font-mono">META_VERIFY_TOKEN</span> and <span className="font-mono">META_APP_SECRET</span> secrets, entered in Sites Settings. Without them the assistant still processes messages but can't reply on WhatsApp.
    </div>
  </Shell>;

  if (step === 9) return <Shell onNext={doStep9}>
    <p className="text-sm text-muted-foreground">Try it as a customer would. You'll see the reply, the detected intent and the sources used.</p>
    <div className="flex gap-2">
      <Input value={testMsg} onChange={(e) => setTestMsg(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") runTest(); }} placeholder="How much is the black hoodie?" />
      <Button onClick={runTest} disabled={!testMsg.trim()}><Send className="size-4" /></Button>
    </div>
    {testOut && (
      <div className="space-y-2 rounded-lg border p-3">
        <p className="whitespace-pre-wrap text-sm">{testOut.reply}</p>
        <div className="flex flex-wrap gap-1.5">
          {testOut.intent && <Badge variant="outline" className="border-transparent bg-violet-500/15 text-[10px] text-violet-700 dark:text-violet-300">intent: {testOut.intent}</Badge>}
          <Badge variant="outline" className="border-transparent bg-muted text-[10px] text-muted-foreground">{testOut.mode}</Badge>
          {testOut.handoff && <Badge variant="outline" className="border-transparent bg-amber-500/15 text-[10px] text-amber-700 dark:text-amber-300">handoff</Badge>}
        </div>
        {testOut.sources?.length > 0 && <p className="text-xs text-muted-foreground">Sources: {testOut.sources.map((s: any) => s.ref || s.type).join(", ")}</p>}
      </div>
    )}
  </Shell>;

  if (step === 10) return <Shell onNext={doStep10} nextLabel="Activate assistant">
    <p className="text-sm text-muted-foreground">Review your setup. Activating lets the AI start answering new WhatsApp messages.</p>
    <ul className="space-y-1.5 text-sm">
      <li className="flex items-center gap-2"><Check className="size-4 text-emerald-600" />{business?.name || s1.name} · {titleCase(s1.business_type)}</li>
      <li className="flex items-center gap-2"><Check className="size-4 text-emerald-600" />{products.length} product(s), {faqs.length} FAQ(s)</li>
      <li className="flex items-center gap-2"><Check className="size-4 text-emerald-600" />Assistant "{ai.assistant_name}" · {titleCase(ai.tone)} · {LANGS.find((x) => x.v === ai.language)?.l}</li>
      <li className="flex items-center gap-2">{wa.phone_number_id ? <Check className="size-4 text-emerald-600" /> : <span className="size-4 rounded-full border-2 border-muted-foreground/40" />}WhatsApp {wa.phone_number_id ? "ID saved" : "not connected yet"}</li>
    </ul>
  </Shell>;

  return <Shell hideNext>
    <div className="py-6 text-center">
      <span className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-brand/15 text-brand"><Sparkles className="size-7" /></span>
      <h2 className="text-lg font-semibold">Your assistant is live!</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Head to your dashboard to see conversations, capture leads and watch the analytics. You can finish connecting WhatsApp or add more products any time.</p>
      <Button className="mt-5" onClick={finish}>Go to dashboard<ArrowRight className="size-4" /></Button>
    </div>
  </Shell>;
}
