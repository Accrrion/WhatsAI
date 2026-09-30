import * as React from "react";
import { api, onModeChange, type Bootstrap, type Mode, ApiError } from "@/api";

export type Route =
  | "landing" | "overview" | "conversations" | "customers" | "leads"
  | "products" | "orders" | "knowledge" | "assistant" | "whatsapp"
  | "analytics" | "settings" | "onboarding";

interface AppState {
  mode: Mode;
  loading: boolean;
  authError: boolean;
  data: Bootstrap | null;
  route: Route;
  setRoute: (r: Route) => void;
  refresh: () => Promise<void>;
  update: (patch: Partial<Bootstrap>) => void;
}

const Ctx = React.createContext<AppState | null>(null);
export const useApp = () => {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useApp outside provider");
  return v;
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = React.useState<Mode>("unknown");
  const [loading, setLoading] = React.useState(true);
  const [authError, setAuthError] = React.useState(false);
  const [data, setData] = React.useState<Bootstrap | null>(null);
  const [route, setRoute] = React.useState<Route>("landing");

  React.useEffect(() => onModeChange(setMode), []);

  const refresh = React.useCallback(async () => {
    try {
      const b = await api.bootstrap();
      setData(b);
      setAuthError(false);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) { setAuthError(true); setRoute("landing"); }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { refresh(); }, [refresh]);

  const update = React.useCallback((patch: Partial<Bootstrap>) => setData((d) => (d ? { ...d, ...patch } : d)), []);

  const value: AppState = { mode, loading, authError, data, route, setRoute, refresh, update };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
