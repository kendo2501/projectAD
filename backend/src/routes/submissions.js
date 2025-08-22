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
  const studentId = req.user.id;
  const examId = String(req.params.examId || "").trim();
  const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
  if (!examId) return res.status(400).json({ error: "Bad examId" });
  if (!answers.length) return res.status(400).json({ error: "No answers" });

  const { data: exam, error: eExam } = await db
    .from("exams").select("id, starts_at, ends_at").eq("id", examId).maybeSingle();
  if (eExam) return res.status(400).json({ error: eExam.message });
  if (!exam) return res.status(404).json({ error: "Exam not found" });

  const now = new Date();
  if (exam.starts_at && new Date(exam.starts_at) > now) {
    return res.status(403).json({ error: "Chưa đến giờ làm bài" });
  }
  if (exam.ends_at && new Date(exam.ends_at) < now) {
    return res.status(403).json({ error: "Đã hết thời gian làm bài" });
  }

  const { data: existed, error: eExist } = await db
    .from("submissions").select("id")
    .eq("exam_id", examId).eq("student_id", studentId).maybeSingle();
  if (eExist) return res.status(400).json({ error: eExist.message });
  if (existed) return res.status(409).json({ error: "Bạn đã nộp bài này rồi" });

  const { data: sub, error: eSub } = await db
    .from("submissions").insert([{ exam_id: examId, student_id: studentId }])
    .select("id, submitted_at").single();
  if (eSub) return res.status(400).json({ error: eSub.message });

  const submissionId = sub.id;

  const { data: qRows, error: eQ } = await db
    .from("questions").select("id").eq("exam_id", examId);
  if (eQ) return res.status(400).json({ error: eQ.message });

  const allowedQ = new Set((qRows || []).map((q) => q.id));
  const cleaned = answers
    .map(a => ({ submission_id: submissionId, question_id: Number(a.question_id), choice_id: Number(a.choice_id) }))
    .filter(a => Number.isFinite(a.question_id) && Number.isFinite(a.choice_id) && allowedQ.has(a.question_id));
  if (!cleaned.length) return res.status(400).json({ error: "No valid answers for this exam" });

  const { error: eAns } = await db.from("answers").insert(cleaned);
  if (eAns) return res.status(400).json({ error: eAns.message });

  const { data: correctChoices, error: eC } = await db
    .from("choices").select("question_id, id").eq("is_correct", true)
    .in("question_id", [...allowedQ]);
  if (eC) return res.status(400).json({ error: eC.message });

  const cmap = new Map((correctChoices || []).map(c => [c.question_id, c.id]));
  let correct = 0;
  for (const a of cleaned) if (cmap.get(a.question_id) === a.choice_id) correct++;
  const total = allowedQ.size;
  const score100 = total ? Math.round((correct / total) * 100) : 0;

  res.json({ submission_id: submissionId, correct, total, score100, submitted_at: sub.submitted_at });
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
