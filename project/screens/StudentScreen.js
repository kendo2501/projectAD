// screens/StudentScreen.js
import React, { useEffect, useMemo, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, FlatList, Pressable, ScrollView
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE_URL = "http://192.168.10.4:3000"; // đổi theo backend của bạn

export default function StudentScreen() {
  const [token, setToken] = useState("");
  const [user, setUser] = useState(null);

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  // trạng thái làm bài
  const [exam, setExam] = useState(null);           // {id, title, description, ...}
  const [questions, setQuestions] = useState([]);   // [{id, content, choices: [{id, content, is_correct?}]}]
  const [picked, setPicked] = useState({});         // { [question_id]: choice_id }

  // kết quả lần nộp gần nhất (để show như “Finished …”)
  const [lastResult, setLastResult] = useState(null);

  useEffect(() => {
    (async () => {
      const t = await AsyncStorage.getItem("token");
      const u = await AsyncStorage.getItem("user");
      setToken(t || "");
      setUser(u ? JSON.parse(u) : null);
    })();
  }, []);

  const authHeaders = useMemo(
    () =>
      token
        ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
        : { "Content-Type": "application/json" },
    [token]
  );

  const startTest = async () => {
    if (!/^\d{6}$/.test(code.trim())) {
      Alert.alert("Không thể bắt đầu", "Mã bài kiểm tra cần 6 chữ số.");
      return;
    }
    try {
      setLoading(true);
      // 1) kiểm tra mã & lấy thông tin đề
      const rExam = await fetch(`${BASE_URL}/api/exams/join/${code.trim()}`, { headers: authHeaders });
      const dExam = await rExam.json().catch(() => ({}));
      if (!rExam.ok) {
        Alert.alert("Không thể bắt đầu", dExam?.error || `HTTP ${rExam.status}`);
        return;
      }
      // 2) lấy câu hỏi + đáp án
      const rQ = await fetch(`${BASE_URL}/api/exams/${dExam.id}/questions`, { headers: authHeaders });
      const dQ = await rQ.json().catch(() => ([]));
      if (!rQ.ok) {
        Alert.alert("Không thể tải câu hỏi", dQ?.error || `HTTP ${rQ.status}`);
        return;
      }
      setExam(dExam);
      setQuestions(Array.isArray(dQ) ? dQ : []);
      setPicked({});
    } catch (e) {
      Alert.alert("Lỗi mạng", e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const togglePick = (qid, cid) => {
    setPicked((prev) => ({ ...prev, [qid]: cid }));
  };

  const submitConfirm = () => {
    if (!exam) return;
    const answered = Object.keys(picked).length;
    if (answered === 0) {
      Alert.alert("Chưa chọn đáp án", "Bạn chưa chọn đáp án nào.");
      return;
    }
    Alert.alert(
      "Nộp bài",
      "Bạn chắc chắn với đáp án đã chọn?",
      [
        { text: "Huỷ" },
        { text: "Nộp bài", style: "destructive", onPress: submitNow }
      ]
    );
  };

  const submitNow = async () => {
    try {
      setLoading(true);
      const answers = Object.entries(picked).map(([question_id, choice_id]) => ({
        question_id: Number(question_id),
        choice_id
      }));

      // Backend router: /api/submissions/:examId/submit (requireStudent)
      const r = await fetch(`${BASE_URL}/api/submissions/${exam.id}/submit`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ answers })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        Alert.alert("Nộp bài thất bại", d?.error || `HTTP ${r.status}`);
        return;
      }

      // Quy đổi điểm về thang 10 (mỗi câu 10/total)
      const grade10 = Number(((d.correct / d.total) * 10).toFixed(2));

      // Lưu kết quả để hiện trên màn hình Student
      setLastResult({
        title: exam.title,
        description: exam.description,
        correct: d.correct,
        total: d.total,
        grade10
      });

      // Reset về màn hình chính
      setExam(null);
      setQuestions([]);
      setPicked({});
      setCode("");
      Alert.alert("Đã nộp bài", "Bài của bạn đã được ghi nhận.");
    } catch (e) {
      Alert.alert("Lỗi mạng", e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  // ======= UI =======
  const renderChoice = (q, ch, idx) => {
    const labels = ["A", "B", "C", "D"];
    const checked = picked[q.id] === ch.id;
    return (
      <Pressable key={ch.id || idx} onPress={() => togglePick(q.id, ch.id)} style={styles.choiceRow}>
        <Text style={styles.choiceLabel}>{labels[idx] ?? "•"}:</Text>
        <Text style={styles.choiceText}>{String(ch.content ?? "")}</Text>
        <View style={[styles.radio, checked && styles.radioChecked]} />
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📘 Student Screen</Text>
      <Text style={styles.subtitle}>Nhập mã bài kiểm tra để bắt đầu:</Text>

      {/* Kết quả gần nhất */}
      {lastResult && !exam && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>{lastResult.title || "Bài đã nộp"}</Text>
          {!!lastResult.description && (
            <Text style={styles.resultDesc}>{lastResult.description}</Text>
          )}
          <Text style={styles.resultLine}>
            Đúng: {lastResult.correct}/{lastResult.total} • Điểm: {lastResult.grade10}/10
          </Text>
        </View>
      )}

      {/* Nếu chưa vào đề thì hiện phần nhập mã */}
      {!exam && (
        <>
          <TextInput
            style={styles.input}
            placeholder="Mã bài kiểm tra (6 chữ số)"
            keyboardType="number-pad"
            value={code}
           onChangeText={(v) => setJoinCode(v.replace(/\D/g, ''))}
            maxLength={6}
          />
          <TouchableOpacity style={[styles.button, !token && { opacity: 0.5 }]} onPress={startTest} disabled={!token || loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Bắt đầu làm bài</Text>}
          </TouchableOpacity>
        </>
      )}

      {/* Form làm bài */}
      {exam && (
        <View style={{ flex: 1, width: "100%" }}>
          <View style={styles.examHeader}>
            <Text style={styles.examTitle}>{exam.title}</Text>
            {!!exam.description && <Text style={styles.examDesc}>{exam.description}</Text>}
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
            {questions.map((q, i) => (
              <View key={q.id || i} style={styles.qBlock}>
                <Text style={styles.qTitle}>Câu {i + 1}</Text>
                <Text style={styles.qContent}>{String(q.content ?? "")}</Text>
                <View style={{ marginTop: 8 }}>
                  {(q.choices || []).slice(0, 4).map((ch, idx) => renderChoice(q, ch, idx))}
                </View>
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity style={[styles.button, styles.submitBtn]} onPress={submitConfirm} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Nộp bài</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#F2F6FF" },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 8, color: "#1E5CC6" },
  subtitle: { fontSize: 16, marginBottom: 12, color: "#333" },

  input: {
    borderWidth: 1, borderColor: "#BFD4FF", backgroundColor: "#fff",
    padding: 12, borderRadius: 10, marginBottom: 12
  },
  button: {
    backgroundColor: "#1E5CC6", paddingVertical: 12, borderRadius: 10,
    alignItems: "center"
  },
  buttonText: { color: "#fff", fontWeight: "bold" },

  // Kết quả
  resultCard: {
    backgroundColor: "#E8F0FF", borderRadius: 12, padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: "#C9DBFF"
  },
  resultTitle: { fontSize: 16, fontWeight: "700", color: "#1E5CC6" },
  resultDesc: { color: "#555", marginTop: 4 },
  resultLine: { marginTop: 6, fontWeight: "600", color: "#333" },

  // Đề thi
  examHeader: { backgroundColor: "#E8F0FF", borderRadius: 12, padding: 12, marginBottom: 10 },
  examTitle: { fontSize: 18, fontWeight: "700", color: "#1E5CC6" },
  examDesc: { color: "#555", marginTop: 4 },

  qBlock: {
    backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: "#E1E9FF"
  },
  qTitle: { fontSize: 16, fontWeight: "700", color: "#1E5CC6", marginBottom: 6 },
  qContent: { color: "#333" },

  choiceRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#eee",
  },
  choiceLabel: { width: 20, fontWeight: "700", color: "#1E5CC6" },
  choiceText: { flex: 1, color: "#333" },
  radio: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 2,
    borderColor: "#A9C4FF"
  },
  radioChecked: { backgroundColor: "#1E5CC6", borderColor: "#1E5CC6" },

  submitBtn: { position: "absolute", left: 16, right: 16, bottom: 16 }
});
