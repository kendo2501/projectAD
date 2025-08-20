import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth, requireStudent } from "../middleware/requireAuth.js";

const router = Router();

/**
 * Body:
 * {
 *   answers: [{ question_id: number, choice_id: number }, ...]
 * }
 */
router.post("/:examId/submit", requireAuth, requireStudent, async (req, res) => {
  const examId = req.params.examId;
  const { answers } = req.body;

  if (!Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ error: "Thiếu answers" });
  }

  // Kiểm tra thời gian làm bài
  const { data: exam, error: examErr } = await supabase
    .from("exams")
    .select("id, starts_at, ends_at")
    .eq("id", examId)
    .single();
  if (examErr) return res.status(400).json({ error: examErr.message });

  const now = new Date();
  if (!(now >= new Date(exam.starts_at) && now <= new Date(exam.ends_at))) {
    return res.status(400).json({ error: "Không nằm trong thời gian làm bài" });
  }

  // Tạo submission (unique (exam_id, student_id))
  const { data: sub, error: subErr } = await supabase
    .from("submissions")
    .insert([{ exam_id: examId, student_id: req.user.id }])
    .select("id")
    .single();

  if (subErr) {
    // Nếu đã có submission, có thể chặn hoặc cho phép cập nhật (tuỳ chính sách của bạn)
    return res.status(400).json({ error: subErr.message });
  }

  // Lưu answers
  const toInsert = answers.map(a => ({
    submission_id: sub.id,
    question_id: a.question_id,
    choice_id: a.choice_id
  }));
  const { error: ansErr } = await supabase.from("answers").insert(toInsert);
  if (ansErr) return res.status(400).json({ error: ansErr.message });

  // Chấm điểm: đếm số đáp án đúng
  // Lấy các choice đúng cho các question đã trả lời
  const qIds = answers.map(a => a.question_id);
  const { data: correctChoices, error: cErr } = await supabase
    .from("choices")
    .select("id, question_id, is_correct")
    .in("question_id", qIds)
    .eq("is_correct", true);

  if (cErr) return res.status(400).json({ error: cErr.message });

  const correctMap = new Map(correctChoices.map(c => [c.question_id, c.id]));
  let correct = 0;
  for (const a of answers) {
    if (correctMap.get(a.question_id) === a.choice_id) correct++;
  }

  const total = answers.length;
  const score = Math.round((correct / total) * 100); // % đúng, tuỳ bạn quy đổi

  res.json({ submission_id: sub.id, correct, total, score });
});

export default router;
