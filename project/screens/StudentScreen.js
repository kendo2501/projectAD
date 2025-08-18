import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";

const StudentScreen = () => {
  const [testCode, setTestCode] = useState("");

  const startTest = () => {
    if (!testCode.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập mã bài kiểm tra");
      return;
    }
    // Gọi API backend kiểm tra mã bài kiểm tra (chưa có backend thì chỉ alert)
    Alert.alert("Bắt đầu làm bài", `Bạn đang làm bài kiểm tra với mã: ${testCode}`);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📘 Student Screen</Text>
      <Text style={styles.subtitle}>Nhập mã bài kiểm tra để bắt đầu:</Text>

      <TextInput
        style={styles.input}
        placeholder="Mã bài kiểm tra"
        value={testCode}
        onChangeText={setTestCode}
      />

      <TouchableOpacity style={styles.button} onPress={startTest}>
        <Text style={styles.buttonText}>Bắt đầu làm bài</Text>
      </TouchableOpacity>
    </View>
  );
};

export default StudentScreen;

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, justifyContent: "center", backgroundColor: "#F2F6FF" },
    title: { fontSize: 24, fontWeight: "bold", marginBottom: 10, color: "#99C2FF" }, // màu chủ đạo
    subtitle: { fontSize: 18, marginBottom: 10, color: "black" },
    input: { borderWidth: 1, borderColor: "#ccc", padding: 10, borderRadius: 5, marginBottom: 15 },
    button: { padding: 12, backgroundColor: "#3498DB", borderRadius: 8, alignItems: "center" },
    buttonText: { color: "#fff", fontWeight: "bold" },
  });
  
