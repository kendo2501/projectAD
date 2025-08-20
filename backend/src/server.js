import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.js";
import examsRoutes from "./routes/exams.js";
import questionsRoutes from "./routes/questions.js";
import submissionsRoutes from "./routes/submissions.js";
import { sendError } from "./utils/errors.js";
import choicesRouter from "./routes/choices.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.json({ message: "Backend Supabase OK 🚀" });
});

// Mount routes
app.use("/api", authRoutes);                 // /api/register, /api/login, ...
app.use("/api/exams", examsRoutes);
app.use("/api/choices", choicesRouter);          // /api/exams/...
app.use("/api/questions", questionsRoutes);  // /api/questions/...
app.use("/api/submissions", submissionsRoutes);

// Error handlers (đặt SAU routes)
app.use(sendError); // custom error handler của bạn (phải có (err, req, res, next))

// Fallback đơn giản nếu có lỗi chưa bắt
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "Internal error" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
