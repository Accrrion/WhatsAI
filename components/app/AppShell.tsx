import * as React from "react";
import {
  LayoutDashboard, MessagesSquare, Users, Target, Package, ShoppingCart,
  BookOpen, Bot, Smartphone, BarChart3, Settings as SettingsIcon, LogOut, ExternalLink,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarProvider, SidebarTrigger, SidebarRail,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { BRAND } from "@/lib/config";
import { useApp, type Route } from "@/store";
import { ModeBadge, AiModeBadge } from "./shared";
import Overview from "./pages/Overview";
import Conversations from "./pages/Conversations";
import Customers from "./pages/Customers";
import Leads from "./pages/Leads";
import Products from "./pages/Products";
import Orders from "./pages/Orders";
import Knowledge from "./pages/Knowledge";
import TestAssistant from "./pages/TestAssistant";
import WhatsAppPage from "./pages/WhatsAppPage";
import Analytics from "./pages/Analytics";
import SettingsPage from "./pages/Settings";
import Onboarding from "./pages/Onboarding";

const NAV: { group: string; items: { route: Route; label: string; icon: React.ComponentType<{ className?: string }> }[] }[] = [
  { group: "Workspace", items: [
    { route: "overview", label: "Dashboard", icon: LayoutDashboard },
    { route: "conversations", label: "Conversations", icon: MessagesSquare },
    { route: "customers", label: "Customers", icon: Users },
    { route: "leads", label: "Leads", icon: Target },
    { route: "products", label: "Products", icon: Package },
    { route: "orders", label: "Orders", icon: ShoppingCart },
  ] },
  { group: "Knowledge & AI", items: [
    { route: "knowledge", label: "Knowledge base", icon: BookOpen },
    { route: "assistant", label: "Test assistant", icon: Bot },
    { route: "whatsapp", label: "WhatsApp", icon: Smartphone },
  ] },
  { group: "Insights", items: [
    { route: "analytics", label: "Analytics", icon: BarChart3 },
    { route: "settings", label: "Settings", icon: SettingsIcon },
  ] },
];

function Logo() {
  return (
    <div className="flex items-center gap-2 px-1">
      <span className="grid size-8 place-items-center rounded-lg bg-brand text-brand-foreground">
        <MessagesSquare className="size-4.5" />
      </span>
      <span className="text-sm font-semibold tracking-tight">{BRAND.name}</span>
    </div>
  );
}

function Page({ route }: { route: Route }) {
  switch (route) {
    case "conversations": return <Conversations />;
    case "customers": return <Customers />;
    case "leads": return <Leads />;
    case "products": return <Products />;
    case "orders": return <Orders />;
    case "knowledge": return <Knowledge />;
    case "assistant": return <TestAssistant />;
    case "whatsapp": return <WhatsAppPage />;
    case "analytics": return <Analytics />;
    case "settings": return <SettingsPage />;
    case "overview":
    default: return <Overview />;
  }
}

export default function AppShell() {
  const { data, mode, route, setRoute } = useApp();
  const business = data?.business;
  const initials = (business?.name || BRAND.name).split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  if (!business || route === "onboarding") {
    return <Onboarding />;
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible="offcanvas">
        <SidebarHeader className="border-b border-sidebar-border py-3"><Logo /></SidebarHeader>
        <SidebarContent>
          {NAV.map((section) => (
            <SidebarGroup key={section.group}>
              <SidebarGroupLabel>{section.group}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => (
                    <SidebarMenuItem key={item.route}>
                      <SidebarMenuButton isActive={route === item.route} onClick={() => setRoute(item.route)} tooltip={item.label}>
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter>
          <Separator className="mb-1" />
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => setRoute("landing")} tooltip="Back to site">
                <ExternalLink /><span>Marketing site</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur sm:px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 h-4" />
          <div className="flex min-w-0 items-center gap-2">
            <Avatar className="size-6"><AvatarFallback className="text-[10px]">{initials}</AvatarFallback></Avatar>
            <span className="truncate text-sm font-medium">{business.name}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <AiModeBadge provider={data?.aiProvider} />
            <ModeBadge mode={mode} />
          </div>
        </header>
        <div className="flex-1 p-3 sm:p-5">
          <Page route={route} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
