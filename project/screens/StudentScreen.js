// screens/StudentScreen.js
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Pressable,
  ScrollView,
  Keyboard,
  Platform,
  SafeAreaView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { Entypo } from "@expo/vector-icons";

const BASE_URL = "http://192.168.10.4:3000";

const safeError = (e) => e?.error || e?.message || String(e);

export default function StudentScreen() {
  const navigation = useNavigation();
  const [token, setToken] = useState("");
  const [user, setUser] = useState(null);

  // nhập mã
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  // đề & làm bài
  const [exam, setExam] = useState(null); // {id,title,description,...}
  const [questions, setQuestions] = useState([]); // [{id, content, choices:[{id,content,is_correct}]}]
  const [picked, setPicked] = useState({}); // { [qid]: choice_id }

  // hiển thị điểm gần nhất
  const [lastResult, setLastResult] = useState(null);

  // kéo footer theo bàn phím
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    const onShow = (e) => {
      const h = Platform.OS === "ios" ? e.endCoordinates.height : e.endCoordinates.height;
      setKbHeight(h);
    };
    const onHide = () => setKbHeight(0);

    const s1 = Keyboard.addListener("keyboardDidShow", onShow);
    const s2 = Keyboard.addListener("keyboardDidHide", onHide);
    return () => {
      s1.remove();
      s2.remove();
    };
  }, []);

  // khởi tạo token + user + điểm gần nhất
  useEffect(() => {
    (async () => {
      try {
        const t = await AsyncStorage.getItem("token");
        const u = await AsyncStorage.getItem("user");
        setToken(t || "");
        setUser(u ? JSON.parse(u) : null);

        if (t) {
          const r = await fetch(`${BASE_URL}/api/submissions/mine/latest`, {
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
          });
          const d = await r.json().catch(() => null);
          if (r.ok && d) {
            setLastResult({
              title: d.title,
              description: d.description,
              correct: d.correct ?? 0,
              total: d.total ?? 0,
              grade10: d.total ? Number(((d.correct / d.total) * 10).toFixed(2)) : 0,
            });
          } else {
            setLastResult(null);
          }
        }
      } catch {
        // bỏ qua lỗi nền
      }
    })();
  }, []);

  const authHeaders = useMemo(
    () =>
      token
        ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
        : { "Content-Type": "application/json" },
    [token]
  );

  // ====== Đăng xuất ======
  const logout = async () => {
    try {
      await AsyncStorage.multiRemove(["token", "user"]);
    } catch {}
    setToken("");
    setUser(null);
    setExam(null);
    setQuestions([]);
    setPicked({});
    setCode("");
    navigation.replace?.("Login") || navigation.navigate("Login");
  };

  // ====== BẮT ĐẦU LÀM BÀI ======
  const startTest = async () => {
    const clean = code.trim();
    if (!/^\d{6}$/.test(clean)) {
      Alert.alert("Không thể bắt đầu", "Mã bài kiểm tra cần 6 chữ số.");
      return;
    }

    try {
      setLoading(true);

      // 1) kiểm tra mã & lấy thông tin đề
      const rExam = await fetch(`${BASE_URL}/api/exams/join/${clean}`, {
        headers: authHeaders,
      });
      const dExam = await rExam.json().catch(() => ({}));
      if (!rExam.ok) {
        Alert.alert("Không thể bắt đầu", dExam?.error || `HTTP ${rExam.status}`);
        return;
      }

      // 2) lấy câu hỏi của đề
      const rQ = await fetch(`${BASE_URL}/api/exams/${dExam.id}/questions`, {
        headers: authHeaders,
      });
      const dQ = await rQ.json().catch(() => []);
      if (!rQ.ok) {
        Alert.alert("Không thể tải câu hỏi", dQ?.error || `HTTP ${rQ.status}`);
        return;
      }

      setExam(dExam);
      setQuestions(Array.isArray(dQ) ? dQ : []);
      setPicked({});
      Keyboard.dismiss();
    } catch (e) {
      Alert.alert("Lỗi mạng", safeError(e));
    } finally {
      setLoading(false);
    }
  };

  // chọn đáp án
  const togglePick = (qid, cid) => setPicked((prev) => ({ ...prev, [qid]: cid }));

  // confirm trước khi nộp
  const submitConfirm = () => {
    if (!exam) return;
    const answered = Object.keys(picked).length;
    if (answered === 0) {
      Alert.alert("Chưa chọn đáp án", "Bạn chưa chọn đáp án nào.");
      return;
    }
    Alert.alert("Nộp bài", "Bạn chắc chắn với đáp án đã chọn?", [
      { text: "Huỷ" },
      { text: "Nộp bài", style: "destructive", onPress: submitNow },
    ]);
  };

  // ====== NỘP BÀI ======
  const submitNow = async () => {
    try {
      setLoading(true);

      const answers = Object.entries(picked).map(([qid, cid]) => ({
        question_id: Number(qid),
        choice_id: Number(cid),
      }));

      const r = await fetch(`${BASE_URL}/api/submissions/${exam.id}/submit`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ answers }),
      });
      const d = await r.json().catch(() => ({}));

      if (!r.ok) {
        Alert.alert("Nộp bài thất bại", d?.error || `HTTP ${r.status}`);
        return;
      }

      const grade10 = d.total ? Number(((d.correct / d.total) * 10).toFixed(2)) : 0;

      setLastResult({
        title: exam.title,
        description: exam.description,
        correct: d.correct,
        total: d.total,
        grade10,
      });

      // Reset về màn hình nhập mã
      setExam(null);
      setQuestions([]);
      setPicked({});
      setCode("");
      Alert.alert("Đã nộp bài", "Bài của bạn đã được ghi nhận.");
    } catch (e) {
      Alert.alert("Lỗi mạng", safeError(e));
    } finally {
      setLoading(false);
    }
  };

  // ====== UI ======
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
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.title}>📘 Student Screen</Text>
        <TouchableOpacity onPress={logout} style={styles.iconBtn} accessibilityLabel="Đăng xuất">
          <Entypo name="log-out" size={24} color="black" />
        </TouchableOpacity>
      </View>
      <Text style={styles.subtitle}>Nhập mã bài kiểm tra để bắt đầu:</Text>

      {/* Kết quả gần nhất */}
      {lastResult && !exam && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>{lastResult.title || "Bài đã nộp"}</Text>
          {!!lastResult.description && <Text style={styles.resultDesc}>{lastResult.description}</Text>}
          <Text style={styles.resultLine}>
            Câu: {lastResult.correct}/{lastResult.total} • Điểm: {lastResult.grade10}/10
          </Text>
        </View>
      )}

      {/* Khu vực làm bài */}
      {exam ? (
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
      ) : null}

      {/* Footer nhập mã – cố định & nhấc theo bàn phím */}
      {!exam && (
        <View style={[styles.footer, { bottom: 16 + kbHeight }]}>
          <TextInput
            style={styles.input}
            placeholder="Mã bài kiểm tra (6 chữ số)"
            keyboardType="number-pad"
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, ""))}
            maxLength={6}
          />
          <TouchableOpacity
            style={[styles.button, (code.length !== 6 || !token || loading) && { opacity: 0.5 }]}
            onPress={startTest}
            disabled={code.length !== 6 || !token || loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Bắt đầu làm bài</Text>}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#F2F6FF" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  iconBtn: { padding: 6, borderRadius: 8, backgroundColor: "transparent" },
  title: { fontSize: 24, fontWeight: "bold", color: "#1E5CC6" },
  subtitle: { fontSize: 16, marginBottom: 12, color: "#333" },

  // Footer cố định, nhưng bottom sẽ set động trong JSX
  footer: {
    position: "absolute",
    left: 16,
    right: 16,
    // bottom sẽ set động trong JSX
  },

  input: {
    borderWidth: 1,
    borderColor: "#BFD4FF",
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  button: {
    backgroundColor: "#1E5CC6",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "bold" },

  // Kết quả
  resultCard: {
    backgroundColor: "#E8F0FF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#C9DBFF",
  },
  resultTitle: { fontSize: 16, fontWeight: "700", color: "#1E5CC6" },
  resultDesc: { color: "#555", marginTop: 4 },
  resultLine: { marginTop: 6, fontWeight: "600", color: "#333" },

  // Đề thi
  examHeader: {
    backgroundColor: "#E8F0FF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  examTitle: { fontSize: 18, fontWeight: "700", color: "#1E5CC6" },
  examDesc: { color: "#555", marginTop: 4 },

  qBlock: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E1E9FF",
  },
  qTitle: { fontSize: 16, fontWeight: "700", color: "#1E5CC6", marginBottom: 6 },
  qContent: { color: "#333" },

  choiceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#eee",
  },
  choiceLabel: { width: 20, fontWeight: "700", color: "#1E5CC6" },
  choiceText: { flex: 1, color: "#333" },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#A9C4FF",
  },
  radioChecked: { backgroundColor: "#1E5CC6", borderColor: "#1E5CC6" },

  submitBtn: { position: "absolute", left: 16, right: 16, bottom: 16 },
});
