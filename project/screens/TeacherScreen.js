import React, { useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, Alert } from "react-native";

const TeacherScreen = () => {
  const [tests, setTests] = useState([
    { id: "1", code: "TEST001", title: "Bài kiểm tra Toán 1" },
    { id: "2", code: "TEST002", title: "Bài kiểm tra Lý 1" },
  ]);
  const [newTestTitle, setNewTestTitle] = useState("");

  const createTest = () => {
    if (!newTestTitle.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập tên bài kiểm tra");
      return;
    }
    const newTest = {
      id: (tests.length + 1).toString(),
      code: "TEST" + String(tests.length + 1).padStart(3, "0"),
      title: newTestTitle,
    };
    setTests([...tests, newTest]);
    setNewTestTitle("");
    Alert.alert("Thành công", `Bài kiểm tra "${newTest.title}" đã được tạo`);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>👨‍🏫 Teacher Screen</Text>

      <Text style={styles.subtitle}>Danh sách bài kiểm tra:</Text>
      <FlatList
        data={tests}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.testItem}>
            <Text style={styles.testText}>{item.title} - {item.code}</Text>
          </View>
        )}
      />

      <TextInput
        style={styles.input}
        placeholder="Tên bài kiểm tra mới"
        value={newTestTitle}
        onChangeText={setNewTestTitle}
      />
      <TouchableOpacity style={styles.button} onPress={createTest}>
        <Text style={styles.buttonText}>Tạo bài kiểm tra</Text>
      </TouchableOpacity>
    </View>
  );
};

export default TeacherScreen;

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#EAF4FF" }, // background nhạt hợp với #99C2FF
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 10, color: "#99C2FF" },
  subtitle: { fontSize: 18, marginBottom: 10, color: "#4A90E2" },
  testItem: { padding: 10, backgroundColor: "#D0E7FF", marginBottom: 8, borderRadius: 6 },
  testText: { fontSize: 16, color: "black" },
  input: { borderWidth: 1, borderColor: "#99C2FF", padding: 10, borderRadius: 5, marginVertical: 10 },
  button: { padding: 12, backgroundColor: "#4A90E2", borderRadius: 8, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "bold" },
});
