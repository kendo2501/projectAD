// screens/TeacherScreen.js
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { Entypo } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";

const BASE_URL = "http://192.168.10.4:3000"; // Android emulator: http://10.0.2.2:3000

export default function TeacherScreen() {
  const [token, setToken] = useState("");
  const [user, setUser] = useState(null);

  const navigation = useNavigation();
  const logout = async () => {
    try {
      await AsyncStorage.multiRemove(["token", "user"]);
    } catch {}
    setToken("");
    setUser(null);
    setExams([]);
    setVisibleCreate(false);
    setVisibleEdit(false);
    setVisibleGrades(false);
    setVisibleQEditor(false);
    navigation.replace?.("Login") || navigation.navigate("Login");
  };

  const [loading, setLoading] = useState(false);
  const [exams, setExams] = useState([]);

  // ====== Create Exam Modal ======
  const [visibleCreate, setVisibleCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [startsAt, setStartsAt] = useState(null); // Date
  const [endsAt, setEndsAt] = useState(null);     // Date

  // câu hỏi khi tạo mới
  const [numQuestions, setNumQuestions] = useState("0");
  const [createQForms, setCreateQForms] = useState([]);

  // ====== Edit Time Modal ======
  const [visibleEdit, setVisibleEdit] = useState(false);
  const [editExam, setEditExam] = useState(null);
  const [eStartsAt, setEStartsAt] = useState(null);
  const [eEndsAt, setEEndsAt] = useState(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // ====== Grades Modal ======
  const [visibleGrades, setVisibleGrades] = useState(false);
  const [gradesLoading, setGradesLoading] = useState(false);
  const [currentExam, setCurrentExam] = useState(null);
  const [grades, setGrades] = useState([]);

  // ====== Question Editor (view/edit existing) ======
  const [visibleQEditor, setVisibleQEditor] = useState(false);
  const [qExam, setQExam] = useState(null);
  const [qLoading, setQLoading] = useState(false);
  const [qForms, setQForms] = useState([]);       // working copy
  const [qOriginal, setQOriginal] = useState([]); // snapshot để diff
  const [qSaving, setQSaving] = useState(false);

  // ====== One DateTimePicker (reusable) ======
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerMode, setPickerMode] = useState("date"); // 'date' | 'time'
  const [pickerValue, setPickerValue] = useState(new Date());
  const [tempDate, setTempDate] = useState(null);
  const [activeCtx, setActiveCtx] = useState(null);      // 'create' | 'edit'
  const [activeField, setActiveField] = useState(null);  // 'start' | 'end'

  useEffect(() => {
    (async () => {
      const t = await AsyncStorage.getItem("token");
      const uStr = await AsyncStorage.getItem("user");
      setToken(t || "");
      setUser(uStr ? JSON.parse(uStr) : null);
    })();
  }, []);

  useEffect(() => {
    if (token) fetchMyExams();
  }, [token]);

  const authHeaders = useMemo(
    () =>
      token
        ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
        : { "Content-Type": "application/json" },
    [token]
  );

  // ====== Utils ======
  const fmt = (iso) => {
    if (!iso) return "-";
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  };
  const fmtLocal = (d) => (d ? d.toLocaleString() : "Chưa chọn");
  const mergeDateTime = (datePart, timePart) => {
    const d = new Date(datePart);
    const t = new Date(timePart);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), t.getHours(), t.getMinutes(), 0, 0);
  };

  // ====== DateTimePicker (create & edit) ======
  const openCombinedPicker = (ctx, field) => {
    setActiveCtx(ctx);
    setActiveField(field);
    setPickerMode("date");

    const base =
      ctx === "create"
        ? (field === "start" ? (startsAt || new Date()) : (endsAt || (startsAt ? new Date(startsAt.getTime() + 15 * 60000) : new Date())))
        : (field === "start" ? (eStartsAt || new Date()) : (eEndsAt || (eStartsAt ? new Date(eStartsAt.getTime() + 15 * 60000) : new Date())));

    setPickerValue(base);
    setPickerVisible(true);
  };

  const onPickerChange = (event, selected) => {
    if (Platform.OS === "android" && event.type === "dismissed") {
      setPickerVisible(false);
      setPickerMode("date");
      setTempDate(null);
      setActiveCtx(null);
      setActiveField(null);
      return;
    }

    const sel = selected || pickerValue;
    setPickerValue(sel);

    if (pickerMode === "date") {
      setTempDate(sel);
      if (Platform.OS === "android") {
        setPickerVisible(false);
        setPickerMode("time");
        setTimeout(() => setPickerVisible(true), 0);
      } else {
        setPickerMode("time");
      }
    } else {
      const finalDate = mergeDateTime(tempDate || new Date(), sel);

      if (activeCtx === "create") {
        if (activeField === "start") setStartsAt(finalDate);
        else setEndsAt(finalDate);
      } else if (activeCtx === "edit") {
        if (activeField === "start") setEStartsAt(finalDate);
        else setEEndsAt(finalDate);
      }

      setPickerVisible(false);
      setPickerMode("date");
      setTempDate(null);
      setActiveCtx(null);
      setActiveField(null);
    }
  };

  // ====== EXAMS ======
  async function fetchMyExams() {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch(`${BASE_URL}/api/exams/mine`, { headers: authHeaders });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) Alert.alert("Phiên đăng nhập hết hạn", "Vui lòng đăng nhập lại.");
        else Alert.alert("Lỗi", data?.error || `HTTP ${res.status}`);
        return;
      }
      setExams(Array.isArray(data) ? data : []);
    } catch (e) {
      Alert.alert("Lỗi mạng", e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  // ====== CREATE EXAM (with inline questions) ======
  useEffect(() => {
    const n = Math.max(0, Math.min(60, Number(numQuestions) || 0));
    const forms = Array.from({ length: n }, () => ({
      content: "",
      choices: [
        { label: "A", content: "", is_correct: false },
        { label: "B", content: "", is_correct: false },
        { label: "C", content: "", is_correct: false },
        { label: "D", content: "", is_correct: false },
      ],
    }));
    setCreateQForms(forms);
  }, [numQuestions, visibleCreate]);

  const updateCreateQContent = (idx, val) => {
    const next = [...createQForms];
    next[idx].content = val;
    setCreateQForms(next);
  };
  const updateCreateChoiceContent = (qIdx, cIdx, val) => {
    const next = [...createQForms];
    next[qIdx].choices[cIdx].content = val;
    setCreateQForms(next);
  };
  const setCreateCorrectChoice = (qIdx, cIdx) => {
    const next = [...createQForms];
    next[qIdx].choices = next[qIdx].choices.map((c, i) => ({ ...c, is_correct: i === cIdx }));
    setCreateQForms(next);
  };

  async function createExam() {
    if (!token) return Alert.alert("Chưa đăng nhập", "Vui lòng đăng nhập lại.");
    if (!title.trim()) return Alert.alert("Thiếu", "Nhập tên bài kiểm tra");
    if (!startsAt || !endsAt) return Alert.alert("Thiếu", "Chọn thời gian bắt đầu & kết thúc");
    if (endsAt <= startsAt) return Alert.alert("Sai thời gian", "Kết thúc phải sau bắt đầu");

    // validate inline questions
    for (let i = 0; i < createQForms.length; i++) {
      const q = createQForms[i];
      if (!q.content.trim()) return Alert.alert("Thiếu nội dung", `Câu ${i + 1} chưa có nội dung`);
      const filled = q.choices.filter((c) => c.content.trim() !== "");
      if (![2, 4].includes(filled.length)) {
        return Alert.alert("Số đáp án không hợp lệ", `Câu ${i + 1} phải có 2 hoặc 4 đáp án`);
      }
      const has1Correct = q.choices.filter((c) => c.is_correct).length === 1;
      if (!has1Correct) return Alert.alert("Thiếu đáp án đúng", `Câu ${i + 1} phải chọn đúng 1 đáp án đúng`);
    }

    const body = {
      title: title.trim(),
      description: description.trim() || null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      max_questions: Math.max(1, Math.min(60, Number(numQuestions) || 1)),
    };

    try {
      setLoading(true);
      // 1) create exam
      const res = await fetch(`${BASE_URL}/api/exams`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) Alert.alert("Phiên đăng nhập hết hạn", "Vui lòng đăng nhập lại.");
        else Alert.alert("Tạo thất bại", data?.error || `HTTP ${res.status}`);
        return;
      }

      const examId = data?.id || data?.exam_id || data?.exam?.id;

      // 2) create questions + choices
      if (examId && createQForms.length > 0) {
        for (let i = 0; i < createQForms.length; i++) {
          const q = createQForms[i];

          const r1 = await fetch(`${BASE_URL}/api/questions/${examId}`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ content: q.content, meta: {} }),
          });
          const d1 = await r1.json().catch(() => ({}));
          if (!r1.ok) throw new Error(d1?.error || `Tạo câu ${i + 1} thất bại`);
          const questionId = d1?.question_id;

          const payload = q.choices
            .filter((c) => c.content.trim() !== "")
            .map((c) => ({ content: c.content.trim(), is_correct: c.is_correct }));

          const r2 = await fetch(`${BASE_URL}/api/questions/${questionId}/choices`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ choices: payload }),
          });
          const d2 = await r2.json().catch(() => ({}));
          if (!r2.ok) throw new Error(d2?.error || `Thêm đáp án cho câu ${i + 1} thất bại`);
        }
      }

      setVisibleCreate(false);
      setTitle("");
      setDescription("");
      setStartsAt(null);
      setEndsAt(null);
      setNumQuestions("0");
      setCreateQForms([]);

      await fetchMyExams();
      Alert.alert("Thành công", `Mã 6 số: ${data?.key_code || "(không có)"}`);
    } catch (e) {
      Alert.alert("Lỗi mạng", e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  function openEditTime(exam) {
    setEditExam(exam);
    setEStartsAt(exam?.starts_at ? new Date(exam.starts_at) : new Date());
    setEEndsAt(exam?.ends_at ? new Date(exam.ends_at) : new Date());
    setVisibleEdit(true);
  }

  async function submitEditTime() {
    if (!eStartsAt || !eEndsAt) return Alert.alert("Thiếu", "Chọn thời gian bắt đầu & kết thúc");
    if (eEndsAt <= eStartsAt) return Alert.alert("Sai thời gian", "Kết thúc phải sau bắt đầu");

    try {
      setEditSubmitting(true);
      const res = await fetch(`${BASE_URL}/api/exams/${editExam.id}`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({
          starts_at: eStartsAt.toISOString(),
          ends_at: eEndsAt.toISOString(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        Alert.alert("Sửa thất bại", data?.error || `HTTP ${res.status}`);
        return;
      }
      setVisibleEdit(false);
      await fetchMyExams();
      Alert.alert("Đã cập nhật thời gian");
    } catch (e) {
      Alert.alert("Lỗi mạng", e?.message || String(e));
    } finally {
      setEditSubmitting(false);
    }
  }

  async function deleteExam(exam) {
    Alert.alert("Xoá bài kiểm tra", `Bạn chắc muốn xoá "${exam.title}"?`, [
      { text: "Huỷ" },
      {
        text: "Xoá",
        style: "destructive",
        onPress: async () => {
          try {
            setLoading(true);
            const res = await fetch(`${BASE_URL}/api/exams/${exam.id}`, {
              method: "DELETE",
              headers: authHeaders,
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              Alert.alert("Xoá thất bại", data?.error || `HTTP ${res.status}`);
              return;
            }
            await fetchMyExams();
            Alert.alert("Đã xoá");
          } catch (e) {
            Alert.alert("Lỗi mạng", e?.message || String(e));
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  }

  // ====== GRADES (đã sửa: đọc data.rows) ======
  async function openGrades(exam) {
    if (!token) return Alert.alert("Chưa đăng nhập", "Vui lòng đăng nhập lại.");
    setCurrentExam(exam);
    setVisibleGrades(true);
    setGrades([]);
    try {
      setGradesLoading(true);
      const res = await fetch(`${BASE_URL}/api/exams/${exam.id}/grades`, {
        headers: authHeaders,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        Alert.alert("Lỗi", data?.error || `HTTP ${res.status}`);
        return;
      }
      // backend trả { total_rows, rows }
      setGrades(Array.isArray(data?.rows) ? data.rows : []);
    } catch (e) {
      Alert.alert("Lỗi mạng", e?.message || String(e));
    } finally {
      setGradesLoading(false);
    }
  }

  // ====== QUESTION EDITOR (existing exam) ======
  async function openQuestionEditor(exam) {
    setQExam(exam);
    setVisibleQEditor(true);
    setQForms([]);
    setQOriginal([]);
    try {
      setQLoading(true);
      const res = await fetch(`${BASE_URL}/api/exams/${exam.id}/questions/manage`, { headers: authHeaders });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        Alert.alert("Lỗi", data?.error || `HTTP ${res.status}`);
        return;
      }
      const normalized = (Array.isArray(data.questions) ? data.questions : data).map((q) => {
        const base = [
          { label: "A", content: "", is_correct: false },
          { label: "B", content: "", is_correct: false },
          { label: "C", content: "", is_correct: false },
          { label: "D", content: "", is_correct: false },
        ];
        (q.choices || []).forEach((ch, idx) => {
          if (idx < 4) {
            base[idx] = {
              ...base[idx],
              id: ch.id,
              content: String(ch.content ?? ""),
              is_correct: !!ch.is_correct,
            };
          }
        });
        return { id: q.id, content: String(q.content ?? ""), choices: base };
      });
      setQForms(normalized);
      setQOriginal(JSON.parse(JSON.stringify(normalized)));
    } catch (e) {
      Alert.alert("Lỗi mạng", e?.message || String(e));
    } finally {
      setQLoading(false);
    }
  }

  const updateQContent = (idx, val) => {
    const next = [...qForms];
    next[idx].content = String(val ?? "");
    setQForms(next);
  };
  const updateQChoiceContent = (qIdx, cIdx, val) => {
    const next = [...qForms];
    next[qIdx].choices[cIdx].content = String(val ?? "");
    setQForms(next);
  };
  const setQCorrectChoice = (qIdx, cIdx) => {
    const next = [...qForms];
    next[qIdx].choices = next[qIdx].choices.map((c, i) => ({ ...c, is_correct: i === cIdx }));
    setQForms(next);
  };

  async function saveQuestions() {
    if (!qExam) return;

    try {
      setQSaving(true);

      for (let i = 0; i < qForms.length; i++) {
        const q = qForms[i];
        const oq = qOriginal[i];

        // 1) update question text if changed
        const newQText = String(q.content ?? "").trim();
        const oldQText = String(oq.content ?? "").trim();
        if (newQText !== oldQText) {
          const rq = await fetch(`${BASE_URL}/api/questions/${q.id}`, {
            method: "PUT",
            headers: authHeaders,
            body: JSON.stringify({ content: newQText }),
          });
          const rj = await rq.json().catch(() => ({}));
          if (!rq.ok) throw new Error(rj?.error || `Update question ${i + 1} failed`);
        }

        // 2) update each changed choice
        for (let k = 0; k < q.choices.length; k++) {
          const c = q.choices[k];
          const oc = oq.choices[k];
          if (!c?.id) continue;

          const newText = String(c.content ?? "").trim();
          const oldText = String(oc.content ?? "").trim();
          const textChanged = newText !== oldText;
          const correctChanged = !!c.is_correct !== !!oc.is_correct;

          if (textChanged || correctChanged) {
            const payload = {};
            if (textChanged) payload.content = newText;
            if (correctChanged) payload.is_correct = !!c.is_correct;

            const rc = await fetch(`${BASE_URL}/api/choices/${c.id}`, {
              method: "PUT",
              headers: authHeaders,
              body: JSON.stringify(payload),
            });
            const rj = await rc.json().catch(() => ({}));
            if (!rc.ok) throw new Error(rj?.error || `Update choice of question ${i + 1} failed`);
          }
        }
      }

      Alert.alert("Đã lưu thay đổi");
      setVisibleQEditor(false);
    } catch (e) {
      Alert.alert("Lỗi khi lưu", e?.message || String(e));
    } finally {
      setQSaving(false);
    }
  }

  // ====== RENDER ITEM ======
  function renderExam({ item }) {
    return (
      <Pressable onPress={() => openQuestionEditor(item)} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
        <View style={styles.card}>
          <Text style={styles.examTitle}>{item.title}</Text>
          <Text style={styles.small}>Mã: <Text style={styles.bold}>{item.key_code}</Text></Text>
          <Text style={styles.small}>Thời gian: {fmt(item.starts_at)} → {fmt(item.ends_at)}</Text>
          <Text style={styles.small}>Số câu tối đa: {item.max_questions ?? 60}</Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: "#f39c12" }]}
              onPress={(e) => { e.stopPropagation?.(); openEditTime(item); }}
            >
              <Text style={styles.btnText}>Sửa thời gian</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: "#4A90E2" }]}
              onPress={(e) => { e.stopPropagation?.(); openGrades(item); }}
            >
              <Text style={styles.btnText}>Xem điểm</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: "#e74c3c" }]}
              onPress={(e) => { e.stopPropagation?.(); deleteExam(item); }}
            >
              <Text style={styles.btnText}>Xoá</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.header}>👨‍🏫 Teacher Screen</Text>
        <TouchableOpacity onPress={logout} style={styles.iconBtn} accessibilityLabel="Đăng xuất">
          <Entypo name="log-out" size={24} color="black" />
        </TouchableOpacity>
      </View>
      <Text style={styles.info}>
        Xin chào, {user?.full_name || user?.email} <Text style={styles.roleTag}>(teacher)</Text>
      </Text>

      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: token ? "#2ecc71" : "#aaa", flex: 1, marginRight: 8 }]}
          onPress={() => (token ? setVisibleCreate(true) : Alert.alert("Chưa đăng nhập", "Vui lòng đăng nhập lại."))}
        >
          <Text style={styles.btnText}>Tạo bài kiểm tra</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, { backgroundColor: "#8e44ad", flex: 1, marginLeft: 8 }]} onPress={fetchMyExams} disabled={!token}>
          <Text style={styles.btnText}>Tải lại</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" />
      ) : (
        <FlatList
          data={exams}
          keyExtractor={(it) => String(it.id)}
          renderItem={renderExam}
          ListEmptyComponent={<Text style={{ textAlign: "center", color: "#666" }}>Chưa có đề thi nào.</Text>}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}

      {/* ===== Modal: Create Exam ===== */}
      <Modal visible={visibleCreate} animationType="slide" onRequestClose={() => setVisibleCreate(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modal}>
          <Text style={styles.modalTitle}>Tạo bài kiểm tra</Text>

          <TextInput style={styles.input} placeholder="Tiêu đề" value={title} onChangeText={setTitle} />
          <TextInput style={styles.input} placeholder="Mô tả (tuỳ chọn)" value={description} onChangeText={setDescription} />

          <View style={styles.timeRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.hint}>Bắt đầu</Text>
              <TouchableOpacity style={styles.timeBtn} onPress={() => openCombinedPicker("create", "start")}>
                <Text style={styles.timeText}>{fmtLocal(startsAt)}</Text>
              </TouchableOpacity>
            </View>

            <View style={{ width: 12 }} />

            <View style={{ flex: 1 }}>
              <Text style={styles.hint}>Kết thúc</Text>
              <TouchableOpacity style={styles.timeBtn} onPress={() => openCombinedPicker("create", "end")}>
                <Text style={styles.timeText}>{fmtLocal(endsAt)}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Số lượng câu (1..60)"
            keyboardType="number-pad"
            value={numQuestions}
            onChangeText={setNumQuestions}
          />

          {createQForms.length > 0 && (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>
              {createQForms.map((q, qi) => (
                <View key={qi} style={styles.qBlock}>
                  <Text style={styles.qTitle}>Câu {qi + 1}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Nhập nội dung câu hỏi"
                    value={q.content}
                    onChangeText={(v) => updateCreateQContent(qi, v)}
                  />
                  {q.choices.map((c, ci) => (
                    <View key={ci} style={styles.choiceRow}>
                      <Text style={styles.choiceLabel}>{c.label}:</Text>
                      <TextInput
                        style={[styles.input, { flex: 1, marginVertical: 0 }]}
                        placeholder={`Đáp án ${c.label}`}
                        value={c.content}
                        onChangeText={(v) => updateCreateChoiceContent(qi, ci, v)}
                      />
                      <TouchableOpacity onPress={() => setCreateCorrectChoice(qi, ci)} style={styles.radioBox}>
                        <Text style={{ color: c.is_correct ? "#2ecc71" : "#888" }}>
                          {c.is_correct ? "●" : "○"}
                        </Text>
                      </TouchableOpacity>
                      <Text style={{ marginLeft: 6 }}>Đúng</Text>
                    </View>
                  ))}
                </View>
              ))}
            </ScrollView>
          )}

          <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
            <TouchableOpacity style={[styles.btn, { backgroundColor: "#4A90E2", flex: 1 }]} onPress={createExam}>
              <Text style={styles.btnText}>Tạo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, { backgroundColor: "#7f8c8d", flex: 1 }]} onPress={() => setVisibleCreate(false)}>
              <Text style={styles.btnText}>Đóng</Text>
            </TouchableOpacity>
          </View>

          {pickerVisible && (
            <DateTimePicker value={pickerValue} mode={pickerMode} display="default" onChange={onPickerChange} />
          )}
        </KeyboardAvoidingView>
      </Modal>

      {/* ===== Modal: Edit Time ===== */}
      <Modal visible={visibleEdit} animationType="slide" onRequestClose={() => setVisibleEdit(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modal}>
          <Text style={styles.modalTitle}>Sửa thời gian</Text>
          {editExam && <Text style={styles.small}>Đề: {editExam.title}</Text>}

          <View style={styles.timeRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.hint}>Bắt đầu</Text>
              <TouchableOpacity style={styles.timeBtn} onPress={() => openCombinedPicker("edit", "start")}>
                <Text style={styles.timeText}>{fmtLocal(eStartsAt)}</Text>
              </TouchableOpacity>
            </View>

            <View style={{ width: 12 }} />

            <View style={{ flex: 1 }}>
              <Text style={styles.hint}>Kết thúc</Text>
              <TouchableOpacity style={styles.timeBtn} onPress={() => openCombinedPicker("edit", "end")}>
                <Text style={styles.timeText}>{fmtLocal(eEndsAt)}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: editSubmitting ? "#95a5a6" : "#f39c12", flex: 1 }]}
              onPress={submitEditTime}
              disabled={editSubmitting}
            >
              {editSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Lưu</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, { backgroundColor: "#7f8c8d", flex: 1 }]} onPress={() => setVisibleEdit(false)}>
              <Text style={styles.btnText}>Đóng</Text>
            </TouchableOpacity>
          </View>

          {pickerVisible && (
            <DateTimePicker value={pickerValue} mode={pickerMode} display="default" onChange={onPickerChange} />
          )}
        </KeyboardAvoidingView>
      </Modal>

      {/* ===== Modal: Question Editor ===== */}
      <Modal visible={visibleQEditor} animationType="slide" onRequestClose={() => setVisibleQEditor(false)}>
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Câu hỏi & đáp án</Text>
          {qExam && (
            <>
              <Text style={styles.small}>Đề: {qExam.title}</Text>
              <Text style={styles.small}>Mã: {qExam.key_code}</Text>
            </>
          )}

          {qLoading ? (
            <ActivityIndicator size="large" />
          ) : qForms.length === 0 ? (
            <Text style={{ textAlign: "center", marginTop: 10 }}>Chưa có câu hỏi.</Text>
          ) : (
            <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
              {qForms.map((q, qi) => (
                <View key={q.id || qi} style={styles.qBlock}>
                  <Text style={styles.qTitle}>Câu {qi + 1}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Nội dung câu hỏi"
                    value={q.content}
                    onChangeText={(v) => updateQContent(qi, v)}
                  />
                  {q.choices.map((c, ci) => (
                    <View key={c.id || ci} style={styles.choiceRow}>
                      <Text style={styles.choiceLabel}>{c.label}:</Text>
                      <TextInput
                        style={[styles.input, { flex: 1, marginVertical: 0 }]}
                        placeholder={`Đáp án ${c.label}`}
                        value={c.content}
                        onChangeText={(v) => updateQChoiceContent(qi, ci, v)}
                      />
                      <TouchableOpacity onPress={() => setQCorrectChoice(qi, ci)} style={styles.radioBox}>
                        <Text style={{ color: c.is_correct ? "#2ecc71" : "#888" }}>
                          {c.is_correct ? "●" : "○"}
                        </Text>
                      </TouchableOpacity>
                      <Text style={{ marginLeft: 6 }}>Đúng</Text>
                    </View>
                  ))}
                </View>
              ))}
            </ScrollView>
          )}

          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: qSaving ? "#95a5a6" : "#1abc9c", flex: 1 }]}
              onPress={saveQuestions}
              disabled={qSaving}
            >
              {qSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Lưu thay đổi</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, { backgroundColor: "#7f8c8d", flex: 1 }]} onPress={() => setVisibleQEditor(false)}>
              <Text style={styles.btnText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ===== Modal: Grades ===== */}
      <Modal visible={visibleGrades} animationType="slide" onRequestClose={() => setVisibleGrades(false)}>
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Điểm bài kiểm tra</Text>
          {currentExam && (
            <>
              <Text style={styles.small}>Đề: {currentExam.title}</Text>
              <Text style={styles.small}>Mã: {currentExam.key_code}</Text>
            </>
          )}

          {gradesLoading ? (
            <ActivityIndicator size="large" />
          ) : grades.length === 0 ? (
            <Text style={{ textAlign: "center", marginTop: 10 }}>Chưa có bài nộp.</Text>
          ) : (
            <FlatList
              data={grades}
              keyExtractor={(it, idx) => String(it.submission_id || idx)}
              renderItem={({ item }) => (
                <View style={styles.gradeItem}>
                  <Text style={styles.gradeName}>
                    {item.full_name || item.email || item.student_id}
                  </Text>
                  <Text style={styles.gradeScore}>
                    {item.correct}/{item.total} • {item.score_pct}% • {item.score10}/10
                  </Text>
                  <Text style={styles.small}>
                    Nộp lúc: {new Date(item.submitted_at).toLocaleString()}
                  </Text>
                </View>
              )}
            />
          )}

          <TouchableOpacity style={[styles.btn, { backgroundColor: "#7f8c8d", marginTop: 12 }]} onPress={() => setVisibleGrades(false)}>
            <Text style={styles.btnText}>Đóng</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#EAF4FF" },
  header: { fontSize: 24, fontWeight: "bold", marginBottom: 6, color: "#99C2FF" },
  info: { marginBottom: 10, color: "#4A90E2" },
  roleTag: { color: "#4A90E2", fontWeight: "700" },

  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  iconBtn: { padding: 6, borderRadius: 8, backgroundColor: "transparent" },

  card: { padding: 12, backgroundColor: "#D0E7FF", borderRadius: 10, marginBottom: 10 },
  examTitle: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  small: { color: "#333" },
  bold: { fontWeight: "700" },

  btn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "bold" },

  input: { borderWidth: 1, borderColor: "#99C2FF", padding: 10, borderRadius: 8, marginVertical: 8, backgroundColor: "#fff" },
  hint: { fontSize: 12, color: "#777", marginTop: 4 },

  timeRow: { flexDirection: "row", marginTop: 6, marginBottom: 8 },
  timeBtn: { borderWidth: 1, borderColor: "#99C2FF", borderRadius: 8, padding: 10, backgroundColor: "#fff" },
  timeText: { color: "#333" },

  modal: { flex: 1, padding: 16, backgroundColor: "#fff" },
  modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 10 },

  qBlock: { padding: 10, borderRadius: 8, backgroundColor: "#F5FAFF", marginBottom: 12, borderWidth: 1, borderColor: "#DCEEFF" },
  qTitle: { fontSize: 16, fontWeight: "700", marginBottom: 6 },
  choiceRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  choiceLabel: { width: 18, fontWeight: "700" },
  radioBox: { padding: 8, borderWidth: 1, borderColor: "#ddd", borderRadius: 8, marginLeft: 6 },

  gradeItem: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#ddd" },
  gradeName: { fontSize: 16, fontWeight: "600" },
  gradeScore: { color: "#333", marginTop: 2 },
});
