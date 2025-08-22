import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { apiFetch } from "../../api/client";


export const login = createAsyncThunk(
"auth/login",
async ({ email, password }, { rejectWithValue }) => {
try {
const data = await apiFetch("/api/login", { method: "POST", body: { email, password } });
return { token: data.token || null, user: data.user || null };
} catch (e) {
return rejectWithValue(e.message || "Login failed");
}
}
);


export const register = createAsyncThunk(
"auth/register",
async ({ full_name, email, password, role }, { rejectWithValue }) => {
try {
const data = await apiFetch("/api/register", {
method: "POST",
body: { full_name, email, password, role },
});
return data; // {success: true}
} catch (e) {
return rejectWithValue(e.message || "Register failed");
}
}
);


const initialState = {
token: null,
user: null,
status: "idle",
error: null,
};


const authSlice = createSlice({
name: "auth",
initialState,
reducers: {
logout(state) {
state.token = null;
state.user = null;
state.status = "idle";
state.error = null;
},
},
extraReducers: (builder) => {
builder
.addCase(login.pending, (state) => { state.status = "loading"; state.error = null; })
.addCase(login.fulfilled, (state, { payload }) => {
state.status = "succeeded";
state.token = payload.token;
state.user = payload.user;
})
.addCase(login.rejected, (state, action) => {
state.status = "failed";
state.error = action.payload || action.error.message;
})
.addCase(register.pending, (state) => { state.error = null; })
.addCase(register.rejected, (state, action) => { state.error = action.payload || action.error.message; });
},
});
export default authSlice.reducer;