// src/screens/TeacherScreen.js (Redux version)
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
import DateTimePicker from "@react-native-community/datetimepicker";
import { Entypo } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../store/slices/authSlice";
import {
  fetchMyExams,
  createExam,
  updateExamTime,
  deleteExam,
  fetchGrades,
} from "../store/slices/teacherSlice";

export default function TeacherScreen({ navigation }) {
  const dispatch = useDispatch();
  const { user, token } = useSelector((s) => s.auth);
  const { exams, loading, gradesByExam } = useSelector((s) => s.teacher);

  // Create Exam Modal
  const [visibleCreate, setVisibleCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState(null); // Date
  const [endsAt, setEndsAt] = useState(null);     // Date
  const [numQuestions, setNumQuestions] = useState("0");
  const [createQForms, setCreateQForms] = useState([]);

  // Edit Time Modal
  const [visibleEdit, setVisibleEdit] = useState(false);
  const [editExam, setEditExam] = useState(null);
  const [eStartsAt, setEStartsAt] = useState(null);
  const [eEndsAt, setEEndsAt] = useState(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Grades Modal
  const [visibleGrades, setVisibleGrades] = useState(false);
  const [currentExam, setCurrentExam] = useState(null);

  // One DateTimePicker (reusable)
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerMode, setPickerMode] = useState("date");
  const [pickerValue, setPickerValue] = useState(new Date());
  const [tempDate, setTempDate] = useState(null);
  const [activeCtx, setActiveCtx] = useState(null);     // 'create' | 'edit'
  const [activeField, setActiveField] = useState(null); // 'start' | 'end'

  useEffect(() => {
    if (token) dispatch(fetchMyExams());
  }, [token]);

  // Helpers
  const fmt = (iso) => {
    if (!iso) return "-";
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  };
  const fmtLocal = (d) => (d ? d.toLocaleString() : "Chưa chọn");
  const mergeDateTime = (datePart, timePart) => {
    const d = new Date(datePart);
    const t = new Date(timePart);
    return new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
      t.getHours(),
      t.getMinutes(),
      0,
      0
    );
  };

  // DateTime picker flow
  const openCombinedPicker = (ctx, field) => {
    setActiveCtx(ctx);
    setActiveField(field);
    setPickerMode("date");

    const base =
      ctx === "create"
        ? field === "start"
          ? startsAt || new Date()
          : endsAt || (startsAt ? new Date(startsAt.getTime() + 15 * 60000) : new Date())
        : field === "start"
          ? eStartsAt || new Date()
          : eEndsAt || (eStartsAt ? new Date(eStartsAt.getTime() + 15 * 60000) : new Date());

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

  // Build create exam forms
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

  // Actions
  const onLogout = () => {
    dispatch(logout());
    navigation.replace("Login");
  };

  const onCreateExam = async () => {
    if (!title.trim()) return Alert.alert("Thiếu", "Nhập tên bài kiểm tra");
    if (!startsAt || !endsAt) return Alert.alert("Thiếu", "Chọn thời gian bắt đầu & kết thúc");
    if (endsAt <= startsAt) return Alert.alert("Sai thời gian", "Kết thúc phải sau bắt đầu");

    // Validate
    for (let i = 0; i < createQForms.length; i++) {
      const q = createQForms[i];
      if (!q.content.trim()) return Alert.alert("Thiếu nội dung", `Câu ${i + 1} chưa có nội dung`);
      const filled = q.choices.filter((c) => (c.content || "").trim() !== "");
      if (![2, 4].includes(filled.length)) {
        return Alert.alert("Số đáp án không hợp lệ", `Câu ${i + 1} phải có 2 hoặc 4 đáp án`);
      }
      const has1Correct = q.choices.filter((c) => c.is_correct).length === 1;
      if (!has1Correct) return Alert.alert("Thiếu đáp án đúng", `Câu ${i + 1} phải chọn đúng 1 đáp án đúng`);
    }

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      numQuestions,
      qForms: createQForms,
    };

    const action = await dispatch(createExam(payload));
    if (createExam.rejected.match(action)) {
      return Alert.alert("Tạo thất bại", action.payload || "Lỗi");
    }

    setVisibleCreate(false);
    setTitle("");
    setDescription("");
    setStartsAt(null);
    setEndsAt(null);
    setNumQuestions("0");
    setCreateQForms([]);

    dispatch(fetchMyExams());
  };

  const openEditTime = (exam) => {
    setEditExam(exam);
    setEStartsAt(exam?.starts_at ? new Date(exam.starts_at) : new Date());
    setEEndsAt(exam?.ends_at ? new Date(exam.ends_at) : new Date());
    setVisibleEdit(true);
  };

  const submitEditTime = async () => {
    if (!eStartsAt || !eEndsAt) return Alert.alert("Thiếu", "Chọn thời gian bắt đầu & kết thúc");
    if (eEndsAt <= eStartsAt) return Alert.alert("Sai thời gian", "Kết thúc phải sau bắt đầu");
    setEditSubmitting(true);
    const action = await dispatch(
      updateExamTime({
        id: editExam.id,
        starts_at: eStartsAt.toISOString(),
        ends_at: eEndsAt.toISOString(),
      })
    );
    setEditSubmitting(false);
    if (updateExamTime.rejected.match(action)) {
      return Alert.alert("Sửa thất bại", action.payload || "Lỗi");
    }
    setVisibleEdit(false);
    dispatch(fetchMyExams());
    Alert.alert("Đã cập nhật thời gian");
  };

  const onDeleteExam = (exam) => {
    Alert.alert("Xoá bài kiểm tra", `Bạn chắc muốn xoá "${exam.title}"?`, [
      { text: "Huỷ" },
      {
        text: "Xoá",
        style: "destructive",
        onPress: async () => {
          const action = await dispatch(deleteExam(exam.id));
          if (deleteExam.rejected.match(action)) {
            Alert.alert("Xoá thất bại", action.payload || "Lỗi");
          } else {
            dispatch(fetchMyExams());
          }
        },
      },
    ]);
  };

  const openGrades = async (exam) => {
    setCurrentExam(exam);
    setVisibleGrades(true);
    await dispatch(fetchGrades(exam.id));
  };

  // Render
  const renderExam = ({ item }) => (
    <Pressable style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
      <View style={styles.card}>
        <Text style={styles.examTitle}>{item.title}</Text>
        <Text style={styles.small}>
          Mã: <Text style={styles.bold}>{item.key_code}</Text>
        </Text>
        <Text style={styles.small}>Thời gian: {fmt(item.starts_at)} → {fmt(item.ends_at)}</Text>
        <Text style={styles.small}>Số câu tối đa: {item.max_questions ?? 60}</Text>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: "#f39c12" }]}
            onPress={() => openEditTime(item)}
          >
            <Text style={styles.btnText}>Sửa thời gian</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: "#4A90E2" }]}
            onPress={() => openGrades(item)}
          >
            <Text style={styles.btnText}>Xem điểm</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: "#e74c3c" }]}
            onPress={() => onDeleteExam(item)}
          >
            <Text style={styles.btnText}>Xoá</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      {/* Top bar with logout */}
      <View style={styles.topBar}>
        <Text style={styles.header}>👨‍🏫 Teacher Screen</Text>
        <TouchableOpacity onPress={onLogout} style={styles.iconBtn} accessibilityLabel="Đăng xuất">
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

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: "#8e44ad", flex: 1, marginLeft: 8 }]}
          onPress={() => dispatch(fetchMyExams())}
          disabled={!token}
        >
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

      {/* Create Exam Modal */}
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
                        <Text style={{ color: c.is_correct ? "#2ecc71" : "#888" }}>{c.is_correct ? "●" : "○"}</Text>
                      </TouchableOpacity>
                      <Text style={{ marginLeft: 6 }}>Đúng</Text>
                    </View>
                  ))}
                </View>
              ))}
            </ScrollView>
          )}

          <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
            <TouchableOpacity style={[styles.btn, { backgroundColor: "#4A90E2", flex: 1 }]} onPress={onCreateExam}>
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

      {/* Edit Time Modal */}
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

      {/* Grades Modal */}
      <Modal visible={visibleGrades} animationType="slide" onRequestClose={() => setVisibleGrades(false)}>
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Điểm bài kiểm tra</Text>
          {currentExam && (
            <>
              <Text style={styles.small}>Đề: {currentExam.title}</Text>
              <Text style={styles.small}>Mã: {currentExam.key_code}</Text>
            </>
          )}

          {(() => {
            const rows = gradesByExam[currentExam?.id] || [];
            if (!rows.length) return <Text style={{ textAlign: "center", marginTop: 10 }}>Chưa có bài nộp.</Text>;
            return (
              <FlatList
                data={rows}
                keyExtractor={(it, idx) => String(it.submission_id || idx)}
                renderItem={({ item }) => (
                  <View style={styles.gradeItem}>
                    <Text style={styles.gradeName}>{item.full_name || item.email || item.student_id}</Text>
                    <Text style={styles.gradeScore}>
                      {item.correct}/{item.total} • {item.score_pct}% • {item.score10}/10
                    </Text>
                    <Text style={styles.small}>Nộp lúc: {new Date(item.submitted_at).toLocaleString()}</Text>
                  </View>
                )}
              />
            );
          })()}

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: "#7f8c8d", marginTop: 12 }]}
            onPress={() => setVisibleGrades(false)}
          >
            <Text style={styles.btnText}>Đóng</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#EAF4FF" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  iconBtn: { padding: 6, borderRadius: 8, backgroundColor: "transparent" },

  header: { fontSize: 24, fontWeight: "bold", color: "#99C2FF" },
  info: { marginBottom: 10, color: "#4A90E2" },
  roleTag: { color: "#4A90E2", fontWeight: "700" },

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
