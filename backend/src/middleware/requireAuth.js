import { supabase } from "../lib/supabase.js";

export async function requireAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Missing token" });

    // Lấy user từ access token
    const { data: getUserData, error: getUserErr } = await supabase.auth.getUser(token);
    if (getUserErr || !getUserData?.user) {
      return res.status(401).json({ error: getUserErr?.message || "Invalid token" });
    }
    const authed = getUserData.user;

    // Lấy role/full_name từ bảng users
    const { data: profile, error: profErr } = await supabase
      .from("users")
      .select("full_name, role")
      .eq("id", authed.id)
      .single();

    if (profErr) return res.status(400).json({ error: profErr.message });

    req.user = {
      id: authed.id,
      email: authed.email,
      full_name: profile.full_name,
      role: profile.role, // 'teacher' | 'student'
    };
    next();
  } catch (e) {
    next(e);
  }
}

export function requireTeacher(req, res, next) {
  if (req.user?.role !== "teacher") {
    return res.status(403).json({ error: "Teacher only" });
  }
  next();
}

export function requireStudent(req, res, next) {
  if (req.user?.role !== "student") {
    return res.status(403).json({ error: "Student only" });
  }
  next();
}
