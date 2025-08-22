import { Router } from "express";
import { db } from "../lib/supabase.js";

const router = Router();

router.get("/", (req, res) => {
  res.json({ message: "Backend Supabase OK 🚀" });
});

router.post("/register", async (req, res) => {
  const { email, password, full_name, role } = req.body;
  if (!["student", "teacher"].includes(role)) {
    return res.status(400).json({ success: false, error: "Role không hợp lệ" });
  }

  const { data, error } = await db.auth.signUp({ email, password });
  if (error) return res.status(400).json({ success: false, error: error.message });

  const user = data.user;
  const { error: insertError } = await db
    .from("users")
    .insert([{ id: user.id, full_name, email, role }]);

  if (insertError) {
    return res.status(400).json({ success: false, error: insertError.message });
  }
  res.json({ success: true, user });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) return res.status(400).json({ success: false, error: error.message });

  const { data: userInfo, error: userError } = await db
    .from("users")
    .select("full_name, role")
    .eq("id", data.user.id)
    .single();

  if (userError) return res.status(400).json({ success: false, error: userError.message });

  res.json({
    success: true,
    token: data.session.access_token,
    user: {
      id: data.user.id,
      email: data.user.email,
      full_name: userInfo.full_name,
      role: userInfo.role,
    },
  });
});

router.get("/profile", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });

  const { data, error } = await db.auth.getUser(token);
  if (error) return res.status(401).json({ error: error.message });

  const { data: userInfo, error: userError } = await db
    .from("users")
    .select("full_name, role")
    .eq("id", data.user.id)
    .single();

  if (userError) return res.status(400).json({ error: userError.message });

  res.json({
    user: {
      id: data.user.id,
      email: data.user.email,
      full_name: userInfo.full_name,
      role: userInfo.role,
    },
  });
});

export default router;
