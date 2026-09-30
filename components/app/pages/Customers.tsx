import * as React from "react";
import { Users, Phone, Mail, MessagesSquare } from "lucide-react";
import { api, type Customer } from "@/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader, EmptyState, LoadingRows } from "../shared";

export default function Customers() {
  const [items, setItems] = React.useState<Customer[] | null>(null);
  React.useEffect(() => { api.listCustomers().then((r) => setItems(r.items)).catch(() => setItems([])); }, []);

  return (
    <div className="space-y-5">
      <PageHeader title="Customers" description="Everyone who has messaged your business on WhatsApp." />
      {items === null ? <LoadingRows rows={6} /> : items.length === 0 ? (
        <EmptyState icon={Users} title="No customers yet" description="Customers are created automatically when they message you." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex items-start gap-3 p-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand/15 text-sm font-semibold text-brand">{(c.name || "?").slice(0, 1).toUpperCase()}</span>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate text-sm font-medium">{c.name || "Unknown"}</p>
                  {c.phone && <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground"><Phone className="size-3" />{c.phone}</p>}
                  {c.email && <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground"><Mail className="size-3" />{c.email}</p>}
                  {c.wa_id && <Badge variant="outline" className="mt-1 border-transparent bg-muted text-[10px] text-muted-foreground"><MessagesSquare className="mr-1 size-3" />{c.wa_id}</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
