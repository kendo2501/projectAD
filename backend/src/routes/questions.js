import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth, requireTeacher } from "../middleware/requireAuth.js";

const router = Router();

/** Tạo 1 câu hỏi cho 1 exam */
router.post("/:examId", requireAuth, requireTeacher, async (req, res) => {
  try {
    const examId = req.params.examId;
    const { content, meta = {} } = req.body || {};

    if (!content?.trim()) {
      return res.status(400).json({ error: "Thiếu nội dung câu hỏi" });
    }

    // Kiểm tra quyền sở hữu đề
    const { data: exam, error: e1 } = await supabase
      .from("exams")
      .select("id, teacher_id, max_questions")
      .eq("id", examId)
      .single();
    if (e1 || !exam) return res.status(404).json({ error: "Exam not found" });
    if (exam.teacher_id !== req.user.id)
      return res.status(403).json({ error: "Not your exam" });

    // (Có thể giới hạn số câu hỏi theo max_questions nếu muốn)
    const { data: cntRows } = await supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("exam_id", examId);
    const count = cntRows?.length ?? 0;
    if (exam.max_questions && count >= exam.max_questions) {
      return res.status(400).json({ error: "Vượt quá số câu tối đa của đề" });
    }

    const { data, error } = await supabase
      .from("questions")
      .insert([{ exam_id: examId, content: content.trim(), meta }])
      .select("id")
      .single();

    if (error) return res.status(400).json({ error: error.message });

    // TRẢ VỀ CẢ 2 DẠNG key cho app an toàn
    res.json({ question_id: data.id, id: data.id });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

/** Sửa nội dung câu hỏi */
router.put("/:id", requireAuth, requireTeacher, async (req, res) => {
  try {
    const id = req.params.id;
    const { content } = req.body || {};
    if (!content?.trim()) return res.status(400).json({ error: "Thiếu content" });

    // Quyền sở hữu: join sang exams
    const { data: q, error: e1 } = await supabase
      .from("questions")
      .select("id, exam_id, exams!inner(teacher_id)")
      .eq("id", id)
      .single();
    if (e1 || !q) return res.status(404).json({ error: "Question not found" });
    if (q.exams.teacher_id !== req.user.id)
      return res.status(403).json({ error: "Not your exam" });

    const { error: e2 } = await supabase
      .from("questions")
      .update({ content: content.trim() })
      .eq("id", id);
    if (e2) return res.status(400).json({ error: e2.message });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

/** Thêm đáp án cho 1 câu hỏi (2 hoặc 4 đáp án, đúng 1) */
router.post("/:questionId/choices", requireAuth, requireTeacher, async (req, res) => {
  try {
    const questionId = req.params.questionId;
    const { choices = [] } = req.body || {};

    // Quyền sở hữu
    const { data: q, error: e1 } = await supabase
      .from("questions")
      .select("id, exam_id, exams!inner(teacher_id)")
      .eq("id", questionId)
      .single();
    if (e1 || !q) return res.status(404).json({ error: "Question not found" });
    if (q.exams.teacher_id !== req.user.id)
      return res.status(403).json({ error: "Not your exam" });

    const cleaned = (choices || [])
      .map(c => ({ content: String(c.content ?? "").trim(), is_correct: !!c.is_correct }))
      .filter(c => c.content.length > 0);

    if (![2, 4].includes(cleaned.length)) {
      return res.status(400).json({ error: "Choices must be 2 or 4" });
    }
    if (cleaned.filter(c => c.is_correct).length !== 1) {
      return res.status(400).json({ error: "Must have exactly 1 correct choice" });
    }

    const payload = cleaned.map(c => ({ question_id: questionId, ...c }));
    const { error: e2 } = await supabase.from("choices").insert(payload);
    if (e2) return res.status(400).json({ error: e2.message });

    res.json({ inserted: payload.length });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

/** Thay toàn bộ đáp án của 1 câu hỏi */
router.put("/:questionId/choices", requireAuth, requireTeacher, async (req, res) => {
  try {
    const questionId = req.params.questionId;
    const { choices = [] } = req.body || {};

    // Quyền sở hữu
    const { data: q, error: e1 } = await supabase
      .from("questions")
      .select("id, exam_id, exams!inner(teacher_id)")
      .eq("id", questionId)
      .single();
    if (e1 || !q) return res.status(404).json({ error: "Question not found" });
    if (q.exams.teacher_id !== req.user.id)
      return res.status(403).json({ error: "Not your exam" });

    const cleaned = (choices || [])
      .map(c => ({ content: String(c.content ?? "").trim(), is_correct: !!c.is_correct }))
      .filter(c => c.content.length > 0);

    if (![2, 4].includes(cleaned.length)) {
      return res.status(400).json({ error: "Choices must be 2 or 4" });
    }
    if (cleaned.filter(c => c.is_correct).length !== 1) {
      return res.status(400).json({ error: "Must have exactly 1 correct choice" });
    }

    // Xoá cũ → chèn mới
    const { error: dErr } = await supabase.from("choices").delete().eq("question_id", questionId);
    if (dErr) return res.status(400).json({ error: dErr.message });

    const payload = cleaned.map(c => ({ question_id: questionId, ...c }));
    const { error: iErr } = await supabase.from("choices").insert(payload);
    if (iErr) return res.status(400).json({ error: iErr.message });

    res.json({ replaced: payload.length });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

export default router;
