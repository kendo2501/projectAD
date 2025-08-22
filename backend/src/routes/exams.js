// src/routes/exams.js
import { Router } from "express";
import { db } from "../lib/supabase.js";
import { requireAuth, requireTeacher } from "../middleware/requireAuth.js";

const router = Router();

/* =========================
   1) Teacher tạo đề
========================= */
router.post("/", requireAuth, requireTeacher, async (req, res) => {
  try {
    const { title, description, starts_at, ends_at, max_questions = 60 } = req.body;
    if (!title || !starts_at || !ends_at) {
      return res.status(400).json({ error: "Thiếu title/starts_at/ends_at" });
    }
    if (new Date(ends_at) <= new Date(starts_at)) {
      return res.status(400).json({ error: "ends_at phải sau starts_at" });
    }

    const { data, error } = await db
      .from("exams")
      .insert([{
        teacher_id: req.user.id,
        title: String(title).trim(),
        description: description ?? null,
        starts_at,
        ends_at,
        max_questions: Math.max(1, Math.min(60, Number(max_questions) || 60)),
      }])
      .select("id, key_code")
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.json({ exam_id: data.id, key_code: data.key_code });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

/* =========================
   2) Teacher xem list đề của mình
========================= */
router.get("/mine", requireAuth, requireTeacher, async (req, res) => {
  const { data, error } = await db
    .from("exams")
    .select("id, title, key_code, starts_at, ends_at, max_questions, created_at")
    .eq("teacher_id", req.user.id)
    .order("created_at", { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data || []);
});

/* =========================
   3) Student nhập mã 6 số -> trả về thông tin đề (còn thời gian)
========================= */
router.get("/join/:code", async (req, res) => {
  const code = String(req.params.code || "").trim();

  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: "Mã phải gồm 6 chữ số" });
  }

  const { data: rows, error } = await db
    .from("exams")
    .select("id, title, description, starts_at, ends_at, max_questions, key_code")
    .eq("key_code", code);

  if (error) return res.status(400).json({ error: error.message });
  if (!rows?.length) return res.status(404).json({ error: "Mã không hợp lệ" });

  const exam = rows[0];

  // kiểm tra thời gian ở Node
  const now = new Date();
  if (exam.starts_at && new Date(exam.starts_at) > now) {
    return res.status(403).json({ error: "Chưa đến giờ làm bài" });
  }
  if (exam.ends_at && new Date(exam.ends_at) < now) {
    return res.status(403).json({ error: "Đã hết thời gian làm bài" });
  }

  return res.json(exam);
});


/* =========================
   4) Lấy câu hỏi + đáp án cho học sinh làm bài
========================= */
router.get("/:examId/questions", async (req, res) => {
  try {
    const examId = String(req.params.examId ?? "").trim();
    if (!examId) return res.status(400).json({ error: "Bad examId" });

    // check đề tồn tại
    const { data: ex, error: e0 } = await db
      .from("exams")
      .select("id")
      .eq("id", examId)
      .maybeSingle();
    if (e0) return res.status(400).json({ error: e0.message });
    if (!ex) return res.status(404).json({ error: "Exam not found" });

    const { data, error } = await db
      .from("questions")
      .select("id, content, meta, choices:choices(id, content, is_correct)")
      .eq("exam_id", examId)
      .order("id", { ascending: true })
      .order("id", { foreignTable: "choices", ascending: true });

    if (error) return res.status(400).json({ error: error.message });

    const out = (data || []).map((q) => ({
      id: q.id,
      content: String(q.content ?? ""),
      meta: q.meta ?? null,
      choices: (q.choices || []).map((c) => ({
        id: c.id,
        content: String(c.content ?? ""),
        is_correct: !!c.is_correct, // client không dùng field này, nhưng tuỳ bạn muốn có/ẩn
      })),
    }));

    if (out.length === 0) {
      return res.status(404).json({ error: "Exam has no questions yet" });
    }

    return res.json(out);
  } catch (err) {
    return res.status(500).json({ error: err?.message || String(err) });
  }
});


/* =========================
   5) Teacher xem điểm (bản đơn giản – CHỈ 1 ROUTE)
========================= */
router.get("/:examId/grades", requireAuth, requireTeacher, async (req, res) => {
  try {
    const examId = String(req.params.examId || "").trim();
    if (!examId) return res.status(400).json({ error: "Bad examId" });

    // 1) Xác thực: đề thuộc giáo viên này
    const { data: exam, error: eExam } = await db
      .from("exams")
      .select("id, teacher_id")
      .eq("id", examId)
      .maybeSingle();
    if (eExam) return res.status(400).json({ error: eExam.message });
    if (!exam || exam.teacher_id !== req.user.id)
      return res.status(403).json({ error: "Không có quyền xem đề này" });

    // 2) Lấy submissions của đề
    const { data: subs, error: sErr } = await db
      .from("submissions")
      .select("id, student_id, submitted_at")
      .eq("exam_id", examId)
      .order("submitted_at", { ascending: false });
    if (sErr) return res.status(400).json({ error: sErr.message });
    if (!subs?.length) return res.json({ total_rows: 0, rows: [] });

    // 3) ID câu hỏi của đề
    const { data: qRows, error: qErr } = await db
      .from("questions")
      .select("id")
      .eq("exam_id", examId);
    if (qErr) return res.status(400).json({ error: qErr.message });
    const qIds = (qRows || []).map((q) => q.id);
    const totalQuestions = qIds.length;

    // 4) Tất cả answers của các submissions
    const subIds = subs.map((s) => s.id);
    const { data: aRows, error: aErr } = await db
      .from("answers")
      .select("submission_id, question_id, choice_id")
      .in("submission_id", subIds);
    if (aErr) return res.status(400).json({ error: aErr.message });

    // 5) Đáp án đúng
    const { data: cRows, error: cErr } = await db
      .from("choices")
      .select("question_id, id")
      .eq("is_correct", true)
      .in("question_id", qIds);
    if (cErr) return res.status(400).json({ error: cErr.message });
    const correctMap = new Map((cRows || []).map((c) => [c.question_id, c.id]));

    // 6) Thông tin học sinh
    const studentIds = [...new Set(subs.map((s) => s.student_id).filter(Boolean))];
    const { data: users, error: uErr } = await db
      .from("users")
      .select("id, full_name, email")
      .in("id", studentIds);
    if (uErr) return res.status(400).json({ error: uErr.message });
    const userMap = new Map((users || []).map((u) => [u.id, u]));

    // Gom answers theo submission
    const bySub = new Map();
    for (const a of aRows || []) {
      if (!bySub.has(a.submission_id)) bySub.set(a.submission_id, []);
      bySub.get(a.submission_id).push(a);
    }

    // 7) Tính điểm
    const rows = subs.map((s) => {
      const list = bySub.get(s.id) || [];
      let correct = 0;
      for (const a of list) if (correctMap.get(a.question_id) === a.choice_id) correct++;

      const total = totalQuestions;
      const score_pct = total ? Math.round((correct / total) * 100) : 0;
      const score10 = total ? Math.round(((correct / total) * 10) * 10) / 10 : 0;

      const u = userMap.get(s.student_id) || {};
      return {
        submission_id: s.id,
        student_id: s.student_id,
        full_name: u.full_name || null,
        email: u.email || null,
        correct,
        total,
        score_pct,
        score10,
        submitted_at: s.submitted_at,
      };
    });

    return res.json({ total_rows: rows.length, rows });
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
});


/* =========================
   6) Sửa thời gian / thông tin đề
========================= */
router.put("/:id", requireAuth, requireTeacher, async (req, res) => {
  try {
    const examId = String(req.params.id);
    const { starts_at, ends_at, title, description, max_questions } = req.body;

    if (!starts_at || !ends_at)
      return res.status(400).json({ error: "starts_at và ends_at là bắt buộc" });
    if (new Date(ends_at) <= new Date(starts_at))
      return res.status(400).json({ error: "ends_at phải sau starts_at" });

    const { data: exam, error: e1 } = await db
      .from("exams")
      .select("id, teacher_id")
      .eq("id", examId)
      .maybeSingle();
    if (e1) return res.status(400).json({ error: e1.message });
    if (!exam) return res.status(404).json({ error: "Exam not found" });
    if (exam.teacher_id !== req.user.id)
      return res.status(403).json({ error: "Not your exam" });

    const patch = { starts_at, ends_at };
    if (title !== undefined) patch.title = String(title || "").trim();
    if (description !== undefined) patch.description = description ?? null;
    if (max_questions !== undefined)
      patch.max_questions = Math.max(1, Math.min(60, Number(max_questions) || 60));

    const { error: e2 } = await db.from("exams").update(patch).eq("id", examId);
    if (e2) return res.status(400).json({ error: e2.message });

    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

/* =========================
   7) Xoá đề (ON DELETE CASCADE)
========================= */
router.delete("/:id", requireAuth, requireTeacher, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: exam, error: e1 } = await db
      .from("exams")
      .select("id")
      .eq("id", id)
      .eq("teacher_id", req.user.id)
      .maybeSingle();

    if (e1) return res.status(400).json({ error: e1.message });
    if (!exam) return res.status(404).json({ error: "Exam not found or not yours" });

    const { error: e2 } = await db.from("exams").delete().eq("id", id);
    if (e2) return res.status(400).json({ error: e2.message });

    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

/* =========================
   8) Lấy câu hỏi (cho giáo viên sửa) – có is_correct
========================= */
router.get("/:id/questions/manage", requireAuth, requireTeacher, async (req, res) => {
  try {
    const examId = String(req.params.id);

    const { data: exam, error: e1 } = await db
      .from("exams")
      .select("teacher_id")
      .eq("id", examId)
      .maybeSingle();
    if (e1) return res.status(400).json({ error: e1.message });
    if (!exam) return res.status(404).json({ error: "Exam not found" });
    if (exam.teacher_id !== req.user.id)
      return res.status(403).json({ error: "Not your exam" });

    const { data: questions, error: e2 } = await db
      .from("questions")
      .select("id, content")
      .eq("exam_id", examId)
      .order("created_at", { ascending: true });
    if (e2) return res.status(400).json({ error: e2.message });

    const qIds = (questions || []).map((q) => q.id);
    let choicesByQ = {};
    if (qIds.length) {
      const { data: choices, error: e3 } = await db
        .from("choices")
        .select("id, question_id, content, is_correct")
        .in("question_id", qIds)
        .order("created_at", { ascending: true });
      if (e3) return res.status(400).json({ error: e3.message });
      for (const c of choices || []) {
        if (!choicesByQ[c.question_id]) choicesByQ[c.question_id] = [];
        choicesByQ[c.question_id].push(c);
      }
    }

    const result = (questions || []).map((q) => ({
      id: q.id,
      content: q.content,
      choices: choicesByQ[q.id] || [],
    }));
    return res.json({ questions: result });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

export default router;
