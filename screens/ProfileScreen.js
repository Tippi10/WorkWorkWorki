import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Modal, TextInput, SafeAreaView, Dimensions,
} from 'react-native';
import { useApp } from '../context/AppContext';

const { width } = Dimensions.get('window');
const DAY_HEADERS = ['一', '二', '三', '四', '五', '六', '日'];
const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

function toKey(date) {
  return date.toISOString().split('T')[0];
}

function loadBodyStats() {
  try { return JSON.parse(localStorage.getItem('wwk_body_stats') || '[]'); } catch { return []; }
}
function saveBodyStats(s) {
  try { localStorage.setItem('wwk_body_stats', JSON.stringify(s)); } catch {}
}

function buildCalendar(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1; // Mon = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid = [];
  let day = 1;
  for (let w = 0; w < 6; w++) {
    const row = [];
    for (let col = 0; col < 7; col++) {
      const idx = w * 7 + col;
      row.push(idx < startOffset || day > daysInMonth ? null : day++);
    }
    grid.push(row);
    if (day > daysInMonth) break;
  }
  return grid;
}

function calcStreak(workoutKeys) {
  if (!workoutKeys.length) return 0;
  const set = new Set(workoutKeys);
  const todayKey = toKey(new Date());
  let streak = 0;
  let d = new Date();
  while (true) {
    const k = toKey(d);
    if (set.has(k)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else if (k === todayKey) {
      d.setDate(d.getDate() - 1); // allow today to be empty
    } else {
      break;
    }
  }
  return streak;
}

// 折線段：用絕對定位 + 旋轉畫斜線
function LineSegment({ x1, y1, x2, y2, color }) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  return (
    <View style={{
      position: 'absolute',
      width: len, height: 2,
      backgroundColor: color,
      left: (x1 + x2) / 2 - len / 2,
      top: (y1 + y2) / 2 - 1,
      transform: [{ rotate: `${angle}deg` }],
    }} />
  );
}

function MiniChart({ entries, valueKey, color, unit, chartW }) {
  const PAD = 12;
  const H = 110;
  const data = entries.filter(e => e[valueKey] != null);
  if (data.length < 2) {
    return (
      <View style={[styles.chartEmpty, { height: H }]}>
        <Text style={styles.chartEmptyText}>記錄 2 筆以上才會顯示折線</Text>
      </View>
    );
  }
  const vals = data.map(d => d[valueKey]);
  const minV = Math.min(...vals), maxV = Math.max(...vals);
  const range = maxV - minV || 1;
  const toX = i => PAD + (i / (data.length - 1)) * (chartW - PAD * 2);
  const toY = v => PAD + (1 - (v - minV) / range) * (H - PAD * 2);
  const pts = data.map((d, i) => ({ x: toX(i), y: toY(d[valueKey]) }));

  return (
    <View style={{ height: H, position: 'relative' }}>
      {pts.map((p, i) => i === 0 ? null : (
        <LineSegment key={i} x1={pts[i-1].x} y1={pts[i-1].y} x2={p.x} y2={p.y} color={color} />
      ))}
      {pts.map((p, i) => (
        <View key={`d${i}`} style={{
          position: 'absolute', width: 7, height: 7, borderRadius: 4,
          backgroundColor: color, left: p.x - 3.5, top: p.y - 3.5,
        }} />
      ))}
      <Text style={[styles.chartAxisLabel, { position: 'absolute', right: 0, top: PAD - 8 }]}>
        {maxV.toFixed(1)}{unit}
      </Text>
      <Text style={[styles.chartAxisLabel, { position: 'absolute', right: 0, bottom: PAD - 8 }]}>
        {minV.toFixed(1)}{unit}
      </Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { planner, clips } = useApp();
  const today = new Date();
  const todayKey = toKey(today);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [bodyStats, setBodyStats] = useState(loadBodyStats);
  const [logModal, setLogModal] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [bodyFatInput, setBodyFatInput] = useState('');
  const [chartW, setChartW] = useState(width - 64);

  const workoutDays = Object.entries(planner).filter(([, ids]) => ids.length > 0);
  const workoutKeySet = new Set(workoutDays.map(([k]) => k));
  const totalWorkouts = workoutDays.length;
  const streak = calcStreak(workoutDays.map(([k]) => k));
  const savedCount = clips.length;

  const grid = buildCalendar(viewYear, viewMonth);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  function handleLog() {
    const w = parseFloat(weightInput);
    const bf = parseFloat(bodyFatInput);
    if (isNaN(w) && isNaN(bf)) return;
    const next = bodyStats.filter(e => e.date !== todayKey);
    const entry = { date: todayKey, weight: isNaN(w) ? null : w, bodyFat: isNaN(bf) ? null : bf };
    next.push(entry);
    next.sort((a, b) => a.date.localeCompare(b.date));
    setBodyStats(next);
    saveBodyStats(next);
    setWeightInput('');
    setBodyFatInput('');
    setLogModal(false);
  }

  const recent = bodyStats.slice(-20);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>

        {/* 標題 */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        {/* 統計三格 */}
        <View style={styles.statsRow}>
          {[
            { label: 'Workouts', value: totalWorkouts, icon: '🏋️' },
            { label: 'Day Streak', value: streak, icon: '🔥' },
            { label: 'Saved', value: savedCount, icon: '📌' },
          ].map(s => (
            <View key={s.label} style={styles.statBox}>
              <Text style={styles.statIcon}>{s.icon}</Text>
              <Text style={styles.statNum}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* 月曆 */}
        <View style={styles.calCard}>
          {/* 月份導航 */}
          <View style={styles.calNav}>
            <TouchableOpacity onPress={prevMonth} style={styles.calNavBtn}>
              <Text style={styles.calNavArrow}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.calNavTitle}>
              {viewYear}年 {MONTH_NAMES[viewMonth]}
            </Text>
            <TouchableOpacity onPress={nextMonth} style={styles.calNavBtn}>
              <Text style={styles.calNavArrow}>›</Text>
            </TouchableOpacity>
          </View>

          {/* 星期標頭 */}
          <View style={styles.calWeekHeader}>
            {DAY_HEADERS.map(d => (
              <Text key={d} style={styles.calWeekLabel}>{d}</Text>
            ))}
          </View>

          {/* 日期格 */}
          {grid.map((row, wi) => (
            <View key={wi} style={styles.calRow}>
              {row.map((day, di) => {
                if (!day) return <View key={di} style={styles.calCell} />;
                const dateKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isToday = dateKey === todayKey;
                const hasWorkout = workoutKeySet.has(dateKey);
                return (
                  <View key={di} style={styles.calCell}>
                    <View style={[styles.calDayInner, isToday && styles.calDayToday]}>
                      <Text style={[styles.calDayNum, isToday && styles.calDayNumToday]}>
                        {day}
                      </Text>
                    </View>
                    {hasWorkout && <View style={[styles.calDot, isToday && styles.calDotToday]} />}
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        {/* 體重體脂 */}
        <View style={styles.chartSection}>
          <View style={styles.chartSectionHeader}>
            <Text style={styles.chartSectionTitle}>身體數據</Text>
            <TouchableOpacity style={styles.logBtn} onPress={() => setLogModal(true)}>
              <Text style={styles.logBtnText}>＋ 記錄今日</Text>
            </TouchableOpacity>
          </View>

          <View onLayout={e => setChartW(e.nativeEvent.layout.width)}>
            <Text style={styles.chartLabel}>體重（kg）</Text>
            <MiniChart entries={recent} valueKey="weight" color="#a78bfa" unit=" kg" chartW={chartW} />
            <Text style={[styles.chartLabel, { marginTop: 20 }]}>體脂率（%）</Text>
            <MiniChart entries={recent} valueKey="bodyFat" color="#34d399" unit="%" chartW={chartW} />
          </View>
        </View>

      </ScrollView>

      {/* 記錄 Modal */}
      <Modal visible={logModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>記錄今日數據</Text>
            <Text style={styles.modalDate}>{todayKey}</Text>
            <Text style={styles.inputLabel}>體重（kg）</Text>
            <TextInput
              style={styles.input}
              placeholder="例：68.5"
              placeholderTextColor="#555"
              keyboardType="numeric"
              value={weightInput}
              onChangeText={setWeightInput}
            />
            <Text style={styles.inputLabel}>體脂率（%）</Text>
            <TextInput
              style={styles.input}
              placeholder="例：18.2"
              placeholderTextColor="#555"
              keyboardType="numeric"
              value={bodyFatInput}
              onChangeText={setBodyFatInput}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setLogModal(false)}>
                <Text style={styles.cancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleLog}>
                <Text style={styles.confirmText}>儲存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0d0d0d' },

  header: {
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#1e1e1e',
  },
  headerTitle: { color: '#fff', fontSize: 26, fontWeight: 'bold' },

  statsRow: { flexDirection: 'row', gap: 10, margin: 16 },
  statBox: {
    flex: 1, backgroundColor: '#1a1a1a', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  statIcon: { fontSize: 22, marginBottom: 6 },
  statNum: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  statLabel: { color: '#666', fontSize: 11, marginTop: 3 },

  calCard: {
    backgroundColor: '#1a1a1a', borderRadius: 16,
    marginHorizontal: 16, padding: 16, marginBottom: 16,
  },
  calNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  calNavBtn: { padding: 8 },
  calNavArrow: { color: '#fff', fontSize: 26, fontWeight: '300' },
  calNavTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  calWeekHeader: { flexDirection: 'row', marginBottom: 8 },
  calWeekLabel: { flex: 1, textAlign: 'center', color: '#666', fontSize: 12 },
  calRow: { flexDirection: 'row', marginBottom: 4 },
  calCell: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  calDayInner: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  calDayToday: { backgroundColor: '#a78bfa' },
  calDayNum: { color: '#ccc', fontSize: 14 },
  calDayNumToday: { color: '#fff', fontWeight: '700' },
  calDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#a78bfa', marginTop: 1 },
  calDotToday: { backgroundColor: '#fff' },

  chartSection: {
    backgroundColor: '#1a1a1a', borderRadius: 16,
    marginHorizontal: 16, padding: 16, marginBottom: 16,
  },
  chartSectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16,
  },
  chartSectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  logBtn: { backgroundColor: '#2a2a2a', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  logBtnText: { color: '#a78bfa', fontSize: 13, fontWeight: '600' },
  chartLabel: { color: '#888', fontSize: 12, marginBottom: 8 },
  chartEmpty: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#111', borderRadius: 8 },
  chartEmptyText: { color: '#444', fontSize: 12 },
  chartAxisLabel: { color: '#555', fontSize: 10 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: '#1a1a1a', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: 40,
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  modalDate: { color: '#666', fontSize: 13, marginTop: 4, marginBottom: 20 },
  inputLabel: { color: '#888', fontSize: 13, marginBottom: 6 },
  input: {
    backgroundColor: '#2a2a2a', color: '#fff',
    borderRadius: 10, padding: 14, fontSize: 15, marginBottom: 16,
  },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#2a2a2a', alignItems: 'center' },
  cancelText: { color: '#888', fontWeight: '600' },
  confirmBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#a78bfa', alignItems: 'center' },
  confirmText: { color: '#fff', fontWeight: '700' },
});
