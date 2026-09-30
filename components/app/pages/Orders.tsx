import * as React from "react";
import { ShoppingCart, Plus } from "lucide-react";
import { toast } from "sonner";
import { api, type Order } from "@/api";
import { useApp } from "@/store";
import { formatMoney, relativeTime, ORDER_STATUS } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, StatusBadge, EmptyState, LoadingRows, Field } from "../shared";

const STATUSES = Object.keys(ORDER_STATUS);
const PAYMENTS = ["pending", "paid", "failed", "refunded"];

export default function Orders() {
  const { data } = useApp();
  const currency = data?.business?.currency || "NGN";
  const [items, setItems] = React.useState<Order[] | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [form, setForm] = React.useState({ status: "pending", payment_status: "pending", totalMajor: "", delivery_address: "" });

  const load = React.useCallback(() => { api.listOrders().then((r) => setItems(r.items)).catch(() => setItems([])); }, []);
  React.useEffect(() => { load(); }, [load]);

  const setStatus = async (o: Order, status: string) => {
    try { await api.saveOrder({ ...o, status }); load(); toast.success("Order updated"); }
    catch { toast.error("Could not update order"); }
  };
  const create = async () => {
    try {
      await api.saveOrder({ status: form.status, payment_status: form.payment_status, total: form.totalMajor ? Number(form.totalMajor) : 0, delivery_address: form.delivery_address || null, customer_id: null });
      setAdding(false); setForm({ status: "pending", payment_status: "pending", totalMajor: "", delivery_address: "" }); load(); toast.success("Order recorded");
    } catch { toast.error("Could not record order"); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Orders" description="Orders the AI helps capture and your team confirms.">
        <Button onClick={() => setAdding(true)}><Plus className="size-4" />Record order</Button>
      </PageHeader>

      {items === null ? <LoadingRows rows={5} /> : items.length === 0 ? (
        <EmptyState icon={ShoppingCart} title="No orders yet" description="Orders appear here once customers place them." />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead className="hidden md:table-cell">Delivery</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <p className="font-mono text-xs text-muted-foreground">#{o.id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">{relativeTime(o.created_at)} ago</p>
                  </TableCell>
                  <TableCell className="hidden max-w-48 truncate text-sm text-muted-foreground md:table-cell">{o.delivery_address || "—"}</TableCell>
                  <TableCell className="font-medium">{formatMoney(o.total, o.currency || currency)}</TableCell>
                  <TableCell><StatusBadge status={o.payment_status} /></TableCell>
                  <TableCell>
                    <Select value={o.status} onValueChange={(v) => setStatus(o, v)}>
                      <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{ORDER_STATUS[s]}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record an order</DialogTitle><DialogDescription>Log an order taken manually or confirmed from a chat.</DialogDescription></DialogHeader>
          <div className="grid gap-3">
            <Field label={`Total (${currency})`}><Input type="number" min="0" step="0.01" value={form.totalMajor} onChange={(e) => setForm({ ...form, totalMajor: e.target.value })} placeholder="25000" /></Field>
            <Field label="Delivery address"><Input value={form.delivery_address} onChange={(e) => setForm({ ...form, delivery_address: e.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Order status">
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{ORDER_STATUS[s]}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Payment">
                <Select value={form.payment_status} onValueChange={(v) => setForm({ ...form, payment_status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PAYMENTS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAdding(false)}>Cancel</Button><Button onClick={create}>Save order</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
