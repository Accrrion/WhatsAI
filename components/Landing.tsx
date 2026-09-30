import * as React from "react";
import {
  BarChart3,
  Bot,
  Check,
  Clock,
  Inbox,
  Menu,
  MessageCircle,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Truck,
  UserCog,
  Users,
  UtensilsCrossed,
  X,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { BRAND } from "@/lib/config";
import { cn } from "@/lib/utils";

type NavItem = { label: string; href: string };

const NAV_ITEMS: NavItem[] = [
  { label: "How it works", href: "#how" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

type ChatBubble = {
  from: "customer" | "assistant";
  text: string;
  time: string;
};

const HERO_CHAT: ChatBubble[] = [
  {
    from: "customer",
    text: "How much is the black hoodie?",
    time: "10:02",
  },
  {
    from: "assistant",
    text: "The Black Hoodie is ₦25,000, available in M–XXL. Would you like to order?",
    time: "10:02",
  },
  {
    from: "customer",
    text: "Yes, deliver to Ikeja",
    time: "10:03",
  },
  {
    from: "assistant",
    text: "Great — I've noted that. Our team will confirm your order shortly.",
    time: "10:03",
  },
];

const EXAMPLE_CHAT: ChatBubble[] = [
  { from: "customer", text: "Good afternoon, do you have the Ankara two-piece in size L?", time: "14:21" },
  { from: "assistant", text: "Hello! Yes, the Ankara Two-Piece is available in size L at ₦18,500.", time: "14:21" },
  { from: "customer", text: "Nice. Do you deliver to Abuja, and how long does it take?", time: "14:22" },
  { from: "assistant", text: "We deliver nationwide. Abuja delivery takes 1–2 business days and costs ₦3,500.", time: "14:22" },
  { from: "customer", text: "Can I pay on delivery instead?", time: "14:23" },
  { from: "assistant", text: "That's a great question — let me connect you with our team so they can confirm the best payment option for you.", time: "14:23" },
  { from: "assistant", text: "A member of our team will pick up this chat shortly. Thanks for your patience!", time: "14:24" },
];

function ChatBubbleView({ bubble }: { bubble: ChatBubble }): React.ReactElement {
  const incoming: boolean = bubble.from === "customer";
  return (
    <div className={cn("flex", incoming ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[80%] rounded-xl px-3 py-2 text-sm shadow-sm",
          incoming
            ? "bg-brand text-brand-foreground rounded-bl-sm"
            : "bg-muted text-foreground rounded-br-sm border border-border"
        )}
      >
        <p className="leading-relaxed">{bubble.text}</p>
        <p
          className={cn(
            "mt-1 text-right text-[10px]",
            incoming ? "text-brand-foreground/70" : "text-muted-foreground"
          )}
        >
          {bubble.time}
        </p>
      </div>
    </div>
  );
}

function SectionHeading({
  id,
  eyebrow,
  title,
  description,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  description?: string;
}): React.ReactElement {
  return (
    <div className="mx-auto max-w-2xl text-center" id={id}>
      <Badge variant="secondary" className="mb-3">
        {eyebrow}
      </Badge>
      <h2 className="text-3xl font-bold tracking-tight md:text-4xl">{title}</h2>
      {description ? (
        <p className="mt-3 text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

export default function Landing(props: {
  onGetStarted: () => void;
  onDemo: () => void;
  authError?: boolean;
}): React.ReactElement {
  const [menuOpen, setMenuOpen] = React.useState<boolean>(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* 1. Sticky header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
          <a
            href="#hero"
            className="flex items-center gap-2"
            aria-label={`${BRAND.name} — back to top`}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-brand-foreground">
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-lg font-bold tracking-tight">{BRAND.name}</span>
          </a>

          <nav aria-label="Main navigation" className="hidden items-center gap-6 md:flex">
            {NAV_ITEMS.map((item: NavItem) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <Button variant="ghost" onClick={props.onGetStarted}>
              Sign in
            </Button>
            <Button onClick={props.onGetStarted}>Get started</Button>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open: boolean): boolean => !open)}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {menuOpen ? (
          <div className="border-t border-border bg-background px-4 pb-4 md:hidden">
            <nav aria-label="Mobile navigation" className="flex flex-col gap-1 pt-2">
              {NAV_ITEMS.map((item: NavItem) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {item.label}
                </a>
              ))}
              <Separator className="my-2" />
              <Button
                variant="ghost"
                className="justify-start"
                onClick={() => {
                  setMenuOpen(false);
                  props.onGetStarted();
                }}
              >
                Sign in
              </Button>
              <Button
                className="justify-start"
                onClick={() => {
                  setMenuOpen(false);
                  props.onGetStarted();
                }}
              >
                Get started
              </Button>
            </nav>
          </div>
        ) : null}
      </header>

      <main>
        {/* 2. Hero */}
        <section id="hero" className="border-b border-border bg-muted/40">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:px-6 md:py-24 lg:grid-cols-2">
            <div>
              <Badge className="mb-4 border-brand/30 bg-brand/10 text-foreground hover:bg-brand/15">
                <Sparkles className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                Built for Nigerian SMEs
              </Badge>
              <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl lg:text-6xl">
                {BRAND.tagline}
              </h1>
              <p className="mt-5 max-w-xl text-lg text-muted-foreground">
                Give your business an AI assistant that answers customers on WhatsApp,
                handles product and price questions, captures leads, and hands
                conversations to your team when needed.
              </p>

              {props.authError ? (
                <div
                  role="status"
                  className="mt-5 flex items-start gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-card-foreground"
                >
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <p>
                    You need to sign in to access the dashboard. Use{" "}
                    <span className="font-medium">Get started free</span> below to
                    sign in or create your account.
                  </p>
                </div>
              ) : null}

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" className="text-base" onClick={props.onGetStarted}>
                  Get started free
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="text-base"
                  onClick={props.onDemo}
                >
                  Explore live demo
                </Button>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                No card required to try. Connect your WhatsApp in minutes.
              </p>
            </div>

            {/* Hero visual: phone chat card */}
            <div className="mx-auto w-full max-w-sm" aria-hidden="true">
              <div className="rounded-3xl border border-border bg-card p-3 shadow-xl">
                <div className="flex items-center justify-between rounded-2xl bg-brand px-4 py-3 text-brand-foreground">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-foreground/20">
                      <Bot className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold leading-tight">
                        {BRAND.name} Store
                      </p>
                      <p className="text-[11px] opacity-80">AI assistant · online</p>
                    </div>
                  </div>
                  <span className="flex h-2 w-2 rounded-full bg-brand-foreground" />
                </div>
                <div className="flex flex-col gap-3 px-2 py-4">
                  {HERO_CHAT.map((bubble: ChatBubble, index: number) => (
                    <ChatBubbleView key={index} bubble={bubble} />
                  ))}
                </div>
                <div className="rounded-2xl border border-border bg-muted/50 px-4 py-3">
                  <p className="text-xs text-muted-foreground">
                    Lead captured: <span className="font-medium text-foreground">Black Hoodie · M–XXL · Ikeja</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Problem */}
        <section id="problem" className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20">
          <SectionHeading
            eyebrow="The problem"
            title="Chats don't wait — and every delay can cost a sale"
            description="Most small businesses lose customers the same three ways."
          />
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <Clock className="mb-2 h-8 w-8 text-primary" aria-hidden="true" />
                <CardTitle>Missed messages after hours</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Customers message at night and on weekends. By the time you reply
                  the next morning, many have already bought elsewhere.
                </CardDescription>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Zap className="mb-2 h-8 w-8 text-primary" aria-hidden="true" />
                <CardTitle>Sales lost to slow replies</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  A buyer asking "How much?" wants an answer now. Slow responses
                  turn warm enquiries into cold conversations.
                </CardDescription>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Users className="mb-2 h-8 w-8 text-primary" aria-hidden="true" />
                <CardTitle>No time for repeated questions</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  The same questions about prices, sizes, and delivery arrive all
                  day — answering them by hand crowds out everything else.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* 4. How it works */}
        <section id="how" className="border-y border-border bg-muted/40">
          <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20">
            <SectionHeading
              eyebrow="How it works"
              title="Live in four simple steps"
              description="No coding, no complicated setup — just connect, teach, and go live."
            />
            <ol className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  step: 1,
                  title: "Connect WhatsApp",
                  text: "Link your business WhatsApp number using the official Meta WhatsApp Business Platform.",
                },
                {
                  step: 2,
                  title: "Add your business info",
                  text: "Upload your products, prices, FAQs, policies, and opening hours.",
                },
                {
                  step: 3,
                  title: "Configure the AI tone",
                  text: "Choose how your assistant sounds — friendly, professional, or anything in between.",
                },
                {
                  step: 4,
                  title: "Go live",
                  text: "The AI answers customers, captures leads, and hands off to you whenever needed.",
                },
              ].map((item: { step: number; title: string; text: string }) => (
                <li key={item.step}>
                  <Card className="h-full">
                    <CardHeader>
                      <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                        {item.step}
                      </span>
                      <CardTitle className="text-lg">{item.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-base">{item.text}</CardDescription>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 5. Features */}
        <section id="features" className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20">
          <SectionHeading
            eyebrow="Features"
            title="Everything you need to sell on WhatsApp"
            description="One assistant that knows your business and works around the clock."
          />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Bot,
                title: "Answers grounded in YOUR data",
                text: "Replies come from your real products, prices, and FAQs — it won't invent numbers.",
              },
              {
                icon: Clock,
                title: "Available 24/7",
                text: "Nights, weekends, and holidays — customers always get a reply.",
              },
              {
                icon: UserCog,
                title: "Human handoff",
                text: "Take over any conversation instantly when a customer needs you.",
              },
              {
                icon: Users,
                title: "Lead capture",
                text: "Names, interests, and delivery details are saved automatically.",
              },
              {
                icon: Inbox,
                title: "Conversation inbox",
                text: "See every chat, AI or human, in one simple dashboard.",
              },
              {
                icon: ShoppingBag,
                title: "Product & price enquiries",
                text: "Answers 'how much' and 'do you have it' using your catalogue.",
              },
              {
                icon: Truck,
                title: "Delivery & policy answers",
                text: "Explains your delivery options, returns, and policies consistently.",
              },
              {
                icon: BarChart3,
                title: "Analytics",
                text: "Track conversations, common questions, and captured leads.",
              },
            ].map((feature: { icon: React.ComponentType<{ className?: string }>; title: string; text: string }) => (
              <Card key={feature.title} className="h-full">
                <CardHeader>
                  <feature.icon className="mb-2 h-7 w-7 text-primary" aria-hidden="true" />
                  <CardTitle className="text-base">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">{feature.text}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* 6. Example conversation */}
        <section id="example" className="border-y border-border bg-muted/40">
          <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20">
            <SectionHeading
              eyebrow="See a real conversation"
              title="From product question to human handoff"
              description="An example exchange showing how the assistant handles enquiries and knows when to involve your team."
            />
            <div className="mx-auto mt-12 w-full max-w-md">
              <Card>
                <CardHeader className="bg-brand text-brand-foreground rounded-t-xl">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-foreground/20">
                      <Bot className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div>
                      <CardTitle className="text-sm text-brand-foreground">
                        AI assistant
                      </CardTitle>
                      <CardDescription className="text-[11px] text-brand-foreground/80">
                        Example conversation — not a live chat
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 bg-card py-6">
                  {EXAMPLE_CHAT.map((bubble: ChatBubble, index: number) => (
                    <ChatBubbleView key={index} bubble={bubble} />
                  ))}
                </CardContent>
              </Card>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Example transcript. Actual conversations use your own products,
                prices, and policies.
              </p>
            </div>
          </div>
        </section>

        {/* 7. Use cases */}
        <section id="usecases" className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20">
          <SectionHeading
            eyebrow="Use cases"
            title="Built for businesses like yours"
            description="If your customers message you on WhatsApp, the assistant can help."
          />
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {[
              { label: "Fashion & apparel", icon: ShoppingBag },
              { label: "Restaurants", icon: UtensilsCrossed },
              { label: "Salons & barbers", icon: Store },
              { label: "Beauty", icon: Sparkles },
              { label: "Electronics", icon: Zap },
              { label: "Retail", icon: Store },
              { label: "Services", icon: UserCog },
              { label: "Real estate", icon: ShieldCheck },
            ].map((useCase: { label: string; icon: React.ComponentType<{ className?: string }> }) => (
              <Badge
                key={useCase.label}
                variant="outline"
                className="gap-1.5 rounded-full px-4 py-2 text-sm font-medium"
              >
                <useCase.icon className="h-4 w-4 text-primary" aria-hidden="true" />
                {useCase.label}
              </Badge>
            ))}
          </div>
        </section>

        {/* 8. Pricing */}
        <section id="pricing" className="border-y border-border bg-muted/40">
          <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20">
            <SectionHeading
              eyebrow="Pricing"
              title="Simple pricing"
              description="Plans for every stage — pricing details are coming soon."
            />
            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  name: "Free",
                  who: "For trying out the assistant.",
                  popular: false,
                  features: [
                    "1 WhatsApp number",
                    "Basic product & FAQ answers",
                    "Conversation history",
                    "Community support",
                  ],
                },
                {
                  name: "Starter",
                  who: "For solo owners getting started.",
                  popular: false,
                  features: [
                    "Everything in Free",
                    "Full product catalogue",
                    "Lead capture",
                    "Human handoff",
                  ],
                },
                {
                  name: "Business",
                  who: "For growing shops with steady enquiries.",
                  popular: true,
                  features: [
                    "Everything in Starter",
                    "Custom assistant tone",
                    "Delivery & policy answers",
                    "Analytics dashboard",
                    "Priority support",
                  ],
                },
                {
                  name: "Pro",
                  who: "For multi-location and high-volume teams.",
                  popular: false,
                  features: [
                    "Everything in Business",
                    "Multiple WhatsApp numbers",
                    "Team inbox & roles",
                    "Advanced analytics",
                  ],
                },
              ].map((tier: { name: string; who: string; popular: boolean; features: string[] }) => (
                <Card
                  key={tier.name}
                  className={cn(
                    "flex h-full flex-col",
                    tier.popular && "border-primary shadow-md"
                  )}
                >
                  <CardHeader>
                    {tier.popular ? (
                      <Badge className="mb-2 w-fit bg-primary text-primary-foreground">
                        Most popular
                      </Badge>
                    ) : null}
                    <CardTitle>{tier.name}</CardTitle>
                    <CardDescription>{tier.who}</CardDescription>
                    <p className="pt-2 text-2xl font-bold">
                      Coming soon{" "}
                      <span className="text-base font-normal text-muted-foreground">
                        —
                      </span>
                    </p>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <Separator className="mb-4" />
                    <ul className="space-y-2">
                      {tier.features.map((feature: string) => (
                        <li
                          key={feature}
                          className="flex items-start gap-2 text-sm text-muted-foreground"
                        >
                          <Check
                            className="mt-0.5 h-4 w-4 shrink-0 text-brand"
                            aria-hidden="true"
                          />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <div className="px-6 pb-6">
                    <Button
                      className="w-full"
                      variant={tier.popular ? "default" : "outline"}
                      onClick={props.onGetStarted}
                    >
                      Get started
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* 9. FAQ */}
        <section id="faq" className="mx-auto max-w-3xl px-4 py-16 md:px-6 md:py-20">
          <SectionHeading
            eyebrow="FAQ"
            title="Frequently asked questions"
            description="Everything you need to know before getting started."
          />
          <div className="mt-12 space-y-3">
            {[
              {
                q: "Do I need to know how to code?",
                a: "No. You connect your WhatsApp number, add your products and FAQs in the dashboard, and the assistant is ready. No technical skills needed.",
              },
              {
                q: "Which WhatsApp does it use?",
                a: "It uses the official Meta WhatsApp Business Platform (WhatsApp Business API), so your assistant runs on a proper, supported business connection.",
              },
              {
                q: "Is my business data private?",
                a: "Yes. Your products, prices, and customer conversations are used only to power your assistant. We don't sell or share your business data.",
              },
              {
                q: "Can I take over a chat myself?",
                a: "Yes. You can step into any conversation at any time — the AI steps back and the customer continues chatting with you, seamlessly.",
              },
              {
                q: "Which languages does it support?",
                a: "English is supported today. Nigerian Pidgin, Yoruba, Igbo, and Hausa are on the roadmap.",
              },
              {
                q: "What happens when the AI doesn't know the answer?",
                a: "It never makes things up. It politely lets the customer know and hands the conversation over to your team.",
              },
              {
                q: "Can I try it before committing?",
                a: "Yes — start free, or explore the live demo to see a working assistant in action.",
              },
            ].map((item: { q: string; a: string }) => (
              <details
                key={item.q}
                className="group rounded-xl border border-border bg-card px-5 py-4 open:shadow-sm"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-card-foreground [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span
                    className="text-muted-foreground transition-transform group-open:rotate-45"
                    aria-hidden="true"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* 10. Final CTA */}
        <section id="cta" className="border-t border-border">
          <div className="mx-auto max-w-4xl px-4 py-16 text-center md:px-6 md:py-20">
            <MessageCircle
              className="mx-auto mb-4 h-10 w-10 text-brand"
              aria-hidden="true"
            />
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Stop missing WhatsApp messages. Start closing more sales.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Set up your AI assistant today and let {BRAND.name} answer your
              customers while you focus on running your business.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button size="lg" className="text-base" onClick={props.onGetStarted}>
                Get started
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-base"
                onClick={props.onDemo}
              >
                Explore demo
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* 11. Footer */}
      <footer className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-4 py-10 md:px-6">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row md:items-start">
            <div className="flex flex-col items-center gap-2 md:items-start">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-brand-foreground">
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="font-bold">{BRAND.name}</span>
              </div>
              <p className="max-w-xs text-center text-sm text-muted-foreground md:text-left">
                The AI WhatsApp Business assistant for Nigerian SMEs.
              </p>
            </div>
            <nav aria-label="Footer navigation" className="flex flex-wrap justify-center gap-x-6 gap-y-2">
              {NAV_ITEMS.map((item: NavItem) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.label}
                </a>
              ))}
              <a
                href="#example"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Example
              </a>
              <a
                href="#usecases"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Use cases
              </a>
            </nav>
          </div>
          <Separator className="my-6" />
          <div className="flex flex-col items-center gap-2 text-center text-xs text-muted-foreground md:flex-row md:justify-between md:text-left">
            <p>
              {BRAND.name} uses the official Meta WhatsApp Business Platform. Not
              affiliated with Meta.
            </p>
            <p>© {new Date().getFullYear()} {BRAND.name}. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
