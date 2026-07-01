import { createContext, useContext, useState, useEffect } from 'react';

const AppContext = createContext(null);

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export function AppProvider({ children }) {
  const [videos, setVideos] = useState(() => load('wwk_videos', []));
  const [clips, setClips] = useState(() => load('wwk_clips', []));
  const [categories, setCategories] = useState(() => load('wwk_categories', ['核心', '下肢', '上肢', '有氧']));

  useEffect(() => { save('wwk_videos', videos); }, [videos]);
  useEffect(() => { save('wwk_clips', clips); }, [clips]);
  useEffect(() => { save('wwk_categories', categories); }, [categories]);

  function addVideo(video) {
    setVideos(prev => [video, ...prev]);
  }

  function deleteVideo(videoId) {
    setVideos(prev => prev.filter(v => v.id !== videoId));
  }

  function updateVideoTitle(videoId, title) {
    setVideos(prev => prev.map(v => v.id === videoId ? { ...v, title } : v));
  }

  function addClip(clip) {
    setClips(prev => [...prev, clip]);
  }

  function deleteClip(clipId) {
    setClips(prev => prev.filter(c => c.id !== clipId));
  }

  function addCategory(name) {
    setCategories(prev => prev.includes(name) ? prev : [...prev, name]);
  }

  function updateClipCategory(clipId, category) {
    setClips(prev => prev.map(c => c.id === clipId ? { ...c, category } : c));
  }

  function renameCategory(oldName, newName) {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    setCategories(prev => prev.map(c => c === oldName ? trimmed : c));
    setClips(prev => prev.map(c => c.category === oldName ? { ...c, category: trimmed } : c));
  }

  function deleteCategory(name) {
    setCategories(prev => prev.filter(c => c !== name));
    setClips(prev => prev.map(c => c.category === name ? { ...c, category: null } : c));
  }

  return (
    <AppContext.Provider value={{ videos, addVideo, deleteVideo, updateVideoTitle, clips, addClip, deleteClip, categories, addCategory, renameCategory, deleteCategory, updateClipCategory }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
