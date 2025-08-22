import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { apiFetch } from "../../api/client";


export const fetchMyExams = createAsyncThunk("teacher/fetchMyExams", async (_, { getState, rejectWithValue }) => {
const token = getState().auth.token;
try { return await apiFetch("/api/exams/mine", { token }); }
catch (e) { return rejectWithValue(e.message); }
});


export const createExam = createAsyncThunk(
"teacher/createExam",
async ({ title, description, starts_at, ends_at, numQuestions, qForms }, { getState, rejectWithValue }) => {
const token = getState().auth.token;
try {
// 1) Create exam
const exam = await apiFetch("/api/exams", {
method: "POST",
body: {
title,
description: description || null,
starts_at,
ends_at,
max_questions: Math.max(1, Math.min(60, Number(numQuestions) || 1)),
},
token,
});
const examId = exam?.id || exam?.exam_id || exam?.exam?.id;
// 2) Create questions + choices (sequential to keep parity with your backend)
if (examId && Array.isArray(qForms) && qForms.length) {
for (let i = 0; i < qForms.length; i++) {
const q = qForms[i];
const qRes = await apiFetch(`/api/questions/${examId}`, {
method: "POST",
body: { content: q.content, meta: {} },
token,
});
const qId = qRes?.question_id;
const payload = (q.choices || [])
.filter((c) => (c.content || "").trim() !== "")
.map((c) => ({ content: c.content.trim(), is_correct: !!c.is_correct }));
await apiFetch(`/api/questions/${qId}/choices`, { method: "POST", body: { choices: payload }, token });
}
}
return exam;
} catch (e) { return rejectWithValue(e.message); }
}
);


export const updateExamTime = createAsyncThunk(
"teacher/updateExamTime",
async ({ id, starts_at, ends_at }, { getState, rejectWithValue }) => {
const token = getState().auth.token;
try { return await apiFetch(`/api/exams/${id}`, { method: "PUT", body: { starts_at, ends_at }, token }); }
catch (e) { return rejectWithValue(e.message); }
}
);


export const deleteExam = createAsyncThunk("teacher/deleteExam", async (id, { getState, rejectWithValue }) => {
const token = getState().auth.token;
try { return await apiFetch(`/api/exams/${id}`, { method: "DELETE", token }); }
catch (e) { return rejectWithValue(e.message); }
});


export const fetchGrades = createAsyncThunk("teacher/fetchGrades", async (examId, { getState, rejectWithValue }) => {
const token = getState().auth.token;
try { return await apiFetch(`/api/exams/${examId}/grades`, { token }); }
catch (e) { return rejectWithValue(e.message); }
});


const teacherSlice = createSlice({
name: "teacher",
initialState: {
exams: [],
loading: false,
error: null,
gradesByExam: {}, // { [examId]: rows[] }
},
reducers: {},
extraReducers: (builder) => {
builder
.addCase(fetchMyExams.pending, (s) => { s.loading = true; s.error = null; })
.addCase(fetchMyExams.fulfilled, (s, { payload }) => { s.loading = false; s.exams = Array.isArray(payload) ? payload : []; })
.addCase(fetchMyExams.rejected, (s, a) => { s.loading = false; s.error = a.payload || a.error.message; })
.addCase(createExam.fulfilled, (s) => { /* no-op; refresh list in screen */ })
.addCase(updateExamTime.fulfilled, (s) => { /* no-op */ })
.addCase(deleteExam.fulfilled, (s) => { /* no-op */ })
.addCase(fetchGrades.fulfilled, (s, { meta, payload }) => {
const id = meta.arg;
const rows = Array.isArray(payload?.rows) ? payload.rows : [];
s.gradesByExam[id] = rows;
});
},
});


export default teacherSlice.reducer;