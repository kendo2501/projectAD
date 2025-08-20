// src/lib/supabase.js
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
// BẮT BUỘC dùng service role key ở backend
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  throw new Error("Missing SUPABASE_URL (check your .env)");
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  // KHÔNG cho fallback sang ANON KEY để tránh dính RLS
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY in .env (do NOT use anon key on backend)");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  // tuỳ chọn: gắn header phân biệt client
  global: {
    headers: { "X-Client-Info": "backend-service" },
  },
});
