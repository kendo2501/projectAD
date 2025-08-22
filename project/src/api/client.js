import { BASE_URL } from "../config";


export async function apiFetch(path, { method = "GET", body, headers, token } = {}) {
const h = { "Content-Type": "application/json", ...(headers || {}) };
if (token) h.Authorization = `Bearer ${token}`;
const res = await fetch(`${BASE_URL}${path}`, {
method,
headers: h,
body: body !== undefined ? JSON.stringify(body) : undefined,
});
let data = null;
try { data = await res.json(); } catch (e) { /* ignore non-JSON */ }
if (!res.ok) {
const msg = (data && (data.error || data.message)) || `HTTP ${res.status}`;
const err = new Error(msg);
err.status = res.status;
err.data = data;
throw err;
}
return data;
}