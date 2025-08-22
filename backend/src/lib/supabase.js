// src/lib/supabase.js
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

// Dùng 1 client duy nhất (service role) cho TẤT CẢ truy vấn và auth.getUser
export const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
