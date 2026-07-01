import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Modal, TextInput, SafeAreaView,
} from 'react-native';
import { useApp } from '../context/AppContext';

const DAY_HEADERS = ['一', '二', '三', '四', '五', '六', '日'];
const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

function toKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function loadBodyStats() {
  try { return JSON.parse(localStorage.getItem('wwk_body_stats') || '[]'); } catch { return []; }
}
function saveBodyStats(s) {
  try { localStorage.setItem('wwk_body_stats', JSON.stringify(s)); } catch {}
}
function loadBodyGoals() {
  try { return JSON.parse(localStorage.getItem('wwk_body_goals') || 'null'); } catch { return null; }
}
function saveBodyGoals(g) {
  try { localStorage.setItem('wwk_body_goals', JSON.stringify(g)); } catch {}
}

function buildCalendar(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;
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
  const d = new Date();
  while (true) {
    const k = toKey(d);
    if (set.has(k)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else if (k === todayKey) {
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function ProgressBar({ label, start, target, current, unit }) {
  const [barW, setBarW] = useState(0);

  const hasGoal = start != null && target != null;
  const hasData = current != null;
  const range = hasGoal ? (target - start) || 1 : 1;
  const rawProgress = hasGoal && hasData ? (current - start) / range : 0;
  const progress = Math.max(0, Math.min(rawProgress, 1));
  const fillW = barW * progress;
  const runnerLeft = fillW - 14;
  const fmt = v => (v != null ? Number(v).toFixed(1) : '—');

  return (
    <View style={styles.progressWrapper}>
      <Text style={styles.progressLabel}>{label}</Text>
      <View style={styles.progressTrackRow}>
        <Text style={styles.progressEndLabel}>{hasGoal ? `${fmt(start)}${unit}` : '—'}</Text>
        <View
          style={styles.progressTrack}
          onLayout={e => setBarW(e.nativeEvent.layout.width)}
        >
          {hasGoal && hasData && barW > 0 ? (
            <>
              <View style={[styles.progressFill, { width: Math.max(0, fillW) }]}>
                <View style={styles.progressFillShine} />
              </View>
              <Text style={[styles.progressRunner, { left: Math.max(0, runnerLeft) }]}>🏃‍➡️</Text>
            </>
          ) : (
            <Text style={styles.progressEmptyText}>
              {!hasGoal ? '設定目標後顯示' : '尚未記錄數據'}
            </Text>
          )}
        </View>
        <Text style={styles.progressEndLabel}>{hasGoal ? `${fmt(target)}${unit}` : '—'}</Text>
      </View>
      {hasData && hasGoal && (
        <Text style={styles.progressCurrentLabel}>
          目前 {fmt(current)}{unit}　進度 {Math.round(progress * 100)}%
        </Text>
      )}
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
  const [bodyGoals, setBodyGoals] = useState(loadBodyGoals);

  const [logModal, setLogModal] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [bodyFatInput, setBodyFatInput] = useState('');

  const [goalModal, setGoalModal] = useState(false);
  const [gStartW, setGStartW] = useState('');
  const [gTargetW, setGTargetW] = useState('');
  const [gStartBF, setGStartBF] = useState('');
  const [gTargetBF, setGTargetBF] = useState('');

  const workoutDays = Object.entries(planner).filter(([, ids]) => ids.length > 0);
  const workoutKeySet = new Set(workoutDays.map(([k]) => k));
  const totalWorkouts = workoutDays.length;
  const streak = calcStreak(workoutDays.map(([k]) => k));
  const savedCount = clips.length;

  const grid = buildCalendar(viewYear, viewMonth);

  const latestStats = bodyStats.length > 0 ? bodyStats[bodyStats.length - 1] : null;
  const currentWeight = latestStats?.weight ?? null;
  const currentBodyFat = latestStats?.bodyFat ?? null;

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

  function openGoalModal() {
    setGStartW(bodyGoals?.startWeight?.toString() ?? '');
    setGTargetW(bodyGoals?.targetWeight?.toString() ?? '');
    setGStartBF(bodyGoals?.startBodyFat?.toString() ?? '');
    setGTargetBF(bodyGoals?.targetBodyFat?.toString() ?? '');
    setGoalModal(true);
  }

  function handleSaveGoals() {
    const sw = parseFloat(gStartW);
    const tw = parseFloat(gTargetW);
    const sbf = parseFloat(gStartBF);
    const tbf = parseFloat(gTargetBF);
    const goals = {
      startWeight: isNaN(sw) ? null : sw,
      targetWeight: isNaN(tw) ? null : tw,
      startBodyFat: isNaN(sbf) ? null : sbf,
      targetBodyFat: isNaN(tbf) ? null : tbf,
    };
    setBodyGoals(goals);
    saveBodyGoals(goals);
    setGoalModal(false);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>

        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

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

        <View style={styles.calCard}>
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

          <View style={styles.calWeekHeader}>
            {DAY_HEADERS.map(d => (
              <Text key={d} style={styles.calWeekLabel}>{d}</Text>
            ))}
          </View>

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

        <View style={styles.bodySection}>
          <View style={styles.bodySectionHeader}>
            <Text style={styles.bodySectionTitle}>身體數據</Text>
            <View style={styles.bodyBtns}>
              <TouchableOpacity style={styles.goalBtn} onPress={openGoalModal}>
                <Text style={styles.goalBtnText}>設定目標</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.logBtn} onPress={() => setLogModal(true)}>
                <Text style={styles.logBtnText}>＋ 記錄今日</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ProgressBar
            label="體重"
            start={bodyGoals?.startWeight ?? null}
            target={bodyGoals?.targetWeight ?? null}
            current={currentWeight}
            unit=" kg"
          />

          <View style={styles.divider} />

          <ProgressBar
            label="體脂率"
            start={bodyGoals?.startBodyFat ?? null}
            target={bodyGoals?.targetBodyFat ?? null}
            current={currentBodyFat}
            unit="%"
          />
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
              keyboardType="decimal-pad"
              value={weightInput}
              onChangeText={setWeightInput}
            />
            <Text style={styles.inputLabel}>體脂率（%）</Text>
            <TextInput
              style={styles.input}
              placeholder="例：18.2"
              placeholderTextColor="#555"
              keyboardType="decimal-pad"
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

      {/* 目標 Modal */}
      <Modal visible={goalModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView>
            <View style={[styles.modalBox, { marginTop: 'auto' }]}>
              <Text style={styles.modalTitle}>設定目標</Text>
              <Text style={styles.modalDate}>設定後進度條會追蹤你的變化</Text>
              <Text style={styles.inputLabel}>最初體重（kg）</Text>
              <TextInput
                style={styles.input}
                placeholder="例：75.0"
                placeholderTextColor="#555"
                keyboardType="decimal-pad"
                value={gStartW}
                onChangeText={setGStartW}
              />
              <Text style={styles.inputLabel}>目標體重（kg）</Text>
              <TextInput
                style={styles.input}
                placeholder="例：65.0"
                placeholderTextColor="#555"
                keyboardType="decimal-pad"
                value={gTargetW}
                onChangeText={setGTargetW}
              />
              <Text style={styles.inputLabel}>最初體脂（%）</Text>
              <TextInput
                style={styles.input}
                placeholder="例：25.0"
                placeholderTextColor="#555"
                keyboardType="decimal-pad"
                value={gStartBF}
                onChangeText={setGStartBF}
              />
              <Text style={styles.inputLabel}>目標體脂（%）</Text>
              <TextInput
                style={styles.input}
                placeholder="例：15.0"
                placeholderTextColor="#555"
                keyboardType="decimal-pad"
                value={gTargetBF}
                onChangeText={setGTargetBF}
              />
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setGoalModal(false)}>
                  <Text style={styles.cancelText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmBtn} onPress={handleSaveGoals}>
                  <Text style={styles.confirmText}>儲存</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
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

  bodySection: {
    backgroundColor: '#1a1a1a', borderRadius: 16,
    marginHorizontal: 16, padding: 16, marginBottom: 16,
  },
  bodySectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20,
  },
  bodySectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  bodyBtns: { flexDirection: 'row', gap: 8 },
  goalBtn: { backgroundColor: '#2a2a2a', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  goalBtnText: { color: '#888', fontSize: 12, fontWeight: '600' },
  logBtn: { backgroundColor: '#2a2a2a', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  logBtnText: { color: '#a78bfa', fontSize: 12, fontWeight: '600' },

  progressWrapper: { marginBottom: 4 },
  progressLabel: { color: '#888', fontSize: 12, marginBottom: 8 },
  progressTrackRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  progressEndLabel: { color: '#666', fontSize: 11, minWidth: 42, textAlign: 'center' },
  progressTrack: {
    flex: 1, height: 28, backgroundColor: '#2a2a2a', borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    position: 'relative',
    overflow: 'visible',
  },
  progressFill: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    backgroundColor: '#dc2626', borderRadius: 14,
    overflow: 'hidden',
  },
  progressFillShine: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: '45%',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderTopLeftRadius: 14, borderTopRightRadius: 14,
  },
  progressRunner: {
    position: 'absolute', fontSize: 18, top: -1,
  },
  progressEmptyText: { color: '#444', fontSize: 11 },
  progressCurrentLabel: {
    color: '#ef4444', fontSize: 11, marginTop: 5, textAlign: 'center',
  },

  divider: { height: 1, backgroundColor: '#2a2a2a', marginVertical: 16 },

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
