import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Pressable, ScrollView, Keyboard, Platform, SafeAreaView } from "react-native";
import { Entypo } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../store/slices/authSlice";
import { fetchLatestResult, joinExam, submitAnswers, setCode, togglePick } from "../store/slices/studentSlice";


export default function StudentScreen({ navigation }) {
const dispatch = useDispatch();
const { token } = useSelector((s) => s.auth);
const { code, exam, questions, picked, lastResult, loading } = useSelector((s) => s.student);
const [kbHeight, setKbHeight] = useState(0);


useEffect(() => {
const onShow = (e) => setKbHeight(e.endCoordinates.height);
const onHide = () => setKbHeight(0);
const s1 = Keyboard.addListener("keyboardDidShow", onShow);
const s2 = Keyboard.addListener("keyboardDidHide", onHide);
return () => { s1.remove(); s2.remove(); };
}, []);


useEffect(() => { if (token) dispatch(fetchLatestResult()); }, [token]);


const handleStart = async () => {
const clean = (code || "").trim();
if (!/^\d{6}$/.test(clean)) return Alert.alert("Không thể bắt đầu", "Mã bài kiểm tra cần 6 chữ số.");
const action = await dispatch(joinExam(clean));
if (joinExam.rejected.match(action)) Alert.alert("Không thể bắt đầu", action.payload || "Lỗi");
else Keyboard.dismiss();
};


const submitConfirm = () => {
if (!exam) return;
const answered = Object.keys(picked).length;
if (answered === 0) return Alert.alert("Chưa chọn đáp án", "Bạn chưa chọn đáp án nào.");
Alert.alert("Nộp bài", "Bạn chắc chắn với đáp án đã chọn?", [
{ text: "Huỷ" },
{ text: "Nộp bài", style: "destructive", onPress: submitNow },
]);
};


const submitNow = async () => {
const answers = Object.entries(picked).map(([qid, cid]) => ({ question_id: Number(qid), choice_id: Number(cid) }));
const action = await dispatch(submitAnswers({ examId: exam.id, answers }));
if (submitAnswers.rejected.match(action)) Alert.alert("Nộp bài thất bại", action.payload || "Lỗi");
else Alert.alert("Đã nộp bài", "Bài của bạn đã được ghi nhận.");
};


const onLogout = async () => { dispatch(logout()); navigation.replace("Login"); };


const renderChoice = (q, ch, idx) => {
const labels = ["A", "B", "C", "D"];
const checked = picked[q.id] === ch.id;
return (
<Pressable key={ch.id || idx} onPress={() => dispatch(togglePick({ qid: q.id, cid: ch.id }))} style={styles.choiceRow}>
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
<TouchableOpacity onPress={onLogout} style={styles.iconBtn} accessibilityLabel="Đăng xuất">
<Entypo name="log-out" size={24} color="black" />
</TouchableOpacity>
</View>
<Text style={styles.subtitle}>Nhập mã bài kiểm tra để bắt đầu:</Text>


{lastResult && !exam && (
<View style={styles.resultCard}>
<Text style={styles.resultTitle}>{lastResult.title || "Bài đã nộp"}</Text>
{!!lastResult.description && <Text style={styles.resultDesc}>{lastResult.description}</Text>}
<Text style={styles.resultLine}>Câu: {lastResult.correct}/{lastResult.total} • Điểm: {lastResult.grade10}/10</Text>
</View>
)}


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


{!exam && (
<View style={[styles.footer, { bottom: 16 + kbHeight }]}>
<TextInput style={styles.input} placeholder="Mã bài kiểm tra (6 chữ số)" keyboardType="number-pad" value={code} onChangeText={(v) => dispatch(setCode(v.replace(/\D/g, "")))} maxLength={6} />
<TouchableOpacity style={[styles.button, (code.length !== 6 || !token || loading) && { opacity: 0.5 }]} onPress={handleStart} disabled={code.length !== 6 || !token || loading}>
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
footer: { position: "absolute", left: 16, right: 16 },
input: { borderWidth: 1, borderColor: "#BFD4FF", backgroundColor: "#fff", padding: 12, borderRadius: 10, marginBottom: 12 },
button: { backgroundColor: "#1E5CC6", paddingVertical: 12, borderRadius: 10, alignItems: "center" },
buttonText: { color: "#fff", fontWeight: "bold" },
resultCard: { backgroundColor: "#E8F0FF", borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "#C9DBFF" },
resultTitle: { fontSize: 16, fontWeight: "700", color: "#1E5CC6" },
resultDesc: { color: "#555", marginTop: 4 },
resultLine: { marginTop: 6, fontWeight: "600", color: "#333" },
examHeader: { backgroundColor: "#E8F0FF", borderRadius: 12, padding: 12, marginBottom: 10 },
examTitle: { fontSize: 18, fontWeight: "700", color: "#1E5CC6" },
examDesc: { color: "#555", marginTop: 4 },
qBlock: { backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "#E1E9FF" },
qTitle: { fontSize: 16, fontWeight: "700", color: "#1E5CC6", marginBottom: 6 },
qContent: { color: "#333" },
choiceRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#eee" },
choiceLabel: { width: 20, fontWeight: "700", color: "#1E5CC6" },
choiceText: { flex: 1, color: "#333" },
radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: "#A9C4FF" },
radioChecked: { backgroundColor: "#1E5CC6", borderColor: "#1E5CC6" },
submitBtn: { position: "absolute", left: 16, right: 16, bottom: 16 },
});