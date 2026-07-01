import { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, SafeAreaView, Modal, Dimensions, TextInput } from 'react-native';

const FOLDER_SIZE = (Dimensions.get('window').width - 16 * 2 - 12) / 2;
import { useApp } from '../context/AppContext';

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export default function DepotScreen() {
  const { clips, categories, renameCategory, deleteCategory } = useApp();
  const [openFolder, setOpenFolder] = useState(null);
  const [selectedCat, setSelectedCat] = useState(null);
  const [renamingCat, setRenamingCat] = useState(null);
  const [renameText, setRenameText] = useState('');

  const clipMap = clips.filter(c => c.category).reduce((acc, clip) => {
    if (!acc[clip.category]) acc[clip.category] = [];
    acc[clip.category].push(clip);
    return acc;
  }, {});

  const folderList = categories.map(cat => [cat, clipMap[cat] ?? []]);
  const folderClips = openFolder ? (clipMap[openFolder] ?? []) : [];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Depot</Text>
        <Text style={styles.headerCount}>{categories.length} 個分類</Text>
      </View>

      {folderList.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🗄️</Text>
          <Text style={styles.emptyText}>彈藥庫是空的</Text>
          <Text style={styles.emptySubtext}>到 Home 剪輯影片並選擇分類後{'\n'}分類資料夾會出現在這裡</Text>
        </View>
      ) : (
        <FlatList
          data={folderList}
          keyExtractor={([cat]) => cat}
          contentContainerStyle={{ padding: 16 }}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          renderItem={({ item: [cat, catClips] }) => (
            <TouchableOpacity
              style={styles.folder}
              onPress={() => setOpenFolder(cat)}
              onLongPress={() => setSelectedCat(cat)}
              delayLongPress={500}
            >
              {catClips[0]?.thumbnail ? (
                <Image source={{ uri: catClips[0].thumbnail }} style={styles.folderThumb} />
              ) : (
                <View style={[styles.folderThumb, styles.folderThumbPlaceholder]} />
              )}
              <View style={styles.folderOverlay} />
              <Text style={styles.folderName}>{cat}</Text>
              <Text style={styles.folderCount}>{catClips.length} 個動作</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {/* 長按選單 */}
      <Modal visible={!!selectedCat} transparent animationType="fade">
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setSelectedCat(null)}>
          <View style={styles.menuBox}>
            <Text style={styles.menuTitle} numberOfLines={1}>{selectedCat}</Text>
            <TouchableOpacity
              style={styles.menuBtn}
              onPress={() => {
                setRenameText(selectedCat);
                setRenamingCat(selectedCat);
                setSelectedCat(null);
              }}
            >
              <Text style={styles.menuBtnText}>Rename</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuDeleteBtn}
              onPress={() => {
                deleteCategory(selectedCat);
                setSelectedCat(null);
              }}
            >
              <Text style={styles.menuDeleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Rename 視窗 */}
      <Modal visible={!!renamingCat} transparent animationType="fade">
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setRenamingCat(null)}>
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
                renameCategory(renamingCat, renameText);
                setRenamingCat(null);
              }}
            >
              <Text style={styles.menuBtnText}>確認</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 資料夾內容 Modal */}
      <Modal visible={!!openFolder} animationType="slide" onRequestClose={() => setOpenFolder(null)}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.folderHeader}>
            <TouchableOpacity onPress={() => setOpenFolder(null)}>
              <Text style={styles.backBtn}>← 返回</Text>
            </TouchableOpacity>
            <Text style={styles.folderTitle}>{openFolder}</Text>
            <Text style={styles.folderHeaderCount}>{folderClips.length} 個動作</Text>
          </View>
          {folderClips.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📂</Text>
              <Text style={styles.emptyText}>這個分類還沒有動作</Text>
              <Text style={styles.emptySubtext}>到 Home 剪輯影片時選擇此分類</Text>
            </View>
          ) : (
            <FlatList
              data={folderClips}
              keyExtractor={item => item.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.clipCard}>
                  {item.thumbnail ? (
                    <Image source={{ uri: item.thumbnail }} style={styles.clipThumb} />
                  ) : (
                    <View style={[styles.clipThumb, styles.folderThumbPlaceholder]} />
                  )}
                  <View style={styles.clipInfo}>
                    <Text style={styles.clipName}>{item.name}</Text>
                    <Text style={styles.clipTime}>{formatTime(item.startMs)} → {formatTime(item.endMs)}</Text>
                  </View>
                  <Text style={styles.playIcon}>▶</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0d0d0d' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#1e1e1e',
  },
  headerTitle: { color: '#fff', fontSize: 26, fontWeight: 'bold' },
  headerCount: { color: '#555', fontSize: 13 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  emptySubtext: { color: '#555', fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 20 },

  folder: {
    width: FOLDER_SIZE, height: FOLDER_SIZE, borderRadius: 14,
    overflow: 'hidden', backgroundColor: '#1a1a1a',
    marginBottom: 12, justifyContent: 'flex-end',
  },
  folderThumb: { position: 'absolute', width: '100%', height: '100%' },
  folderThumbPlaceholder: { backgroundColor: '#2a2a2a' },
  folderOverlay: {
    position: 'absolute', width: '100%', height: '100%',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  folderName: { color: '#fff', fontSize: 15, fontWeight: '700', paddingHorizontal: 12, paddingBottom: 2 },
  folderCount: { color: '#aaa', fontSize: 11, paddingHorizontal: 12, paddingBottom: 12 },

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

  folderHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#1e1e1e',
  },
  backBtn: { color: '#888', fontSize: 14 },
  folderTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  folderHeaderCount: { color: '#555', fontSize: 12 },

  clipCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1a1a1a', borderRadius: 12,
    marginBottom: 10, overflow: 'hidden',
  },
  clipThumb: { width: 80, height: 80 },
  clipInfo: { flex: 1, padding: 12 },
  clipName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  clipTime: { color: '#888', fontSize: 12, marginTop: 4 },
  playIcon: { color: '#333', paddingHorizontal: 14, fontSize: 14 },
});
