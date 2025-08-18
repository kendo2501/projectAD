import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ✅ API test
app.get("/", (req, res) => {
  res.json({ message: "Backend Supabase OK 🚀" });
});

// ✅ API register (student / teacher)
app.post("/api/register", async (req, res) => {
  const { email, password, full_name, role } = req.body;

  if (!["student", "teacher"].includes(role)) {
    return res.status(400).json({ success: false, error: "Role không hợp lệ" });
  }

  // 1. Tạo tài khoản auth (supabase.auth)
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return res.status(400).json({ success: false, error: error.message });

  const user = data.user;

  // 2. Lưu thêm thông tin vào table `users`
  const { error: insertError } = await supabase
    .from("users")
    .insert([
      {
        id: user.id, // id trùng với auth.uid
        full_name,
        email,
        role, // thêm cột role
      },
    ]);

  if (insertError) {
    return res.status(400).json({ success: false, error: insertError.message });
  }

  res.json({ success: true, user });
});

// ✅ API login bằng email + password
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return res.status(400).json({ success: false, error: error.message });
  }

  // Lấy role từ bảng users
  const { data: userInfo, error: userError } = await supabase
    .from("users")
    .select("full_name, role")
    .eq("id", data.user.id)
    .single();

  if (userError) {
    return res.status(400).json({ success: false, error: userError.message });
  }

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

// ✅ API protected (chỉ user login mới vào được)
app.get("/api/profile", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });

  const { data, error } = await supabase.auth.getUser(token);
  if (error) return res.status(401).json({ error: error.message });

  // Lấy thêm role
  const { data: userInfo, error: userError } = await supabase
    .from("users")
    .select("full_name, role")
    .eq("id", data.user.id)
    .single();

  if (userError) {
    return res.status(400).json({ error: userError.message });
  }

  res.json({
    user: {
      id: data.user.id,
      email: data.user.email,
      full_name: userInfo.full_name,
      role: userInfo.role,
    },
  });
});

// 🚀 Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
