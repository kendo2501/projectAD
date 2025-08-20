// src/routes/exams.js
import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth, requireTeacher } from "../middleware/requireAuth.js";

const router = Router();

/* =========================
   Helpers
========================= */
const nowISO = () => new Date().toISOString();

/** Lấy exam theo code và còn trong thời gian làm bài */
async function findExamByCode(code) {
  const now = nowISO();
  const { data, error } = await supabase
    .from("exams")
    .select("id, title, description, starts_at, ends_at, max_questions, key_code, teacher_id")
    .eq("key_code", code)
    .lte("starts_at", now) // starts_at <= now
    .gte("ends_at", now)   // ends_at >= now
    .limit(1)
    .maybeSingle();

  if (error) return { error };
  if (!data) return { error: new Error("Mã không hợp lệ hoặc không trong thời gian làm bài") };
  return { exam: data };
}

/** Lấy số câu hỏi của exam */
async function countQuestions(examId) {
  const { count, error } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("exam_id", examId);
  if (error) return { error };
  return { total: count || 0 };
}

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

    const { data, error } = await supabase
      .from("exams")
      .insert([
        {
          teacher_id: req.user.id,
          title: title.trim(),
          description: description ?? null,
          starts_at,
          ends_at,
          max_questions: Math.max(1, Math.min(60, Number(max_questions) || 60)),
        },
      ])
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
  try {
    const { data, error } = await supabase
      .from("exams")
      .select("id, title, description, key_code, starts_at, ends_at, max_questions, created_at")
      .eq("teacher_id", req.user.id)
      .order("created_at", { ascending: false });

    if (error) return res.status(400).json({ error: error.message });
    return res.json(data || []);
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

/* =========================
   3) Student nhập mã 6 số -> trả về thông tin đề (còn thời gian)
========================= */
router.get("/join/:code", async (req, res) => {
  try {
    const code = String(req.params.code || "").trim();
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: "Mã phải là 6 chữ số" });
    }

    const { exam, error } = await findExamByCode(code);
    if (error) return res.status(404).json({ error: error.message });

    // trả về thông tin cơ bản của đề
    return res.json({
      id: exam.id,
      title: exam.title,
      description: exam.description,
      starts_at: exam.starts_at,
      ends_at: exam.ends_at,
      max_questions: exam.max_questions,
      key_code: exam.key_code,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

/* =========================
   4) Lấy câu hỏi + đáp án cho học sinh làm bài
      - Kiểm tra còn trong thời gian
      - Random câu & đáp án
      - ẨN is_correct để HS không nhìn thấy đáp án đúng
========================= */
router.get("/:examId/questions", async (req, res) => {
  try {
    const examId = req.params.examId;

    // Kiểm tra thời gian đề thi
    const { data: exam, error: eErr } = await supabase
      .from("exams")
      .select("id, starts_at, ends_at, max_questions")
      .eq("id", examId)
      .single();
    if (eErr) return res.status(400).json({ error: eErr.message });

    const now = new Date();
    if (!(now >= new Date(exam.starts_at) && now <= new Date(exam.ends_at))) {
      return res.status(403).json({ error: "Không nằm trong thời gian làm bài" });
    }

    // Lấy các câu hỏi của đề
    const { data: questions, error: qErr } = await supabase
      .from("questions")
      .select("id, content, meta")
      .eq("exam_id", examId);
    if (qErr) return res.status(400).json({ error: qErr.message });

    // (tuỳ chọn) shuffle danh sách câu và cắt theo max_questions
    let qList = [...(questions || [])];
    qList.sort(() => Math.random() - 0.5);
    const limit = Math.max(1, Math.min(exam.max_questions || 60, qList.length));
    qList = qList.slice(0, limit);

    // Với từng câu, lấy đáp án và random trật tự — KHÔNG trả is_correct
    const withChoices = [];
    for (const q of qList) {
      const { data: choices, error: cErr } = await supabase
        .from("choices")
        .select("id, content") // 👈 Ẩn is_correct ở API cho học sinh
        .eq("question_id", q.id);

      if (cErr) return res.status(400).json({ error: cErr.message });

      const shuffled = [...(choices || [])].sort(() => Math.random() - 0.5);
      withChoices.push({ id: q.id, content: q.content, choices: shuffled });
    }

    return res.json(withChoices);
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

/* =========================
   5) Teacher xem điểm
   - Kiểm tra quyền (teacher sở hữu đề)
   - Tính correct/total theo số câu của đề
   - Trả cả % (0..100) và thang 10 (0..10)
   - Tuỳ chọn: phân trang, lọc (q=?), sắp xếp mới nhất
   Query params:
     page (>=1), page_size (1..200), q (lọc theo tên/email)
========================= */
router.get("/:examId/grades", requireAuth, requireTeacher, async (req, res) => {
  try {
    const examId = req.params.examId;
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const pageSize = Math.max(1, Math.min(200, parseInt(req.query.page_size || "100", 10)));
    const qFilter = (req.query.q || "").toString().toLowerCase();

    // Xác thực quyền sở hữu đề
    const { data: exam, error: eErr } = await supabase
      .from("exams")
      .select("id, teacher_id")
      .eq("id", examId)
      .single();
    if (eErr) return res.status(400).json({ error: eErr.message });
    if (!exam || exam.teacher_id !== req.user.id) {
      return res.status(403).json({ error: "Không có quyền xem đề này" });
    }

    // Lấy mọi submissions của exam
    const { data: subs, error: sErr } = await supabase
      .from("submissions")
      .select("id, student_id, submitted_at")
      .eq("exam_id", examId)
      .order("submitted_at", { ascending: false });
    if (sErr) return res.status(400).json({ error: sErr.message });
    if (!subs?.length) return res.json({ total_rows: 0, rows: [] });

    // Tổng số câu của đề
    const { total: totalQuestions, error: cqErr } = await countQuestions(examId);
    if (cqErr) return res.status(400).json({ error: cqErr.message });

    // Lấy toàn bộ answers của các submissions
    const subIds = subs.map((s) => s.id);
    const { data: answers, error: aErr } = await supabase
      .from("answers")
      .select("submission_id, question_id, choice_id")
      .in("submission_id", subIds);
    if (aErr) return res.status(400).json({ error: aErr.message });

    // Lấy đáp án đúng cho các câu thuộc đề
    const { data: correctChoices, error: cErr } = await supabase
      .from("choices")
      .select("question_id, id")
      .eq("is_correct", true)
      .in(
        "question_id",
        (
          await supabase.from("questions").select("id").eq("exam_id", examId)
        ).data?.map((q) => q.id) || []
      );
    if (cErr) return res.status(400).json({ error: cErr.message });
    const correctMap = new Map(correctChoices.map((c) => [c.question_id, c.id]));

    // Gom answers theo submission
    const bySub = new Map();
    for (const a of answers || []) {
      if (!bySub.has(a.submission_id)) bySub.set(a.submission_id, []);
      bySub.get(a.submission_id).push(a);
    }

    // Lấy info học sinh
    const studentIds = [...new Set(subs.map((s) => s.student_id))];
    const { data: users, error: uErr } = await supabase
      .from("users")
      .select("id, full_name, email")
      .in("id", studentIds);
    if (uErr) return res.status(400).json({ error: uErr.message });
    const userMap = new Map((users || []).map((u) => [u.id, u]));

    // Tính điểm + build rows
    let rows = subs.map((s) => {
      const list = bySub.get(s.id) || [];
      let correct = 0;
      for (const a of list) if (correctMap.get(a.question_id) === a.choice_id) correct++;
      const total = totalQuestions || 0;

      const pct = total ? Math.round((correct / total) * 100) : 0;
      // thang 10 làm tròn 1 chữ số thập phân
      const score10 = total ? Math.round(((correct / total) * 10) * 10) / 10 : 0;

      const u = userMap.get(s.student_id) || {};
      return {
        submission_id: s.id,
        student_id: s.student_id,
        full_name: u.full_name || null,
        email: u.email || null,
        correct,
        total,
        score_pct: pct,   // 0..100
        score10,          // 0..10 (1 chữ số thập phân)
        submitted_at: s.submitted_at,
      };
    });

    // (tuỳ chọn) lọc theo q (tên/email)
    if (qFilter) {
      rows = rows.filter((r) => {
        const name = (r.full_name || "").toLowerCase();
        const mail = (r.email || "").toLowerCase();
        const sid = String(r.student_id || "");
        return name.includes(qFilter) || mail.includes(qFilter) || sid.includes(qFilter);
      });
    }

    // Phân trang (sau khi lọc)
    const total_rows = rows.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const pageRows = rows.slice(start, end);

    return res.json({ total_rows, page, page_size: pageSize, rows: pageRows });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

/* =========================
   6) Sửa thời gian / thông tin đề (teacher)
========================= */
router.put("/:id", requireAuth, requireTeacher, async (req, res) => {
  try {
    const me = req.user;
    const examId = req.params.id;
    const { starts_at, ends_at, title, description, max_questions } = req.body;

    if (!starts_at || !ends_at)
      return res.status(400).json({ error: "starts_at và ends_at là bắt buộc" });
    if (new Date(ends_at) <= new Date(starts_at))
      return res.status(400).json({ error: "ends_at phải sau starts_at" });

    const { data: exam, error: e1 } = await supabase
      .from("exams")
      .select("id, teacher_id")
      .eq("id", examId)
      .single();
    if (e1) return res.status(404).json({ error: "Exam not found" });
    if (exam.teacher_id !== me.id)
      return res.status(403).json({ error: "Not your exam" });

    const patch = {
      starts_at,
      ends_at,
    };
    if (title !== undefined) patch.title = String(title || "").trim();
    if (description !== undefined) patch.description = description ?? null;
    if (max_questions !== undefined)
      patch.max_questions = Math.max(1, Math.min(60, Number(max_questions) || 60));

    const { error: e2 } = await supabase.from("exams").update(patch).eq("id", examId);
    if (e2) return res.status(400).json({ error: e2.message });

    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

/* =========================
   7) Xoá đề (teacher) — rely ON DELETE CASCADE
========================= */
router.delete("/:id", requireAuth, requireTeacher, async (req, res) => {
  try {
    const me = req.user;
    const examId = req.params.id;

    const { data: exam, error: e1 } = await supabase
      .from("exams")
      .select("id, teacher_id")
      .eq("id", examId)
      .single();
    if (e1) return res.status(404).json({ error: "Exam not found" });
    if (exam.teacher_id !== me.id)
      return res.status(403).json({ error: "Not your exam" });

    const { error: e2 } = await supabase.from("exams").delete().eq("id", examId);
    if (e2) return res.status(400).json({ error: e2.message });

    // Nhờ ON DELETE CASCADE mà questions/choices/answers/submissions đi theo
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

/* =========================
   8) Lấy câu hỏi (cho giáo viên sửa) – KHÔNG random, có is_correct
========================= */
router.get("/:id/questions/manage", requireAuth, requireTeacher, async (req, res) => {
  try {
    const me = req.user;
    const examId = req.params.id;

    const { data: exam, error: e1 } = await supabase
      .from("exams")
      .select("teacher_id")
      .eq("id", examId)
      .single();
    if (e1) return res.status(404).json({ error: "Exam not found" });
    if (exam.teacher_id !== me.id)
      return res.status(403).json({ error: "Not your exam" });

    const { data: questions, error: e2 } = await supabase
      .from("questions")
      .select("id, content")
      .eq("exam_id", examId)
      .order("created_at", { ascending: true });
    if (e2) return res.status(400).json({ error: e2.message });

    const qIds = (questions || []).map((q) => q.id);
    let choicesByQ = {};
    if (qIds.length) {
      const { data: choices, error: e3 } = await supabase
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
