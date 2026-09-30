import * as React from "react";
import { Save, Bot, Building2 } from "lucide-react";
import { toast } from "sonner";
import { api, type AiConfig, type Business } from "@/api";
import { useApp } from "@/store";
import { titleCase } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, Field, AiModeBadge } from "../shared";

const CURRENCIES = ["NGN", "USD", "GBP", "EUR", "GHS", "KES"];
const TONES = ["professional", "friendly", "casual", "luxury", "energetic"];
const LANGS = [{ v: "en", l: "English" }, { v: "pcm", l: "Nigerian Pidgin" }, { v: "yo", l: "Yoruba" }, { v: "ig", l: "Igbo" }, { v: "ha", l: "Hausa" }];
const LENGTHS = ["short", "medium", "detailed"];
const HANDOFF = [{ v: "on_request", l: "When the customer asks" }, { v: "on_unknown", l: "When it doesn't know" }, { v: "always", l: "Always" }, { v: "never", l: "Never" }];
const TYPES = ["fashion", "restaurant", "salon", "barber", "beauty", "electronics", "retail", "services", "real_estate", "other"];

export default function SettingsPage() {
  const { data, update, refresh } = useApp();
  const [biz, setBiz] = React.useState<Partial<Business>>({});
  const [cfg, setCfg] = React.useState<AiConfig | null>(null);
  const [provider, setProvider] = React.useState<any>(data?.aiProvider);
  const [savingBiz, setSavingBiz] = React.useState(false);
  const [savingAi, setSavingAi] = React.useState(false);

  React.useEffect(() => { if (data?.business) setBiz(data.business); }, [data?.business]);
  React.useEffect(() => { api.getAiConfig().then((r: any) => { setCfg(r.aiConfig); setProvider(r.aiProvider); }).catch(() => {}); }, []);

  const saveBiz = async () => {
    setSavingBiz(true);
    try { await api.saveBusiness(biz); await refresh(); toast.success("Business profile saved"); }
    catch { toast.error("Could not save profile"); }
    finally { setSavingBiz(false); }
  };
  const saveAi = async () => {
    if (!cfg) return;
    setSavingAi(true);
    try { await api.saveAiConfig(cfg); await refresh(); toast.success("Assistant settings saved"); }
    catch { toast.error("Could not save assistant"); }
    finally { setSavingAi(false); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" description="Your business profile and how the AI assistant behaves.">
        <AiModeBadge provider={provider} />
      </PageHeader>

      <Card>
        <CardHeader className="flex-row items-center gap-2"><Building2 className="size-4 text-brand" /><CardTitle className="text-base">Business profile</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Business name"><Input value={biz.name || ""} onChange={(e) => setBiz({ ...biz, name: e.target.value })} /></Field>
            <Field label="Business type">
              <Select value={biz.business_type || "other"} onValueChange={(v) => setBiz({ ...biz, business_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{titleCase(t)}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Description"><Textarea rows={2} value={biz.description || ""} onChange={(e) => setBiz({ ...biz, description: e.target.value })} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Location"><Input value={biz.location || ""} onChange={(e) => setBiz({ ...biz, location: e.target.value })} /></Field>
            <Field label="Currency">
              <Select value={biz.currency || "NGN"} onValueChange={(v) => setBiz({ ...biz, currency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Phone"><Input value={biz.phone || ""} onChange={(e) => setBiz({ ...biz, phone: e.target.value })} /></Field>
            <Field label="Email"><Input type="email" value={biz.email || ""} onChange={(e) => setBiz({ ...biz, email: e.target.value })} /></Field>
          </div>
          <Field label="Website"><Input value={biz.website || ""} onChange={(e) => setBiz({ ...biz, website: e.target.value })} placeholder="https://" /></Field>
          <div className="flex justify-end"><Button onClick={saveBiz} disabled={savingBiz}><Save className="size-4" />Save profile</Button></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center gap-2"><Bot className="size-4 text-brand" /><CardTitle className="text-base">AI assistant</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {cfg === null ? <p className="text-sm text-muted-foreground">Loading…</p> : (
            <>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div><p className="text-sm font-medium">Assistant active</p><p className="text-xs text-muted-foreground">When off, the AI stays silent on new messages.</p></div>
                <Switch checked={cfg.is_active} onCheckedChange={(v) => setCfg({ ...cfg, is_active: v })} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Assistant name"><Input value={cfg.assistant_name || ""} onChange={(e) => setCfg({ ...cfg, assistant_name: e.target.value })} placeholder="Amaka" /></Field>
                <Field label="Tone">
                  <Select value={cfg.tone} onValueChange={(v) => setCfg({ ...cfg, tone: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TONES.map((t) => <SelectItem key={t} value={t}>{titleCase(t)}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Language">
                  <Select value={cfg.language} onValueChange={(v) => setCfg({ ...cfg, language: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{LANGS.map((x) => <SelectItem key={x.v} value={x.v}>{x.l}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Response length">
                  <Select value={cfg.response_length} onValueChange={(v) => setCfg({ ...cfg, response_length: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{LENGTHS.map((l) => <SelectItem key={l} value={l}>{titleCase(l)}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Hand off to a human…">
                <Select value={cfg.handoff_behavior} onValueChange={(v) => setCfg({ ...cfg, handoff_behavior: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{HANDOFF.map((h) => <SelectItem key={h.v} value={h.v}>{h.l}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Welcome message"><Textarea rows={2} value={cfg.welcome_message || ""} onChange={(e) => setCfg({ ...cfg, welcome_message: e.target.value })} /></Field>
              <Field label="Fallback message" hint="Used when the AI can't answer — it must never invent details."><Textarea rows={2} value={cfg.fallback_message || ""} onChange={(e) => setCfg({ ...cfg, fallback_message: e.target.value })} /></Field>
              <div className="flex justify-end"><Button onClick={saveAi} disabled={savingAi}><Save className="size-4" />Save assistant</Button></div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
