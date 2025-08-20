import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth, requireTeacher } from "../middleware/requireAuth.js";

const router = Router();

// kiểm tra quyền sở hữu choice theo teacher
async function ensureOwnsChoice(choiceId, teacherId) {
  const { data: choice, error: cErr } = await supabase
    .from("choices")
    .select("id, question_id")
    .eq("id", choiceId)
    .single();
  if (cErr || !choice) return { error: "Choice not found" };

  const { data: q, error: qErr } = await supabase
    .from("questions")
    .select("id, exam_id")
    .eq("id", choice.question_id)
    .single();
  if (qErr || !q) return { error: "Question not found" };

  const { data: exam, error: eErr } = await supabase
    .from("exams")
    .select("id, teacher_id")
    .eq("id", q.exam_id)
    .single();
  if (eErr || !exam) return { error: "Exam not found" };

  if (exam.teacher_id !== teacherId) return { error: "Not your exam" };
  return { choice, question: q };
}

// Sửa 1 đáp án: content và/hoặc is_correct
router.put("/:id", requireAuth, requireTeacher, async (req, res) => {
  const id = req.params.id;
  const { content, is_correct } = req.body ?? {};

  const check = await ensureOwnsChoice(id, req.user.id);
  if (check.error) return res.status(403).json({ error: check.error });

  // nếu set đúng, clear các đáp án khác
  if (is_correct === true) {
    const { error: clrErr } = await supabase
      .from("choices")
      .update({ is_correct: false })
      .eq("question_id", check.question.id);
    if (clrErr) return res.status(400).json({ error: clrErr.message });
  }

  const patch = {};
  if (content !== undefined) patch.content = content;
  if (is_correct !== undefined) patch.is_correct = !!is_correct;

  if (Object.keys(patch).length === 0) return res.json({ success: true });

  const { error } = await supabase.from("choices").update(patch).eq("id", id);
  if (error) return res.status(400).json({ error: error.message });

  res.json({ success: true });
});

export default router;
