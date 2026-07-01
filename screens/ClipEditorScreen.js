import { useState, useRef, useEffect, Platform } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, FlatList, Alert, SafeAreaView,
  Dimensions, Modal, ScrollView,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useApp } from '../context/AppContext';
import { getVideoBlob } from '../utils/videoDB';

const { width, height } = Dimensions.get('window');
const VIDEO_HEIGHT = Math.min(width * (16 / 9), height * 0.4);

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export default function ClipEditorScreen({ route, navigation }) {
  const { video } = route.params;
  const { addClip, categories, addCategory, updateClipCategory, updateVideoTitle } = useApp();

  const [videoUrl, setVideoUrl] = useState(null);

  useEffect(() => {
    getVideoBlob(video.id).then(blob => {
      if (blob) setVideoUrl(URL.createObjectURL(blob));
    });
  }, [video.id]);

  const player = useVideoPlayer(videoUrl, p => { p.loop = false; });
  const [currentMs, setCurrentMs] = useState(0);
  const [durationMs, setDurationMs] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);

  // Scrubber state
  const isScrubbingRef = useRef(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubMs, setScrubMs] = useState(0);
  const wasPlayingRef = useRef(false);
  const scrubBarWidthRef = useRef(1);

  useEffect(() => {
    const id = setInterval(() => {
      if (!isScrubbingRef.current) {
        setCurrentMs((player.currentTime ?? 0) * 1000);
      }
      setDurationMs((player.duration ?? 1) * 1000);
      setIsPlaying(player.playing ?? false);
    }, 100);
    return () => clearInterval(id);
  }, [player]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const applyInline = () => {
      document.querySelectorAll('video').forEach(v => {
        v.setAttribute('playsinline', '');
        v.setAttribute('webkit-playsinline', '');
        v.playsInline = true;
      });
    };
    applyInline();
    const interval = setInterval(applyInline, 300);
    document.addEventListener('play', applyInline, true);
    return () => {
      clearInterval(interval);
      document.removeEventListener('play', applyInline, true);
    };
  }, []);

  const displayMs = isScrubbing ? scrubMs : currentMs;
  const safeDuration = Math.max(durationMs, 1);

  function seekFromX(locationX) {
    const w = scrubBarWidthRef.current;
    const percent = Math.max(0, Math.min(locationX / w, 1));
    const targetMs = percent * safeDuration;
    setScrubMs(targetMs);
    const targetSec = targetMs / 1000;
    player.seekBy(targetSec - (player.currentTime ?? 0));
  }

  function onScrubStart(locationX) {
    isScrubbingRef.current = true;
    setIsScrubbing(true);
    setScrubMs(currentMs);
    wasPlayingRef.current = player.playing ?? false;
    if (player.playing) player.pause();
    seekFromX(locationX);
  }

  function onScrubEnd() {
    isScrubbingRef.current = false;
    setIsScrubbing(false);
    if (wasPlayingRef.current) player.play();
  }

  const [videoTitle, setVideoTitle] = useState(video.title);
  const [editingTitle, setEditingTitle] = useState(false);

  const [markStart, setMarkStart] = useState(null);
  const [markEnd, setMarkEnd] = useState(null);
  const [clipName, setClipName] = useState('');
  const [clips, setClips] = useState([]);

  const [previewClip, setPreviewClip] = useState(null);
  const previewPlayer = useVideoPlayer(video.downloadUrl, p => { p.loop = false; });

  const [categoryClip, setCategoryClip] = useState(null);

  useEffect(() => {
    if (!previewClip) return;
    const id = setInterval(() => {
      const posMs = (previewPlayer.currentTime ?? 0) * 1000;
      if (posMs >= previewClip.endMs) {
        previewPlayer.pause();
      }
    }, 100);
    return () => clearInterval(id);
  }, [previewClip, previewPlayer]);
  const [newCatName, setNewCatName] = useState('');

  function handleMarkStart() {
    setMarkStart(displayMs);
    setMarkEnd(null);
  }

  function handleMarkEnd() {
    if (markStart === null) { Alert.alert('請先標記開始點'); return; }
    if (displayMs <= markStart) { Alert.alert('結束點必須在開始點之後'); return; }
    setMarkEnd(displayMs);
  }

  function handleSaveClip() {
    if (markStart === null || markEnd === null) { Alert.alert('請先標記開始和結束點'); return; }
    if (!clipName.trim()) { Alert.alert('請輸入動作名稱'); return; }
    const newClip = {
      id: Date.now().toString(),
      name: clipName.trim(),
      startMs: markStart,
      endMs: markEnd,
      videoId: video.id,
      downloadUrl: video.downloadUrl,
      thumbnail: video.thumbnail,
      category: null,
    };
    setClips(prev => [...prev, newClip]);
    addClip(newClip);
    setMarkStart(null);
    setMarkEnd(null);
    setClipName('');
  }

  function handleDone() {
    if (clips.length === 0) { Alert.alert('還沒有片段', '請先標記至少一個動作再完成'); return; }
    navigation.goBack();
  }

  async function openPreview(clip) {
    setPreviewClip(clip);
    previewPlayer.seekBy(clip.startMs / 1000 - (previewPlayer.currentTime ?? 0));
    setTimeout(() => previewPlayer.play(), 150);
  }

  function closePreview() {
    previewPlayer.pause();
    setPreviewClip(null);
  }

  function handleSelectCategory(catName) {
    if (!categoryClip) return;
    updateClipCategory(categoryClip.id, catName);
    setClips(prev => prev.map(c => c.id === categoryClip.id ? { ...c, category: catName } : c));
    setCategoryClip(null);
    setNewCatName('');
  }

  function handleAddCategory() {
    if (!newCatName.trim()) return;
    addCategory(newCatName.trim());
    handleSelectCategory(newCatName.trim());
  }

  return (
    <SafeAreaView style={styles.safe}>

      {/* 頂部列 */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>← 返回</Text>
        </TouchableOpacity>
        {editingTitle ? (
          <TextInput
            style={styles.titleInput}
            value={videoTitle}
            onChangeText={setVideoTitle}
            autoFocus
            onBlur={() => {
              setEditingTitle(false);
              const t = videoTitle.trim() || '未命名動作';
              setVideoTitle(t);
              updateVideoTitle(video.id, t);
            }}
            returnKeyType="done"
            onSubmitEditing={() => {
              setEditingTitle(false);
              const t = videoTitle.trim() || '未命名動作';
              setVideoTitle(t);
              updateVideoTitle(video.id, t);
            }}
          />
        ) : (
          <TouchableOpacity onPress={() => setEditingTitle(true)} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.topTitle} numberOfLines={1}>{videoTitle}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={handleDone}>
          <Text style={styles.doneBtn}>完成</Text>
        </TouchableOpacity>
      </View>

      {/* 主影片 */}
      <VideoView
        player={player}
        style={styles.video}
        contentFit="contain"
        nativeControls={false}
        allowsFullscreen={false}
      />

      {/* 時間 */}
      <View style={styles.timeRow}>
        <Text style={styles.timeText}>{formatTime(displayMs)}</Text>
        <Text style={styles.timeSep}>/</Text>
        <Text style={styles.timeDim}>{formatTime(safeDuration)}</Text>
      </View>

      {/* 可拖動時間軸 */}
      <View
        onLayout={e => { scrubBarWidthRef.current = e.nativeEvent.layout.width; }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={e => onScrubStart(e.nativeEvent.locationX)}
        onResponderMove={e => seekFromX(e.nativeEvent.locationX)}
        onResponderRelease={onScrubEnd}
        onResponderTerminate={onScrubEnd}
        style={styles.scrubArea}
      >
        {/* 背景軌道 */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${(displayMs / safeDuration) * 100}%` }]} />
        </View>
        {/* 開始標記 */}
        {markStart !== null && (
          <View style={[styles.marker, styles.markerStart, { left: `${(markStart / safeDuration) * 100}%` }]} />
        )}
        {/* 結束標記 */}
        {markEnd !== null && (
          <View style={[styles.marker, styles.markerEnd, { left: `${(markEnd / safeDuration) * 100}%` }]} />
        )}
        {/* 拖動把手 */}
        <View style={[styles.scrubThumb, { left: `${(displayMs / safeDuration) * 100}%` }]} />
      </View>

      {/* 播放控制 */}
      <TouchableOpacity style={styles.playBtn} onPress={() => isPlaying ? player.pause() : player.play()}>
        <Text style={styles.playBtnText}>{isPlaying ? '⏸ 暫停' : '▶ 播放'}</Text>
      </TouchableOpacity>

      {/* 標記按鈕 */}
      <View style={styles.markRow}>
        <TouchableOpacity style={[styles.markBtn, markStart !== null && styles.markBtnActive]} onPress={handleMarkStart}>
          <Text style={styles.markBtnText}>{markStart !== null ? `開始 ${formatTime(markStart)}` : '標記開始'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.markBtn, markEnd !== null && styles.markBtnActive]} onPress={handleMarkEnd}>
          <Text style={styles.markBtnText}>{markEnd !== null ? `結束 ${formatTime(markEnd)}` : '標記結束'}</Text>
        </TouchableOpacity>
      </View>

      {/* 動作命名 */}
      <View style={styles.nameRow}>
        <TextInput
          style={styles.nameInput}
          placeholder="動作名稱（例：側向跨步）"
          placeholderTextColor="#555"
          value={clipName}
          onChangeText={setClipName}
        />
        <TouchableOpacity style={styles.saveBtn} onPress={handleSaveClip}>
          <Text style={styles.saveBtnText}>存入</Text>
        </TouchableOpacity>
      </View>

      {/* 片段列表 */}
      {clips.length > 0 && (
        <FlatList
          data={clips}
          keyExtractor={item => item.id}
          style={styles.clipList}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.clipItem} onPress={() => openPreview(item)}>
              <View style={styles.clipDot} />
              <Text style={styles.clipName}>{item.name}</Text>
              <Text style={styles.clipTime}>{formatTime(item.startMs)} → {formatTime(item.endMs)}</Text>
              <TouchableOpacity
                style={[styles.catBtn, item.category && styles.catBtnFilled]}
                onPress={() => setCategoryClip(item)}
              >
                <Text style={styles.catBtnText}>{item.category ?? '分類'}</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      )}

      {/* ── 播放預覽 Modal ── */}
      <Modal visible={!!previewClip} transparent animationType="fade" onRequestClose={closePreview}>
        <View style={styles.modalOverlay}>
          <View style={styles.previewBox}>
            <TouchableOpacity style={styles.closeBtn} onPress={closePreview}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.previewTitle}>{previewClip?.name ?? ''}</Text>
            <Text style={styles.previewTime}>
              {previewClip ? `${formatTime(previewClip.startMs)} → ${formatTime(previewClip.endMs)}` : ''}
            </Text>
            <VideoView
              player={previewPlayer}
              style={styles.previewVideo}
              contentFit="contain"
              nativeControls={false}
              allowsFullscreen={false}
            />
            <TouchableOpacity
              style={styles.previewPlayBtn}
              onPress={() => {
                if (previewClip) {
                  previewPlayer.seekBy(previewClip.startMs / 1000 - (previewPlayer.currentTime ?? 0));
                  setTimeout(() => previewPlayer.play(), 150);
                }
              }}
            >
              <Text style={styles.previewPlayText}>↺ 重播</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── 分類選擇 Modal ── */}
      <Modal visible={!!categoryClip} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.catBox}>
            <Text style={styles.catTitle}>選擇分類</Text>
            <ScrollView>
              {categories.map(cat => (
                <TouchableOpacity key={cat} style={styles.catOption} onPress={() => handleSelectCategory(cat)}>
                  <Text style={styles.catOptionText}>{cat}</Text>
                  {categoryClip?.category === cat && <Text style={styles.catCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.newCatRow}>
              <TextInput
                style={styles.newCatInput}
                placeholder="新增分類..."
                placeholderTextColor="#555"
                value={newCatName}
                onChangeText={setNewCatName}
              />
              <TouchableOpacity style={styles.newCatBtn} onPress={handleAddCategory}>
                <Text style={styles.newCatBtnText}>新增</Text>
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
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#1e1e1e',
  },
  backBtn: { color: '#888', fontSize: 14 },
  topTitle: { color: '#fff', fontSize: 14, fontWeight: '600', textAlign: 'center', marginHorizontal: 8 },
  titleInput: {
    flex: 1, color: '#fff', fontSize: 14, fontWeight: '600',
    textAlign: 'center', marginHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: '#a78bfa', paddingVertical: 2,
  },
  doneBtn: { color: '#a78bfa', fontSize: 14, fontWeight: '700' },
  video: { width: '100%', height: VIDEO_HEIGHT, backgroundColor: '#000' },
  timeRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10 },
  timeText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  timeSep: { color: '#555', marginHorizontal: 4 },
  timeDim: { color: '#555', fontSize: 14 },

  scrubArea: {
    height: 32,
    marginHorizontal: 16,
    marginTop: 8,
    justifyContent: 'center',
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#2a2a2a',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: 4, backgroundColor: '#a78bfa', borderRadius: 2 },
  marker: {
    position: 'absolute',
    top: '50%',
    width: 3, height: 16, borderRadius: 2,
    transform: [{ translateY: -8 }],
  },
  markerStart: { backgroundColor: '#34d399' },
  markerEnd: { backgroundColor: '#f87171' },
  scrubThumb: {
    position: 'absolute',
    top: '50%',
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#a78bfa',
    transform: [{ translateX: -8 }, { translateY: -8 }],
    shadowColor: '#a78bfa',
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 4,
  },

  playBtn: {
    alignSelf: 'center', marginTop: 16,
    backgroundColor: '#1e1e1e', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 30,
  },
  playBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  markRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginTop: 16 },
  markBtn: {
    flex: 1, padding: 12, borderRadius: 10,
    backgroundColor: '#1e1e1e', alignItems: 'center',
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  markBtnActive: { borderColor: '#a78bfa' },
  markBtnText: { color: '#ccc', fontSize: 13, fontWeight: '600' },
  nameRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 12 },
  nameInput: {
    flex: 1, backgroundColor: '#1e1e1e', color: '#fff',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
  },
  saveBtn: { backgroundColor: '#a78bfa', paddingHorizontal: 20, borderRadius: 10, justifyContent: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  clipList: { marginTop: 16, paddingHorizontal: 16 },
  clipItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1a1a1a', borderRadius: 10, padding: 12, marginBottom: 8,
  },
  clipDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#a78bfa', marginRight: 10 },
  clipName: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1 },
  clipTime: { color: '#888', fontSize: 12, marginRight: 8 },
  catBtn: {
    backgroundColor: '#2a2a2a', paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#3a3a3a',
  },
  catBtnFilled: { borderColor: '#a78bfa' },
  catBtnText: { color: '#a78bfa', fontSize: 11, fontWeight: '600' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center', alignItems: 'center',
  },
  previewBox: {
    backgroundColor: '#1a1a1a', borderRadius: 16,
    width: width * 0.85, padding: 16, alignItems: 'center',
  },
  closeBtn: { position: 'absolute', top: 12, right: 12, zIndex: 10, padding: 8 },
  closeBtnText: { color: '#888', fontSize: 18 },
  previewTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 8, marginBottom: 2 },
  previewTime: { color: '#888', fontSize: 12, marginBottom: 12 },
  previewVideo: { width: '100%', height: 200, backgroundColor: '#000', borderRadius: 10 },
  previewPlayBtn: {
    marginTop: 12, backgroundColor: '#2a2a2a',
    paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20,
  },
  previewPlayText: { color: '#a78bfa', fontWeight: '600' },
  catBox: {
    backgroundColor: '#1a1a1a', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    width: '100%', position: 'absolute', bottom: 0, maxHeight: height * 0.6, padding: 20,
  },
  catTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  catOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#2a2a2a',
  },
  catOptionText: { color: '#fff', fontSize: 15 },
  catCheck: { color: '#a78bfa', fontSize: 16 },
  newCatRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  newCatInput: {
    flex: 1, backgroundColor: '#2a2a2a', color: '#fff',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
  },
  newCatBtn: { backgroundColor: '#a78bfa', paddingHorizontal: 16, borderRadius: 10, justifyContent: 'center' },
  newCatBtnText: { color: '#fff', fontWeight: '700' },
});
