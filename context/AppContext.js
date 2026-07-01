import { createContext, useContext, useState } from 'react';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [videos, setVideos] = useState([]);
  const [clips, setClips] = useState([]);
  const [categories, setCategories] = useState(['核心', '下肢', '上肢', '有氧']);

  function addVideo(video) {
    setVideos(prev => [video, ...prev]);
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

  return (
    <AppContext.Provider value={{ videos, addVideo, clips, addClip, deleteClip, categories, addCategory, updateClipCategory }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
