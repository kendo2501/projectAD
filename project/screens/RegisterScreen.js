import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";

export default function RegisterScreen({ navigation }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student"); // mặc định student
  const [message, setMessage] = useState("");

  const handleRegister = async () => {
    try {
      const res = await fetch("http://192.168.10.4:3000/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName, email, password, role }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage("Tạo tài khoản thành công 🎉");
        navigation.navigate("Login");
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
      <Text style={styles.subtitle}>Register</Text>

      <TextInput
        style={styles.input}
        placeholder="Full name"
        onChangeText={setFullName}
        value={fullName}
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
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

      {/* Role select */}
      <View style={styles.roleContainer}>
        <TouchableOpacity
          style={[styles.roleButton, role === "student" && styles.roleSelected]}
          onPress={() => setRole("student")}
        >
          <Text style={styles.roleText}>Student</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.roleButton, role === "teacher" && styles.roleSelected]}
          onPress={() => setRole("teacher")}
        >
          <Text style={styles.roleText}>Teacher</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.button} onPress={handleRegister}>
        <Text style={styles.buttonText}>Sign up</Text>
      </TouchableOpacity>

      {message ? <Text style={styles.message}>{message}</Text> : null}

      <TouchableOpacity onPress={() => navigation.navigate("Login")}>
        <Text style={styles.link}>Sign in</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff", padding: 20 },
  title: { fontSize: 28, fontWeight: "bold", textAlign: "center", marginBottom: 20 },
  subtitle: { fontSize: 20, marginBottom: 10 },
  input: { width: "100%", borderWidth: 1, borderColor: "#ccc", padding: 10, marginBottom: 15, borderRadius: 5 },
  button: { backgroundColor: "#4A90E2", padding: 12, borderRadius: 5, width: "100%", alignItems: "center", marginTop: 10 },
  buttonText: { color: "#fff", fontWeight: "bold" },
  link: { marginTop: 20, fontSize: 16, fontWeight: "bold" },
  message: { marginTop: 15, fontSize: 16, color: "red" },
  roleContainer: { flexDirection: "row", justifyContent: "space-between", width: "100%", marginBottom: 15 },
  roleButton: { flex: 1, borderWidth: 1, borderColor: "#ccc", padding: 10, marginHorizontal: 5, borderRadius: 5, alignItems: "center" },
  roleSelected: { backgroundColor: "#4A90E2" },
  roleText: { color: "#000", fontWeight: "bold" },
});
