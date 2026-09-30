import * as React from "react";
import { Package, Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { api, type Product } from "@/api";
import { useApp } from "@/store";
import { formatMoney, STOCK_LABELS } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { PageHeader, StatusBadge, EmptyState, LoadingRows, Field } from "../shared";

const STOCKS = Object.keys(STOCK_LABELS);
type Form = Partial<Product> & { priceMajor?: string };

export default function Products() {
  const { data } = useApp();
  const currency = data?.business?.currency || "NGN";
  const [items, setItems] = React.useState<Product[] | null>(null);
  const [editing, setEditing] = React.useState<Form | null>(null);

  const load = React.useCallback(() => { api.listProducts().then((r) => setItems(r.items)).catch(() => setItems([])); }, []);
  React.useEffect(() => { load(); }, [load]);

  const openNew = () => setEditing({ stock_status: "in_stock", currency, priceMajor: "" });
  const openEdit = (p: Product) => setEditing({ ...p, priceMajor: p.price != null ? String(p.price / 100) : "" });

  const save = async () => {
    if (!editing || !editing.name?.trim()) { toast.error("Name is required"); return; }
    const payload = {
      id: editing.id, name: editing.name.trim(), description: editing.description || null,
      price: editing.priceMajor !== "" && editing.priceMajor != null ? Number(editing.priceMajor) : null,
      currency: editing.currency || currency, category: editing.category || null,
      stock_status: editing.stock_status || "in_stock", sku: editing.sku || null, image_url: editing.image_url || null,
    };
    try { await (editing.id ? api.updateProduct(payload) : api.createProduct(payload)); setEditing(null); load(); toast.success("Product saved"); }
    catch { toast.error("Could not save product"); }
  };
  const remove = async (id: string) => {
    try { await api.deleteProduct(id); load(); toast.success("Product deleted"); }
    catch { toast.error("Could not delete product"); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Products & services" description="Your catalogue. The AI uses these real prices and stock levels — it never invents them.">
        <Button onClick={openNew}><Plus className="size-4" />Add product</Button>
      </PageHeader>

      {items === null ? <LoadingRows rows={5} /> : items.length === 0 ? (
        <EmptyState icon={Package} title="No products yet" description="Add your products and prices so the AI can answer enquiries accurately." action={<Button variant="outline" onClick={openNew}><Plus className="size-4" />Add your first product</Button>} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.name}</p>
                    {p.category && <p className="truncate text-xs text-muted-foreground">{p.category}</p>}
                  </div>
                  <StatusBadge status={p.stock_status} label={STOCK_LABELS[p.stock_status]} />
                </div>
                {p.description && <p className="line-clamp-2 text-sm text-muted-foreground">{p.description}</p>}
                <p className="text-lg font-semibold text-brand">{p.price != null ? formatMoney(p.price, p.currency) : "Price on request"}</p>
                <div className="mt-auto flex justify-end gap-1 pt-1">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="size-3.5" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="size-3.5 text-rose-600" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Edit product" : "Add product"}</DialogTitle><DialogDescription>Accurate details keep AI answers grounded.</DialogDescription></DialogHeader>
          <div className="grid gap-3">
            <Field label="Name"><Input value={editing?.name || ""} onChange={(e) => setEditing({ ...editing!, name: e.target.value })} placeholder="Black Hoodie" /></Field>
            <Field label="Description"><Textarea rows={2} value={editing?.description || ""} onChange={(e) => setEditing({ ...editing!, description: e.target.value })} placeholder="Sizes, material, colours…" /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={`Price (${currency})`}><Input type="number" min="0" step="0.01" value={editing?.priceMajor ?? ""} onChange={(e) => setEditing({ ...editing!, priceMajor: e.target.value })} placeholder="25000" /></Field>
              <Field label="Category"><Input value={editing?.category || ""} onChange={(e) => setEditing({ ...editing!, category: e.target.value })} placeholder="Hoodies" /></Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Stock status">
                <Select value={editing?.stock_status || "in_stock"} onValueChange={(v) => setEditing({ ...editing!, stock_status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STOCKS.map((s) => <SelectItem key={s} value={s}>{STOCK_LABELS[s]}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="SKU"><Input value={editing?.sku || ""} onChange={(e) => setEditing({ ...editing!, sku: e.target.value })} placeholder="PF-HOOD-BLK" /></Field>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button onClick={save}>Save product</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
