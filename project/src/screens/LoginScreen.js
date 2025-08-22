import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { login } from "../store/slices/authSlice";


export default function LoginScreen({ navigation }) {
const dispatch = useDispatch();
const { status, error } = useSelector((s) => s.auth);
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [message, setMessage] = useState("");


const onSubmit = async () => {
const e = email.trim();
if (!e || !password) { setMessage("Vui lòng nhập email & mật khẩu"); return; }
setMessage("");
try {
const action = await dispatch(login({ email: e, password }));
if (login.fulfilled.match(action)) {
const role = action.payload?.user?.role;
if (role === "teacher") navigation.replace("TeacherScreen");
else navigation.replace("StudentScreen");
} else {
setMessage("❌ " + (action.payload || error || "Đăng nhập thất bại"));
}
} catch (e) {
setMessage("Lỗi: " + (e?.message || String(e)));
}
};


const loading = status === "loading";


return (
<View style={styles.container}>
<Text style={styles.title}>QUIZ{"\n"}MOBILE</Text>
<Text style={styles.subtitle}>Login</Text>


<TextInput style={styles.input} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
<TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />


<TouchableOpacity style={[styles.button, loading && { opacity: 0.7 }]} onPress={onSubmit} disabled={loading}>
{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
</TouchableOpacity>


{!!message && <Text style={[styles.message, message.includes("❌") ? { color: "red" } : { color: "green" }]}>{message}</Text>}


<TouchableOpacity onPress={() => navigation.navigate("Register")}>
<Text style={styles.link}>Sign up</Text>
</TouchableOpacity>
</View>
);
}


const styles = StyleSheet.create({
container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff", paddingHorizontal: 16 },
title: { fontSize: 28, fontWeight: "bold", textAlign: "center", marginBottom: 20 },
subtitle: { fontSize: 20, marginBottom: 10 },
input: { width: "100%", borderWidth: 1, borderColor: "#ccc", padding: 10, marginBottom: 15, borderRadius: 5, backgroundColor: "#fff" },
button: { backgroundColor: "#4A90E2", padding: 12, borderRadius: 5, width: "100%", alignItems: "center" },
buttonText: { color: "#fff", fontWeight: "bold" },
link: { marginTop: 20, fontSize: 16, fontWeight: "bold" },
message: { marginTop: 15, fontSize: 16 },
});