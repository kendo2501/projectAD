// screens/LoginScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Đổi BASE_URL cho đúng môi trường của bạn
// - Android emulator: http://10.0.2.2:3000
// - iOS simulator:   http://localhost:3000
// - Device thật:     http://<IP_PC_LAN>:3000
const BASE_URL = "http://192.168.10.4:3000";

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const e = email.trim();
    const p = password;

    if (!e || !p) {
      setMessage("Vui lòng nhập email & mật khẩu");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      const res = await fetch(`${BASE_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e, password: p }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMessage("❌ " + (data?.error || `HTTP ${res.status}`));
        return;
      }

      // Lưu token & user để các màn khác dùng (TeacherScreen đang đọc AsyncStorage)
      if (data?.token) {
        await AsyncStorage.setItem("token", data.token);
      }
      if (data?.user) {
        await AsyncStorage.setItem("user", JSON.stringify(data.user));
      }

      setMessage("Đăng nhập thành công ✅");

      // Điều hướng theo role + truyền params (tuỳ bạn dùng hay không)
      const role = data?.user?.role;
      if (role === "teacher") {
        navigation.navigate("TeacherScreen", { user: data.user, token: data.token });
      } else if (role === "student") {
        navigation.navigate("StudentScreen", { user: data.user, token: data.token });
      } else {
        // Fallback
        navigation.navigate("StudentScreen", { user: data.user, token: data.token });
      }
    } catch (err) {
      setMessage("Lỗi mạng: " + (err?.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>QUIZ {"\n"} MOBILE</Text>
      <Text style={styles.subtitle}>Login</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        onChangeText={setEmail}
        value={email}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        onChangeText={setPassword}
        value={password}
      />

      <TouchableOpacity
        style={[styles.button, loading && { opacity: 0.7 }]}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Sign in</Text>
        )}
      </TouchableOpacity>

      {!!message && (
        <Text
          style={[
            styles.message,
            message.includes("✅") ? { color: "green" } : { color: "red" },
          ]}
        >
          {message}
        </Text>
      )}

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
