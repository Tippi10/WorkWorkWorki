import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { saveVideoBlob, deleteVideoBlob } from '../utils/videoDB';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, TextInput, FlatList, Image,
  ActivityIndicator, SafeAreaView,
} from 'react-native';

function captureVideoThumbnail(blob) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement('video');
    video.playsInline = true;
    video.muted = true;
    video.preload = 'metadata';
    video.addEventListener('loadedmetadata', () => {
      video.currentTime = Math.min(1, video.duration * 0.1);
    }, { once: true });
    video.addEventListener('seeked', () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 200;
        const ctx = canvas.getContext('2d');
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const size = Math.min(vw, vh);
        ctx.drawImage(video, (vw - size) / 2, (vh - size) / 2, size, size, 0, 0, 200, 200);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      } catch {
        URL.revokeObjectURL(url);
        resolve(null);
      }
    }, { once: true });
    video.addEventListener('error', () => { URL.revokeObjectURL(url); resolve(null); }, { once: true });
    video.src = url;
  });
}

const RAPIDAPI_KEY = '87f82569eamsh557c88add7b216dp1edbc2jsn1ca09d91cb6f';
const RAPIDAPI_HOST = 'instagram-post-reels-stories-downloader-api.p.rapidapi.com';

export default function HomeScreen({ navigation }) {
  const { videos, addVideo, deleteVideo, updateVideoTitle } = useApp();
  const [modalVisible, setModalVisible] = useState(false);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [renamingVideo, setRenamingVideo] = useState(null);
  const [renameText, setRenameText] = useState('');

  async function handleImport() {
    if (!url.trim()) return;
    setLoading(true);
    try {
      const encoded = encodeURIComponent(url.trim());
      const res = await fetch(
        `https://${RAPIDAPI_HOST}/instagram/?url=${encoded}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-rapidapi-host': RAPIDAPI_HOST,
            'x-rapidapi-key': RAPIDAPI_KEY,
          },
        }
      );
      const json = await res.json();
      console.log('API response:', JSON.stringify(json).slice(0, 500));

      if (!json.status || !json.result?.length) {
        throw new Error('API 回傳失敗');
      }

      const results = json.result;
      const videoMedia =
        results.find(m => m.type?.includes('video')) ??
        results.find(m => m.url?.includes('.mp4')) ??
        results[0];

      if (!videoMedia?.url) throw new Error('找不到影片連結');

      const thumbUrl = results.find(m => m.type?.includes('image'))?.url ?? videoMedia.thumb ?? null;
      const videoId = Date.now().toString();
      const autoTitle = `動作 ${videos.length + 1}`;

      // 下載影片 blob 存進 IndexedDB
      const videoRes = await fetch(videoMedia.url);
      if (!videoRes.ok) throw new Error('影片下載失敗');
      const blob = await videoRes.blob();
      await saveVideoBlob(videoId, blob);

      // 從影片 blob 擷取第一幀作為縮圖
      const thumbnail = await captureVideoThumbnail(blob);

      const newVideo = {
        id: videoId,
        title: autoTitle,
        author: '',
        thumbnail,
        igUrl: url.trim(),
      };

      addVideo(newVideo);
      setUrl('');
      setModalVisible(false);
    } catch (e) {
      console.error('Import error:', e);
      alert('錯誤：' + (e?.message ?? '無法取得影片'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        {/* 標題列 */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Home</Text>
          <TouchableOpacity style={styles.importBtn} onPress={() => setModalVisible(true)}>
            <Text style={styles.importBtnText}>＋ 匯入 Reels</Text>
          </TouchableOpacity>
        </View>

        {/* 影片列表 */}
        {videos.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🎬</Text>
            <Text style={styles.emptyText}>還沒有影片</Text>
            <Text style={styles.emptySubtext}>按右上角匯入你的第一支 Reels</Text>
          </View>
        ) : (
          <FlatList
            data={videos}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.card}
                onPress={() => navigation.navigate('ClipEditor', { video: item })}
                onLongPress={() => setSelectedVideo(item)}
                delayLongPress={500}
              >
                {item.thumbnail ? (
                  <Image source={{ uri: item.thumbnail }} style={styles.thumbnail} />
                ) : (
                  <View style={[styles.thumbnail, styles.thumbnailPlaceholder]} />
                )}
                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.cardAuthor}>{item.author}</Text>
                  <View style={styles.tagRow}>
                    <View style={styles.tag}><Text style={styles.tagText}>待剪輯</Text></View>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />
        )}

        {/* 長按選單 */}
        <Modal visible={!!selectedVideo} transparent animationType="fade">
          <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setSelectedVideo(null)}>
            <View style={styles.menuBox}>
              <Text style={styles.menuTitle} numberOfLines={1}>{selectedVideo?.title}</Text>
              <TouchableOpacity
                style={styles.menuBtn}
                onPress={() => {
                  setRenameText(selectedVideo.title);
                  setRenamingVideo(selectedVideo);
                  setSelectedVideo(null);
                }}
              >
                <Text style={styles.menuBtnText}>Rename</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuDeleteBtn}
                onPress={async () => {
                  await deleteVideoBlob(selectedVideo.id);
                  deleteVideo(selectedVideo.id);
                  setSelectedVideo(null);
                }}
              >
                <Text style={styles.menuDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Rename 視窗 */}
        <Modal visible={!!renamingVideo} transparent animationType="fade">
          <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setRenamingVideo(null)}>
            <View style={styles.menuBox}>
              <Text style={styles.menuTitle}>重新命名</Text>
              <TextInput
                style={styles.renameInput}
                value={renameText}
                onChangeText={setRenameText}
                autoFocus
                placeholder="輸入新名稱"
                placeholderTextColor="#555"
              />
              <TouchableOpacity
                style={styles.menuBtn}
                onPress={() => {
                  const t = renameText.trim() || '未命名動作';
                  updateVideoTitle(renamingVideo.id, t);
                  setRenamingVideo(null);
                }}
              >
                <Text style={styles.menuBtnText}>確認</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* 貼連結的 Modal */}
        <Modal visible={modalVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>貼上 Reels 連結</Text>
              <TextInput
                style={styles.input}
                placeholder="https://www.instagram.com/reel/..."
                placeholderTextColor="#555"
                value={url}
                onChangeText={setUrl}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.modalBtns}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => { setModalVisible(false); setUrl(''); }}
                >
                  <Text style={styles.cancelBtnText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmBtn, loading && { opacity: 0.5 }]}
                  onPress={handleImport}
                  disabled={loading}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.confirmBtnText}>匯入</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0d0d0d' },
  container: { flex: 1, backgroundColor: '#0d0d0d' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#1e1e1e',
  },
  headerTitle: { color: '#fff', fontSize: 26, fontWeight: 'bold' },
  importBtn: {
    backgroundColor: '#a78bfa',
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20,
  },
  importBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  emptySubtext: { color: '#555', fontSize: 13, marginTop: 6 },

  card: {
    flexDirection: 'row', backgroundColor: '#1a1a1a',
    borderRadius: 12, marginBottom: 12, overflow: 'hidden',
  },
  thumbnail: { width: 100, height: 100 },
  thumbnailPlaceholder: { backgroundColor: '#2a2a2a' },
  cardInfo: { flex: 1, padding: 12, justifyContent: 'space-between' },
  cardTitle: { color: '#fff', fontSize: 14, fontWeight: '600', lineHeight: 20 },
  cardAuthor: { color: '#888', fontSize: 12 },
  tagRow: { flexDirection: 'row', marginTop: 6 },
  tag: { backgroundColor: '#2a2a2a', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tagText: { color: '#a78bfa', fontSize: 11 },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#1a1a1a', borderTopLeftRadius: 20,
    borderTopRightRadius: 20, padding: 24,
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  input: {
    backgroundColor: '#2a2a2a', color: '#fff',
    borderRadius: 10, padding: 14, fontSize: 14,
    marginBottom: 16,
  },
  modalBtns: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1, padding: 14, borderRadius: 10,
    backgroundColor: '#2a2a2a', alignItems: 'center',
  },
  cancelBtnText: { color: '#888', fontWeight: '600' },
  confirmBtn: {
    flex: 1, padding: 14, borderRadius: 10,
    backgroundColor: '#a78bfa', alignItems: 'center',
  },
  confirmBtnText: { color: '#fff', fontWeight: '600' },

  menuOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center',
  },
  menuBox: {
    backgroundColor: '#1a1a1a', borderRadius: 16,
    width: 260, overflow: 'hidden',
  },
  menuTitle: {
    color: '#888', fontSize: 13, paddingHorizontal: 20,
    paddingTop: 16, paddingBottom: 12,
  },
  menuBtn: {
    borderTopWidth: 1, borderTopColor: '#2a2a2a',
    padding: 16, alignItems: 'center',
  },
  menuBtnText: { color: '#888', fontSize: 16, fontWeight: '600' },
  menuDeleteBtn: {
    borderTopWidth: 1, borderTopColor: '#2a2a2a',
    padding: 16, alignItems: 'center',
  },
  menuDeleteText: { color: '#ef4444', fontSize: 16, fontWeight: '600' },
  renameInput: {
    backgroundColor: '#2a2a2a', color: '#fff',
    marginHorizontal: 16, marginBottom: 8,
    borderRadius: 8, padding: 12, fontSize: 14,
  },
});
