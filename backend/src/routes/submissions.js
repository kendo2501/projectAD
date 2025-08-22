// src/routes/submissions.js
import { Router } from "express";
import { db } from "../lib/supabase.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

// Dùng một client thống nhất


/**
 * POST /api/submissions/:examId/submit
 * Body: { answers: [{question_id, choice_id}, ...] }
 * Trả:  { submission_id, correct, total, score100, submitted_at }
 */
router.post("/:examId/submit", requireAuth, async (req, res) => {
  try {
    const examId = String(req.params.examId || "").trim();
    const { answers } = req.body;
    const studentId = req.user.id;

    // 1) tạo submission
    const { data: sub, error: sErr } = await db
      .from("submissions")
      .insert({
        exam_id: examId,
        student_id: studentId,
        submitted_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (sErr) return res.status(400).json({ error: sErr.message });

    // 2) insert answers
    const rows = (answers || []).map((a) => ({
      submission_id: sub.id,
      question_id: a.question_id,
      choice_id: a.choice_id,
    }));

    const { error: aErr } = await db.from("answers").insert(rows);
    if (aErr) return res.status(400).json({ error: aErr.message });

    return res.json({ submission_id: sub.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
/**
 * GET /api/submissions/mine/latest
 * Trả bài nộp gần nhất của user (kèm chấm điểm)
 */
router.get("/mine/latest", requireAuth, async (req, res) => {
  try {
    const studentId = req.user.id;

    // Lấy bài nộp gần nhất (kèm tiêu đề đề thi)
    const { data: latest, error: eFind } = await db
      .from("submissions")
      .select("id, exam_id, submitted_at, exams(title, description)")
      .eq("student_id", studentId)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (eFind) return res.status(400).json({ error: eFind.message });
    if (!latest) return res.json(null);

    // ID các câu hỏi của đề
    const { data: qRows, error: qErr } = await db
      .from("questions")
      .select("id")
      .eq("exam_id", latest.exam_id);
    if (qErr) return res.status(400).json({ error: qErr.message });

    const qIds = (qRows || []).map((q) => q.id);
    const total = qIds.length;

    // Các đáp án đã chọn của submission này
    const { data: ansRows, error: aErr } = await db
      .from("answers")
      .select("question_id, choice_id")
      .eq("submission_id", latest.id);
    if (aErr) return res.status(400).json({ error: aErr.message });

    // Đáp án đúng của các câu hỏi
    const { data: correctRows, error: cErr } = await db
      .from("choices")
      .select("question_id, id")
      .eq("is_correct", true)
      .in("question_id", qIds);
    if (cErr) return res.status(400).json({ error: cErr.message });

    const correctMap = new Map((correctRows || []).map((c) => [c.question_id, c.id]));
    let correct = 0;
    for (const a of ansRows || []) {
      if (correctMap.get(a.question_id) === a.choice_id) correct++;
    }

    return res.json({
      title: latest.exams?.title || null,
      description: latest.exams?.description || null,
      correct,
      total,
      submitted_at: latest.submitted_at,
    });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Fetch failed" });
  }
});

export default router;
