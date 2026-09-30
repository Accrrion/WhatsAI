import * as React from "react";
import { Target, Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { api, type Lead } from "@/api";
import { LEAD_STATUS, relativeTime } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, StatusBadge, EmptyState, LoadingRows, Field } from "../shared";

const STATUSES = Object.keys(LEAD_STATUS);

export default function Leads() {
  const [items, setItems] = React.useState<Lead[] | null>(null);
  const [editing, setEditing] = React.useState<Partial<Lead> | null>(null);

  const load = React.useCallback(() => { api.listLeads().then((r) => setItems(r.items)).catch(() => setItems([])); }, []);
  React.useEffect(() => { load(); }, [load]);

  const setStatus = async (l: Lead, status: string) => {
    try { await api.saveLead({ ...l, status }); load(); toast.success("Lead updated"); }
    catch { toast.error("Could not update lead"); }
  };
  const remove = async (id: string) => {
    try { await api.deleteLead(id); load(); toast.success("Lead deleted"); }
    catch { toast.error("Could not delete lead"); }
  };
  const save = async () => {
    if (!editing) return;
    try { await api.saveLead(editing); setEditing(null); load(); toast.success("Lead saved"); }
    catch { toast.error("Could not save lead"); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Leads" description="Interested customers captured by the AI or added by your team.">
        <Button onClick={() => setEditing({ status: "new", source: "manual" })}><Plus className="size-4" />Add lead</Button>
      </PageHeader>

      {items === null ? <LoadingRows rows={6} /> : items.length === 0 ? (
        <EmptyState icon={Target} title="No leads yet" description="The AI captures leads when customers show buying intent." action={<Button variant="outline" onClick={() => setEditing({ status: "new", source: "manual" })}><Plus className="size-4" />Add your first lead</Button>} />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Contact</TableHead>
                <TableHead className="hidden lg:table-cell">Interest</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <p className="font-medium">{l.name || "—"}</p>
                    <p className="text-xs text-muted-foreground md:hidden">{l.phone || l.email || ""}</p>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{l.phone || l.email || "—"}</TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">{[l.interest, l.product].filter(Boolean).join(" · ") || "—"}</TableCell>
                  <TableCell><span className="text-xs capitalize text-muted-foreground">{l.source}</span></TableCell>
                  <TableCell>
                    <Select value={l.status} onValueChange={(v) => setStatus(l, v)}>
                      <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{LEAD_STATUS[s]}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setEditing(l)}><Pencil className="size-3.5" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(l.id)}><Trash2 className="size-3.5 text-rose-600" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Edit lead" : "Add lead"}</DialogTitle><DialogDescription>Capture a potential customer for follow-up.</DialogDescription></DialogHeader>
          <div className="grid gap-3">
            <Field label="Name"><Input value={editing?.name || ""} onChange={(e) => setEditing({ ...editing!, name: e.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Phone"><Input value={editing?.phone || ""} onChange={(e) => setEditing({ ...editing!, phone: e.target.value })} /></Field>
              <Field label="Email"><Input type="email" value={editing?.email || ""} onChange={(e) => setEditing({ ...editing!, email: e.target.value })} /></Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Interest"><Input value={editing?.interest || ""} onChange={(e) => setEditing({ ...editing!, interest: e.target.value })} placeholder="bulk order" /></Field>
              <Field label="Product"><Input value={editing?.product || ""} onChange={(e) => setEditing({ ...editing!, product: e.target.value })} /></Field>
            </div>
            <Field label="Status">
              <Select value={editing?.status || "new"} onValueChange={(v) => setEditing({ ...editing!, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{LEAD_STATUS[s]}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Notes"><Textarea rows={3} value={editing?.notes || ""} onChange={(e) => setEditing({ ...editing!, notes: e.target.value })} /></Field>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button onClick={save}>Save lead</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
