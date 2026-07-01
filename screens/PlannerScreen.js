import { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Modal, FlatList, SafeAreaView,
  PanResponder, Animated, Dimensions, TextInput,
} from 'react-native';
import { useApp } from '../context/AppContext';

const ITEM_H = 68;
const SCREEN_W = Dimensions.get('window').width;
const ITEM_W = SCREEN_W - 32;
const SWIPE_THRESHOLD = ITEM_W / 3;
const DAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDays(ref) {
  const mon = getMonday(ref);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function toKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function sameDay(a, b) {
  return toKey(a) === toKey(b);
}

// Drag handle — uses gs.dy (relative to gesture start) instead of absolute pageY
function DragHandle({ onStart, onMove, onEnd }) {
  const cbs = useRef({ onStart, onMove, onEnd });
  useEffect(() => { cbs.current = { onStart, onMove, onEnd }; });

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onShouldBlockNativeResponder: () => true,
    onPanResponderGrant: () => cbs.current.onStart(),
    onPanResponderMove: (e, gs) => cbs.current.onMove(gs.dy),
    onPanResponderRelease: (e, gs) => cbs.current.onEnd(gs.dy),
    onPanResponderTerminate: () => cbs.current.onEnd(null),
  })).current;

  return (
    <View {...pan.panHandlers} style={styles.handle}>
      <Text style={styles.handleIcon}>≡</Text>
    </View>
  );
}

// Single plan item with swipe-to-delete
function PlanItem({ id, clip, isActive, onRemove, onEditSets, onDragStart, onDragMove, onDragEnd }) {
  const swipeX = useRef(new Animated.Value(0)).current;

  const swipePan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (e, gs) =>
      Math.abs(gs.dx) > Math.abs(gs.dy) && Math.abs(gs.dx) > 10,
    onPanResponderMove: (e, gs) => {
      if (gs.dx < 0) swipeX.setValue(Math.max(gs.dx, -ITEM_W));
    },
    onPanResponderRelease: (e, gs) => {
      if (gs.dx < -SWIPE_THRESHOLD) {
        Animated.timing(swipeX, { toValue: -ITEM_W, duration: 150, useNativeDriver: false })
          .start(() => onRemove(id));
      } else {
        Animated.spring(swipeX, { toValue: 0, friction: 8, useNativeDriver: false }).start();
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(swipeX, { toValue: 0, friction: 8, useNativeDriver: false }).start();
    },
  })).current;

  const bgOpacity = swipeX.interpolate({
    inputRange: [-SWIPE_THRESHOLD, -10, 0],
    outputRange: [1, 0.4, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.itemWrapper}>
      {/* Red delete background */}
      <Animated.View style={[styles.deleteBack, { opacity: bgOpacity }]}>
        <Text style={styles.deleteTrash}>🗑️</Text>
      </Animated.View>

      {/* Sliding item */}
      <Animated.View
        style={[styles.planItem, isActive && styles.planItemActive, { transform: [{ translateX: swipeX }] }]}
        {...swipePan.panHandlers}
      >
        <DragHandle onStart={onDragStart} onMove={onDragMove} onEnd={onDragEnd} />
        <View style={styles.planItemInfo}>
          <Text style={styles.planItemName} numberOfLines={1}>{clip?.name ?? '未知動作'}</Text>
          {clip?.category ? <Text style={styles.planItemCat}>{clip.category}</Text> : null}
        </View>
        <TouchableOpacity style={styles.setsBtn} onPress={() => onEditSets(id)}>
          <Text style={styles.setsText}>
            {clip?.sets ?? '—'}組 × {clip?.reps ?? '—'}次
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// Draggable list — dy approach: targetIdx = startIndex + round(dy / ITEM_H)
function DraggablePlanList({ clipIds, allClips, onReorder, onRemove, onEditSets }) {
  const [liveOrder, setLiveOrder] = useState([...clipIds]);
  const [activeId, setActiveId] = useState(null);
  const liveRef = useRef(liveOrder);
  const dragState = useRef({ activeId: null, startIndex: -1 });

  useEffect(() => {
    if (!dragState.current.activeId) setLiveOrder([...clipIds]);
  }, [clipIds.join(',')]);

  useEffect(() => { liveRef.current = liveOrder; }, [liveOrder]);

  function handleDragStart(idx) {
    const id = liveRef.current[idx];
    dragState.current = { activeId: id, startIndex: idx };
    setActiveId(id);
  }

  function handleDragMove(dy) {
    const { activeId: aid, startIndex } = dragState.current;
    if (!aid) return;
    const deltaIdx = Math.round(dy / ITEM_H);
    const targetIdx = Math.max(0, Math.min(startIndex + deltaIdx, liveRef.current.length - 1));
    const curIdx = liveRef.current.indexOf(aid);
    if (curIdx === -1 || targetIdx === curIdx) return;
    const next = [...liveRef.current];
    next.splice(curIdx, 1);
    next.splice(targetIdx, 0, aid);
    setLiveOrder(next);
  }

  function handleDragEnd(dy) {
    if (dy !== null) handleDragMove(dy);
    onReorder([...liveRef.current]);
    dragState.current = { activeId: null, startIndex: -1 };
    setActiveId(null);
  }

  if (clipIds.length === 0) {
    return (
      <View style={styles.emptyDay}>
        <Text style={styles.emptyDayText}>今天還沒有動作</Text>
        <Text style={styles.emptyDaySub}>點下方 ＋ 加入動作</Text>
      </View>
    );
  }

  return (
    <View>
      {liveOrder.map((id, idx) => (
        <PlanItem
          key={id}
          id={id}
          clip={allClips.find(c => c.id === id)}
          isActive={id === activeId}
          onRemove={onRemove}
          onEditSets={onEditSets}
          onDragStart={() => handleDragStart(idx)}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
        />
      ))}
    </View>
  );
}

export default function PlannerScreen() {
  const { clips, planner, addToDay, removeFromDay, reorderDay, updateClipSets } = useApp();

  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(today);
  const [addModal, setAddModal] = useState(false);
  const [setsModal, setSetsModal] = useState(null);
  const [setsInput, setSetsInput] = useState('');
  const [repsInput, setRepsInput] = useState('');

  const weekDays = getWeekDays(today);
  const selectedKey = toKey(selectedDate);
  const dayClipIds = planner[selectedKey] ?? [];

  function openSetsModal(clipId) {
    const clip = clips.find(c => c.id === clipId);
    setSetsInput(clip?.sets?.toString() ?? '');
    setRepsInput(clip?.reps?.toString() ?? '');
    setSetsModal(clipId);
  }

  function handleSaveSets() {
    const sets = parseInt(setsInput);
    const reps = parseInt(repsInput);
    updateClipSets(setsModal, isNaN(reps) ? null : reps, isNaN(sets) ? null : sets);
    setSetsModal(null);
  }

  return (
    <SafeAreaView style={styles.safe}>

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Planner</Text>
      </View>

      {/* 週曆 */}
      <View style={styles.weekRow}>
        {weekDays.map((day, i) => {
          const key = toKey(day);
          const isToday = sameDay(day, today);
          const isSelected = sameDay(day, selectedDate);
          const hasPlan = (planner[key]?.length ?? 0) > 0;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.dayCell, isSelected && styles.dayCellSelected]}
              onPress={() => setSelectedDate(day)}
            >
              <Text style={[styles.dayLabel, isSelected && styles.dayLabelSel]}>{DAY_LABELS[i]}</Text>
              <Text style={[styles.dayNum, isSelected && styles.dayNumSel]}>{day.getDate()}</Text>
              {isToday && <View style={[styles.dot, isSelected ? styles.dotSelToday : styles.dotToday]} />}
              {!isToday && hasPlan && <View style={styles.dot} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 日期標題 */}
      <View style={styles.dayHeader}>
        <Text style={styles.dayTitle}>
          {selectedDate.getMonth() + 1}/{selectedDate.getDate()}
          （{DAY_LABELS[selectedDate.getDay() === 0 ? 6 : selectedDate.getDay() - 1]}）
        </Text>
        <Text style={styles.dayCount}>{dayClipIds.length} 個動作</Text>
      </View>

      {/* 動作清單 */}
      <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 100 }}>
        <DraggablePlanList
          clipIds={dayClipIds}
          allClips={clips}
          onReorder={ids => reorderDay(selectedKey, ids)}
          onRemove={id => removeFromDay(selectedKey, id)}
          onEditSets={openSetsModal}
        />
      </ScrollView>

      {/* 加入按鈕 */}
      <TouchableOpacity style={styles.addBtn} onPress={() => setAddModal(true)}>
        <Text style={styles.addBtnText}>＋ 加入動作</Text>
      </TouchableOpacity>

      {/* 選擇動作 Modal */}
      <Modal visible={addModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>選擇動作</Text>
              <TouchableOpacity onPress={() => setAddModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {clips.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Text style={styles.modalEmptyText}>還沒有存入任何動作</Text>
                <Text style={styles.modalEmptySub}>先到 Home 匯入並剪輯影片</Text>
              </View>
            ) : (
              <FlatList
                data={clips}
                keyExtractor={c => c.id}
                renderItem={({ item }) => {
                  const added = dayClipIds.includes(item.id);
                  return (
                    <TouchableOpacity
                      style={[styles.clipOption, added && styles.clipOptionAdded]}
                      onPress={() => {
                        if (!added) addToDay(selectedKey, item.id);
                        setAddModal(false);
                      }}
                    >
                      <View style={styles.clipDot} />
                      <Text style={styles.clipName} numberOfLines={1}>{item.name}</Text>
                      {item.category ? <Text style={styles.clipCat}>{item.category}</Text> : null}
                      {added && <Text style={styles.addedMark}>✓</Text>}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* 次數/組數 Modal */}
      <Modal visible={setsModal != null} transparent animationType="fade">
        <TouchableOpacity style={styles.setsOverlay} onPress={() => setSetsModal(null)} activeOpacity={1}>
          <TouchableOpacity style={styles.setsBox} activeOpacity={1} onPress={() => {}}>
            <Text style={styles.setsTitle} numberOfLines={1}>
              {clips.find(c => c.id === setsModal)?.name ?? '動作設定'}
            </Text>
            <View style={styles.setsRow}>
              <View style={styles.setsGroup}>
                <Text style={styles.setsGroupLabel}>組數</Text>
                <TextInput
                  style={styles.setsInput}
                  value={setsInput}
                  onChangeText={setSetsInput}
                  keyboardType="number-pad"
                  placeholder="—"
                  placeholderTextColor="#555"
                  maxLength={2}
                  textAlign="center"
                />
                <Text style={styles.setsUnit}>組</Text>
              </View>
              <Text style={styles.setsCross}>×</Text>
              <View style={styles.setsGroup}>
                <Text style={styles.setsGroupLabel}>次數</Text>
                <TextInput
                  style={styles.setsInput}
                  value={repsInput}
                  onChangeText={setRepsInput}
                  keyboardType="number-pad"
                  placeholder="—"
                  placeholderTextColor="#555"
                  maxLength={3}
                  textAlign="center"
                />
                <Text style={styles.setsUnit}>次</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.setsConfirm} onPress={handleSaveSets}>
              <Text style={styles.setsConfirmText}>儲存</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
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

  weekRow: {
    flexDirection: 'row', paddingHorizontal: 6, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#1e1e1e',
  },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10 },
  dayCellSelected: { backgroundColor: '#a78bfa' },
  dayLabel: { color: '#666', fontSize: 11, marginBottom: 4 },
  dayLabelSel: { color: '#fff' },
  dayNum: { color: '#ccc', fontSize: 15, fontWeight: '600' },
  dayNumSel: { color: '#fff' },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#555', marginTop: 3 },
  dotToday: { backgroundColor: '#a78bfa' },
  dotSelToday: { backgroundColor: '#fff' },

  dayHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#1e1e1e',
  },
  dayTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  dayCount: { color: '#555', fontSize: 13 },

  list: { flex: 1 },

  emptyDay: { alignItems: 'center', paddingTop: 60 },
  emptyDayText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  emptyDaySub: { color: '#555', fontSize: 13, marginTop: 6 },

  itemWrapper: {
    marginHorizontal: 16, marginTop: 10,
    height: ITEM_H, borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  deleteBack: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#dc2626',
    justifyContent: 'center', alignItems: 'flex-end',
    paddingRight: 20,
  },
  deleteTrash: { fontSize: 24 },
  planItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1a1a1a', height: ITEM_H,
  },
  planItemActive: {
    backgroundColor: '#252525',
    shadowColor: '#a78bfa', shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  handle: { width: 44, height: ITEM_H, justifyContent: 'center', alignItems: 'center' },
  handleIcon: { color: '#555', fontSize: 22 },
  planItemInfo: { flex: 1, paddingVertical: 12 },
  planItemName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  planItemCat: { color: '#a78bfa', fontSize: 11, marginTop: 3 },

  setsBtn: {
    paddingHorizontal: 14, paddingVertical: 10,
    alignItems: 'center', justifyContent: 'center', minWidth: 80,
  },
  setsText: { color: '#888', fontSize: 12, textAlign: 'center' },

  addBtn: {
    position: 'absolute', bottom: 20, left: 16, right: 16,
    backgroundColor: '#a78bfa', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: '#1a1a1a', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '75%', paddingBottom: 30,
  },
  modalHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#2a2a2a',
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  modalClose: { color: '#888', fontSize: 20 },
  modalEmpty: { alignItems: 'center', padding: 40 },
  modalEmptyText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  modalEmptySub: { color: '#555', fontSize: 13, marginTop: 6 },
  clipOption: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#2a2a2a',
  },
  clipOptionAdded: { opacity: 0.45 },
  clipDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#a78bfa', marginRight: 12 },
  clipName: { flex: 1, color: '#fff', fontSize: 15 },
  clipCat: { color: '#888', fontSize: 11, marginRight: 8 },
  addedMark: { color: '#a78bfa', fontSize: 16, fontWeight: '700' },

  setsOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center', alignItems: 'center',
  },
  setsBox: {
    backgroundColor: '#1e1e1e', borderRadius: 20,
    padding: 24, width: SCREEN_W - 64,
  },
  setsTitle: {
    color: '#fff', fontSize: 15, fontWeight: '700',
    marginBottom: 20, textAlign: 'center',
  },
  setsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  setsGroup: { alignItems: 'center', flex: 1 },
  setsGroupLabel: { color: '#888', fontSize: 12, marginBottom: 8 },
  setsInput: {
    backgroundColor: '#2a2a2a', color: '#fff',
    borderRadius: 10, width: '100%',
    paddingVertical: 12, fontSize: 24, fontWeight: '700',
  },
  setsUnit: { color: '#666', fontSize: 13, marginTop: 6 },
  setsCross: { color: '#555', fontSize: 20, paddingTop: 20 },
  setsConfirm: {
    backgroundColor: '#a78bfa', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 20,
  },
  setsConfirmText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
