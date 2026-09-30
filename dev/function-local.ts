// Local Deno dev server for the Edge Function (optional).
// The primary local test harness is dev/run-local.mjs (Node, no Deno required).
// To use this: deno run --allow-net --allow-env dev/function-local.ts
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { serveSite } from "../functions/adapter.mjs";
import { handle } from "../functions/handler.mjs";

const fetch = serveSite(handle, {
  createClient,
  env: (name: string) => Deno.env.get(name),
});

Deno.serve({ hostname: "127.0.0.1", port: 8000 }, fetch);
