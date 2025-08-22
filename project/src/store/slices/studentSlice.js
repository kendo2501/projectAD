import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { apiFetch } from "../../api/client";


export const fetchLatestResult = createAsyncThunk(
    "student/fetchLatestResult",
    async (_, { getState, rejectWithValue }) => {
        const token = getState().auth.token;
        if (!token) return null;
        try {
            const d = await apiFetch("/api/submissions/mine/latest", { token });
            return d; // {title, description, correct, total}
        } catch (e) {
            return rejectWithValue(e.message);
        }
    }
);


export const joinExam = createAsyncThunk(
    "student/joinExam",
    async (code, { getState, rejectWithValue }) => {
        const token = getState().auth.token;
        try {
            const exam = await apiFetch(`/api/exams/join/${code}`, { token });
            const questions = await apiFetch(`/api/exams/${exam.id}/questions`, { token });
            return { exam, questions };
        } catch (e) {
            return rejectWithValue(e.message);
        }
    }
);


export const submitAnswers = createAsyncThunk(
    "student/submitAnswers",
    async ({ examId, answers }, { getState, rejectWithValue }) => {
        const token = getState().auth.token;
        try {
            const res = await apiFetch(`/api/submissions/${examId}/submit`, {
                method: "POST",
                body: { answers },
                token,
            });
            return res; // {correct, total}
        } catch (e) {
            return rejectWithValue(e.message);
        }
    }
);


const studentSlice = createSlice({
    name: "student",
    initialState: {
        code: "",
        exam: null,
        questions: [],
        picked: {},
        lastResult: null,
        loading: false,
        error: null,
    },
    reducers: {
        setCode(state, action) { state.code = action.payload; },
        togglePick(state, action) { const { qid, cid } = action.payload; state.picked[qid] = cid; },
        resetExam(state) { state.exam = null; state.questions = []; state.picked = {}; state.code = ""; },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchLatestResult.fulfilled, (state, { payload }) => {
                if (!payload) { state.lastResult = null; return; }
                const grade10 = payload.total ? Number(((payload.correct / payload.total) * 10).toFixed(2)) : 0;
                state.lastResult = { ...payload, grade10 };
            })
            .addCase(joinExam.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(joinExam.fulfilled, (state, { payload }) => {
                state.loading = false;
                state.exam = payload.exam;
                state.questions = Array.isArray(payload.questions) ? payload.questions : [];
                state.picked = {};
            })
            .addCase(joinExam.rejected, (state, action) => { state.loading = false; state.error = action.payload || action.error.message; })
            .addCase(submitAnswers.pending, (state) => { state.loading = true; })
            .addCase(submitAnswers.fulfilled, (state, { payload }) => {
                state.loading = false;
                const grade10 = payload.total ? Number(((payload.correct / payload.total) * 10).toFixed(2)) : 0;
                state.lastResult = {
                    title: state.exam?.title,
                    description: state.exam?.description,
                    correct: payload.correct,
                    total: payload.total,
                    grade10,
                };
                state.exam = null; state.questions = []; state.picked = {}; state.code = "";
            })
            .addCase(submitAnswers.rejected, (state, action) => { state.loading = false; state.error = action.payload || action.error.message; });
    },
});


export const { setCode, togglePick, resetExam } = studentSlice.actions;
export default studentSlice.reducer;