import { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Modal, FlatList, SafeAreaView, PanResponder,
} from 'react-native';
import { useApp } from '../context/AppContext';

const ITEM_H = 68;
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
  return date.toISOString().split('T')[0];
}

function sameDay(a, b) {
  return toKey(a) === toKey(b);
}

function DragHandle({ onStart, onMove, onEnd, style }) {
  const cbs = useRef({ onStart, onMove, onEnd });
  useEffect(() => { cbs.current = { onStart, onMove, onEnd }; });

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: e => cbs.current.onStart(e.nativeEvent.pageY),
    onPanResponderMove: e => cbs.current.onMove(e.nativeEvent.pageY),
    onPanResponderRelease: e => cbs.current.onEnd(e.nativeEvent.pageY),
    onPanResponderTerminate: () => cbs.current.onEnd(null),
  })).current;

  return (
    <View {...pan.panHandlers} style={style}>
      <Text style={styles.handleIcon}>≡</Text>
    </View>
  );
}

function DraggablePlanList({ clipIds, allClips, onReorder, onRemove }) {
  const [liveOrder, setLiveOrder] = useState([...clipIds]);
  const [activeId, setActiveId] = useState(null);
  const liveRef = useRef(liveOrder);
  const dragState = useRef({ activeId: null, containerTop: 0 });
  const containerRef = useRef(null);

  useEffect(() => {
    if (!dragState.current.activeId) setLiveOrder([...clipIds]);
  }, [clipIds.join(',')]);

  useEffect(() => { liveRef.current = liveOrder; }, [liveOrder]);

  function measureContainer() {
    containerRef.current?.measure((x, y, w, h, px, py) => {
      dragState.current.containerTop = py;
    });
  }

  function handleStart(id, pageY) {
    dragState.current.activeId = id;
    setActiveId(id);
    measureContainer();
  }

  function handleMove(pageY) {
    const { activeId: aid, containerTop } = dragState.current;
    if (!aid) return;
    const relY = pageY - containerTop;
    const targetIdx = Math.max(0, Math.min(Math.floor(relY / ITEM_H), liveRef.current.length - 1));
    const curIdx = liveRef.current.indexOf(aid);
    if (targetIdx === curIdx) return;
    const next = [...liveRef.current];
    next.splice(curIdx, 1);
    next.splice(targetIdx, 0, aid);
    setLiveOrder(next);
  }

  function handleEnd(pageY) {
    if (pageY !== null) handleMove(pageY);
    onReorder([...liveRef.current]);
    dragState.current.activeId = null;
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
    <View ref={containerRef} onLayout={measureContainer}>
      {liveOrder.map(id => {
        const clip = allClips.find(c => c.id === id);
        const isActive = id === activeId;
        return (
          <View key={id} style={[styles.planItem, isActive && styles.planItemActive]}>
            <DragHandle
              onStart={pageY => handleStart(id, pageY)}
              onMove={handleMove}
              onEnd={handleEnd}
              style={styles.handle}
            />
            <View style={styles.planItemInfo}>
              <Text style={styles.planItemName} numberOfLines={1}>{clip?.name ?? '未知動作'}</Text>
              {clip?.category ? <Text style={styles.planItemCat}>{clip.category}</Text> : null}
            </View>
            <TouchableOpacity onPress={() => onRemove(id)} style={styles.removeBtn}>
              <Text style={styles.removeIcon}>✕</Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

export default function PlannerScreen() {
  const { clips, planner, addToDay, removeFromDay, reorderDay } = useApp();

  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(today);
  const [addModal, setAddModal] = useState(false);

  const weekDays = getWeekDays(today);
  const selectedKey = toKey(selectedDate);
  const dayClipIds = planner[selectedKey] ?? [];

  return (
    <SafeAreaView style={styles.safe}>

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Planner</Text>
      </View>

      {/* 週曆小方格 */}
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
              <Text style={[styles.dayLabel, isSelected && styles.dayLabelSel]}>
                {DAY_LABELS[i]}
              </Text>
              <Text style={[styles.dayNum, isSelected && styles.dayNumSel]}>
                {day.getDate()}
              </Text>
              {isToday && (
                <View style={[styles.dot, isSelected ? styles.dotSelToday : styles.dotToday]} />
              )}
              {!isToday && hasPlan && <View style={styles.dot} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 選中日期標題 */}
      <View style={styles.dayHeader}>
        <Text style={styles.dayTitle}>
          {selectedDate.getMonth() + 1}/{selectedDate.getDate()}
          （{DAY_LABELS[selectedDate.getDay() === 0 ? 6 : selectedDate.getDay() - 1]}）
        </Text>
        <Text style={styles.dayCount}>{dayClipIds.length} 個動作</Text>
      </View>

      {/* 可拖排的動作列表 */}
      <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 100 }}>
        <DraggablePlanList
          clipIds={dayClipIds}
          allClips={clips}
          onReorder={ids => reorderDay(selectedKey, ids)}
          onRemove={id => removeFromDay(selectedKey, id)}
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
  dayCell: {
    flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10,
  },
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

  planItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1a1a1a', marginHorizontal: 16,
    marginTop: 10, borderRadius: 12, height: ITEM_H,
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
  removeBtn: { width: 44, height: ITEM_H, justifyContent: 'center', alignItems: 'center' },
  removeIcon: { color: '#444', fontSize: 16 },

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
});
