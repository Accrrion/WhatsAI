import * as React from "react";
import { Smartphone, CheckCircle2, AlertTriangle, Send, ExternalLink, Copy, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/api";
import { useApp } from "@/store";
import { titleCase } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, StatusBadge, Field, LoadingRows } from "../shared";

const STATUSES = ["not_connected", "connecting", "connected", "error", "disconnected"];

export default function WhatsAppPage() {
  const { refresh } = useApp();
  const [state, setState] = React.useState<any | null>(null);
  const [form, setForm] = React.useState({ phone_number_id: "", waba_id: "", display_phone: "", status: "connecting" });
  const [to, setTo] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);

  const load = React.useCallback(() => {
    api.getWhatsapp().then((r: any) => {
      setState(r);
      const w = r.whatsapp;
      if (w) setForm({ phone_number_id: w.phone_number_id || "", waba_id: w.waba_id || "", display_phone: w.display_phone || "", status: w.status || "connecting" });
    }).catch(() => setState({ whatsapp: null, platformConfigured: false, verifyTokenSet: false }));
  }, []);
  React.useEffect(() => { load(); }, [load]);

  const webhookUrl = `${window.location.origin}/functions/v1/app?action=whatsapp.webhook`;
  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); toast.success("Copied"); } catch { toast.error("Copy failed"); } };

  const save = async () => {
    setSaving(true);
    try { await api.saveWhatsapp(form); await load(); refresh(); toast.success("WhatsApp details saved"); }
    catch { toast.error("Could not save"); }
    finally { setSaving(false); }
  };
  const test = async () => {
    if (!to.trim()) { toast.error("Enter a destination number"); return; }
    setTesting(true);
    try { const r: any = await api.testWhatsapp(to.trim()); if (r?.sent) toast.success("Test message sent"); }
    catch (e: any) { toast.error(e?.message || "Test failed — check META_ACCESS_TOKEN and Phone Number ID"); }
    finally { setTesting(false); }
  };

  if (state === null) return <div className="space-y-5"><PageHeader title="WhatsApp" /><LoadingRows rows={5} /></div>;

  const platformConfigured = state.platformConfigured;
  const verifyTokenSet = state.verifyTokenSet;
  const status = state.whatsapp?.status || "not_connected";

  return (
    <div className="space-y-5">
      <PageHeader title="WhatsApp connection" description="Connect your number using the official Meta WhatsApp Business Platform (Cloud API).">
        <StatusBadge status={status} label={titleCase(status)} />
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center gap-2"><ShieldCheck className="size-4 text-brand" /><CardTitle className="text-base">Platform status</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Message sending (META_ACCESS_TOKEN)</span>
              {platformConfigured ? <Badge className="gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="size-3" />Configured</Badge> : <Badge className="gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-300"><AlertTriangle className="size-3" />Missing</Badge>}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Webhook verification (META_VERIFY_TOKEN)</span>
              {verifyTokenSet ? <Badge className="gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="size-3" />Set</Badge> : <Badge className="gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-300"><AlertTriangle className="size-3" />Not set</Badge>}
            </div>
            <Separator />
            <p className="text-xs text-muted-foreground">These secrets are entered in <span className="font-medium">Sites Settings → Secrets</span> and never exposed to the browser. Required: <span className="font-mono">META_ACCESS_TOKEN</span>, <span className="font-mono">META_VERIFY_TOKEN</span>, <span className="font-mono">META_APP_SECRET</span> (signature validation), <span className="font-mono">META_APP_ID</span>.</p>
            {!platformConfigured && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                <p className="text-muted-foreground">Until <span className="font-mono">META_ACCESS_TOKEN</span> is set, the assistant still processes and stores messages, but replies cannot be delivered to WhatsApp.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-2"><Smartphone className="size-4 text-brand" /><CardTitle className="text-base">Your number</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Phone Number ID" hint="From Meta → WhatsApp → API setup."><Input value={form.phone_number_id} onChange={(e) => setForm({ ...form, phone_number_id: e.target.value })} placeholder="1055XXXXXXXXXXX" /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="WABA ID"><Input value={form.waba_id} onChange={(e) => setForm({ ...form, waba_id: e.target.value })} placeholder="1022XXXXXXXXXX" /></Field>
              <Field label="Display phone"><Input value={form.display_phone} onChange={(e) => setForm({ ...form, display_phone: e.target.value })} placeholder="+234…" /></Field>
            </div>
            <Field label="Connection status">
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{titleCase(s)}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Button className="w-full" onClick={save} disabled={saving}>Save connection details</Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center gap-2"><ExternalLink className="size-4 text-brand" /><CardTitle className="text-base">Webhook endpoint</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-xs text-muted-foreground">In Meta App Dashboard → WhatsApp → Configuration, set the callback URL to your published site's webhook and subscribe to the <span className="font-mono">messages</span> field. The GET handshake and signature verification are handled automatically.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg bg-muted px-3 py-2 font-mono text-xs">{webhookUrl}</code>
            <Button size="icon" variant="outline" onClick={() => copy(webhookUrl)}><Copy className="size-3.5" /></Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center gap-2"><Send className="size-4 text-brand" /><CardTitle className="text-base">Send a test message</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Destination WhatsApp number (+234…)" className="flex-1" />
            <Button onClick={test} disabled={testing || !platformConfigured}>{testing ? "Sending…" : "Send test"}</Button>
          </div>
          {!platformConfigured && <p className="mt-2 text-xs text-muted-foreground">Enable META_ACCESS_TOKEN to send test messages.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
