import { AppProvider, useApp } from "@/store";
import { Toaster } from "@/components/ui/sonner";
import { Spinner } from "@/components/ui/spinner";
import { BRAND } from "@/lib/config";
import Landing from "@/components/Landing";
import AppShell from "@/components/app/AppShell";

function Splash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <span className="grid size-8 place-items-center rounded-lg bg-brand text-brand-foreground">W</span>
        {BRAND.name}
      </div>
      <Spinner className="size-5 text-muted-foreground" />
    </div>
  );
}

function Router() {
  const { route, loading, authError, setRoute, refresh } = useApp();
  if (loading) return <Splash />;
  if (route === "landing") {
    const enter = () => { refresh(); setRoute("overview"); };
    return <Landing onGetStarted={enter} onDemo={enter} authError={authError} />;
  }
  return <AppShell />;
}

export default function App() {
  return (
    <AppProvider>
      <Router />
      <Toaster richColors position="top-right" />
    </AppProvider>
  );
}
