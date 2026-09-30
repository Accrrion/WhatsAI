import * as React from "react";
import { MessagesSquare, Bot, UserRound, CheckCheck, Tag, StickyNote, Send, RefreshCw, Archive, Hand, Sparkles, Phone, Mail } from "lucide-react";
import { toast } from "sonner";
import { api, type Conversation, type Message, type Customer } from "@/api";
import { useApp } from "@/store";
import { cn } from "@/lib/utils";
import { relativeTime, timeOfDay, CONV_STATUS } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { PageHeader, StatusBadge, EmptyState, LoadingRows } from "../shared";

const FILTERS = [
  { key: "", label: "All" },
  { key: "open", label: "Open" },
  { key: "human_handoff", label: "Needs you" },
  { key: "resolved", label: "Resolved" },
];

function Bubble({ m }: { m: Message }) {
  const inbound = m.direction === "inbound";
  return (
    <div className={cn("flex", inbound ? "justify-start" : "justify-end")}>
      <div className={cn(
        "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-sm sm:max-w-[70%]",
        inbound ? "rounded-bl-sm bg-muted text-foreground" : "rounded-br-sm bg-brand text-brand-foreground",
      )}>
        <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
        <p className={cn("mt-1 flex items-center justify-end gap-1 text-[10px]", inbound ? "text-muted-foreground" : "text-brand-foreground/70")}>
          {!inbound && (m.sender === "ai" ? <Bot className="size-3" /> : <UserRound className="size-3" />)}
          {timeOfDay(m.created_at)}
          {!inbound && m.status === "read" && <CheckCheck className="size-3" />}
        </p>
      </div>
    </div>
  );
}

export default function Conversations() {
  const { refresh } = useApp();
  const [filter, setFilter] = React.useState("");
  const [list, setList] = React.useState<Conversation[] | null>(null);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [thread, setThread] = React.useState<{ conversation: Conversation; messages: Message[] } | null>(null);
  const [customer, setCustomer] = React.useState<Customer | null>(null);
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [tagOpen, setTagOpen] = React.useState(false);
  const [noteOpen, setNoteOpen] = React.useState(false);
  const [tagText, setTagText] = React.useState("");
  const [noteText, setNoteText] = React.useState("");

  const loadList = React.useCallback((status: string) => {
    api.listConversations(status || undefined).then((r) => setList(r.items)).catch(() => setList([]));
  }, []);

  React.useEffect(() => { loadList(filter); }, [filter, loadList]);

  const openThread = React.useCallback((id: string) => {
    setActiveId(id);
    setThread(null);
    api.getConversation(id).then((r) => {
      setThread(r);
      setCustomer(r.conversation?.customer || null);
      loadList(filter);
    }).catch(() => toast.error("Could not load conversation"));
  }, [filter, loadList]);

  React.useEffect(() => {
    if (!activeId && list && list.length) openThread(list[0].id);
  }, [list, activeId, openThread]);

  const act = async (fn: () => Promise<any>, msg: string) => {
    if (!activeId) return;
    try { await fn(); toast.success(msg); await openThread(activeId); refresh(); }
    catch { toast.error("Action failed"); }
  };

  const send = async () => {
    if (!activeId || !draft.trim()) return;
    setSending(true);
    try {
      const r: any = await api.reply(activeId, draft.trim());
      setDraft("");
      await openThread(activeId);
      refresh();
      toast.success(r?.delivered ? "Reply sent to WhatsApp" : "Reply saved (WhatsApp not connected)");
    } catch { toast.error("Could not send reply"); }
    finally { setSending(false); }
  };

  const conv = thread?.conversation;
  const isHuman = conv?.mode === "human" || conv?.status === "human_handoff";

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader title="Conversations" description="Every customer chat — AI-handled or taken over by your team." />
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Button key={f.key} size="sm" variant={filter === f.key ? "default" : "outline"} onClick={() => { setFilter(f.key); setActiveId(null); }}>{f.label}</Button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[18rem_1fr_16rem]">
        {/* List */}
        <div className="min-h-0 rounded-xl border bg-card">
          <ScrollArea className="h-[24rem] lg:h-full">
            {list === null ? <div className="p-3"><LoadingRows rows={5} /></div> : list.length === 0 ? (
              <div className="p-4"><EmptyState icon={MessagesSquare} title="No conversations" description="Messages from WhatsApp appear here." /></div>
            ) : (
              <ul className="divide-y">
                {list.map((c) => (
                  <li key={c.id}>
                    <button onClick={() => openThread(c.id)} className={cn("flex w-full items-start gap-2.5 p-3 text-left transition-colors hover:bg-muted/50", activeId === c.id && "bg-muted")}>
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium">{(c.customer?.name || "?").slice(0, 1).toUpperCase()}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium">{c.customer?.name || "Unknown"}</span>
                          {c.unread > 0 && <span className="grid size-4 shrink-0 place-items-center rounded-full bg-brand text-[9px] font-bold text-brand-foreground">{c.unread}</span>}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{c.last_message || "No messages"}</span>
                        <span className="mt-1 flex items-center gap-1.5">
                          {c.mode === "ai" ? <Badge variant="outline" className="border-transparent bg-violet-500/15 px-1 text-[9px] text-violet-700 dark:text-violet-300">AI</Badge> : <Badge variant="outline" className="border-transparent bg-amber-500/15 px-1 text-[9px] text-amber-700 dark:text-amber-300">Human</Badge>}
                          <span className="text-[10px] text-muted-foreground">{relativeTime(c.last_message_at)}</span>
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </div>

        {/* Thread */}
        <div className="flex min-h-0 flex-col rounded-xl border bg-card">
          {!conv ? (
            <div className="grid flex-1 place-items-center p-6"><EmptyState icon={MessagesSquare} title="Select a conversation" description="Choose a chat to view messages and reply." /></div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{conv.customer?.name || "Unknown"}</p>
                  <p className="truncate text-xs text-muted-foreground">{conv.customer?.phone || conv.customer?.wa_id || "No contact"}</p>
                </div>
                <StatusBadge status={conv.status} label={CONV_STATUS[conv.status]} />
                <div className="flex flex-wrap gap-1.5">
                  {!isHuman ? (
                    <Button size="sm" variant="outline" onClick={() => act(() => api.takeover(conv.id), "You took over — AI paused")}><Hand className="size-3.5" />Take over</Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => act(() => api.returnToAi(conv.id), "Returned to AI")}><Sparkles className="size-3.5" />Return to AI</Button>
                  )}
                  {conv.status !== "resolved" && <Button size="sm" variant="outline" onClick={() => act(() => api.resolve(conv.id), "Conversation resolved")}><Archive className="size-3.5" />Resolve</Button>}
                  <Button size="sm" variant="ghost" onClick={() => { setTagText((conv.tags || []).join(", ")); setTagOpen(true); }}><Tag className="size-3.5" />Tag</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setNoteText(""); setNoteOpen(true); }}><StickyNote className="size-3.5" />Note</Button>
                </div>
              </div>

              <ScrollArea className="h-[20rem] flex-1 lg:h-auto">
                <div className="space-y-2.5 p-3">
                  {thread!.messages.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No messages yet.</p> : thread!.messages.map((m) => <Bubble key={m.id} m={m} />)}
                </div>
              </ScrollArea>

              <div className="border-t p-3">
                {isHuman && <p className="mb-2 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400"><Hand className="size-3.5" />You're handling this chat — the AI is paused.</p>}
                <div className="flex items-end gap-2">
                  <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Type a reply…" rows={1} className="max-h-32 min-h-9 flex-1 resize-none" />
                  <Button onClick={send} disabled={sending || !draft.trim()}><Send className="size-4" /></Button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Customer panel */}
        <div className="hidden min-h-0 rounded-xl border bg-card lg:block">
          {!conv ? null : (
            <div className="space-y-3 p-4">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-full bg-brand/15 text-sm font-semibold text-brand">{(customer?.name || "?").slice(0, 1).toUpperCase()}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{customer?.name || "Unknown customer"}</p>
                  <p className="truncate text-xs text-muted-foreground">{CONV_STATUS[conv.status] || conv.status}</p>
                </div>
              </div>
              <Separator />
              <div className="space-y-2 text-sm">
                {customer?.phone && <p className="flex items-center gap-2 text-muted-foreground"><Phone className="size-3.5" />{customer.phone}</p>}
                {customer?.email && <p className="flex items-center gap-2 text-muted-foreground"><Mail className="size-3.5" />{customer.email}</p>}
                {customer?.wa_id && <p className="flex items-center gap-2 text-muted-foreground"><MessagesSquare className="size-3.5" />WA {customer.wa_id}</p>}
                {!customer?.phone && !customer?.email && !customer?.wa_id && <p className="text-xs text-muted-foreground">No contact details captured yet.</p>}
              </div>
              {conv.tags?.length > 0 && (<>
                <Separator />
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Tags</p>
                  <div className="flex flex-wrap gap-1">{conv.tags.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}</div>
                </div>
              </>)}
              <Separator />
              <Button variant="outline" size="sm" className="w-full" onClick={() => { openThread(conv.id); }}><RefreshCw className="size-3.5" />Reload thread</Button>
            </div>
          )}
        </div>
      </div>

      <Dialog open={tagOpen} onOpenChange={setTagOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tags</DialogTitle><DialogDescription>Comma-separated labels for this conversation.</DialogDescription></DialogHeader>
          <Label htmlFor="tags">Tags</Label>
          <Input id="tags" value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="vip, bulk-order" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setTagOpen(false)}>Cancel</Button>
            <Button onClick={async () => { const tags = tagText.split(",").map((t) => t.trim()).filter(Boolean); await act(() => api.tagConversation(conv!.id, tags), "Tags updated"); setTagOpen(false); }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add internal note</DialogTitle><DialogDescription>Visible to your team only — never sent to the customer.</DialogDescription></DialogHeader>
          <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="e.g. Customer wants bulk pricing for 50 hoodies." rows={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteOpen(false)}>Cancel</Button>
            <Button disabled={!noteText.trim()} onClick={async () => { await act(() => api.addNote(conv!.id, noteText.trim()), "Note added"); setNoteOpen(false); }}>Save note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
