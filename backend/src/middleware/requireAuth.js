// src/middleware/requireAuth.js
import { db } from "../lib/supabase.js";

export async function requireAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: "No token" });

    const { data, error } = await db.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: "Invalid token" });

    const uid = data.user.id;

    // Lấy profile/role từ bảng users (service-role bypass RLS)
    const { data: urow, error: uerr } = await db
      .from("users")
      .select("id, email, full_name, role")
      .eq("id", uid)
      .maybeSingle();
    if (uerr) return res.status(400).json({ error: uerr.message });

    req.user = {
      id: uid,
      email: urow?.email || data.user.email || null,
      full_name: urow?.full_name || null,
      role: (urow?.role || "").toString().trim().toLowerCase(),
    };

    next();
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Auth failed" });
  }
}

export function requireTeacher(req, res, next) {
  const role = (req.user?.role || "").toLowerCase();
  if (role === "student") {
    return res.status(403).json({ error: "Teacher only" });
  }
  next();
}
