import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleLogin = async () => {
    try {
      const res = await fetch("http://10.106.42.42:3000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (data.success) {
        setMessage("Đăng nhập thành công ✅");

        // 👉 điều hướng dựa trên role
        if (data.user.role === "teacher") {
          navigation.navigate("TeacherScreen", { user: data.user });
        } else {
          navigation.navigate("StudentScreen", { user: data.user });
        }
      } else {
        setMessage("❌ " + data.error);
      }
    } catch (err) {
      setMessage("Lỗi mạng: " + err.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>FLAG {"\n"} GAME</Text>
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

      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>Sign in</Text>
      </TouchableOpacity>

      {message ? <Text style={styles.message}>{message}</Text> : null}

      <TouchableOpacity onPress={() => navigation.navigate("Register")}>
        <Text style={styles.link}>Sign up</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
  title: { fontSize: 28, fontWeight: "bold", textAlign: "center", marginBottom: 20 },
  subtitle: { fontSize: 20, marginBottom: 10 },
  input: { width: "80%", borderWidth: 1, borderColor: "#ccc", padding: 10, marginBottom: 15, borderRadius: 5 },
  button: { backgroundColor: "#4A90E2", padding: 12, borderRadius: 5, width: "80%", alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "bold" },
  link: { marginTop: 20, fontSize: 16, fontWeight: "bold" },
  message: { marginTop: 15, fontSize: 16, color: "red" },
});
