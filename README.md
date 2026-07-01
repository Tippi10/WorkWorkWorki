# WorkWorkWorki

健身動作收藏 PWA——從 Instagram Reels 匯入影片，剪輯、分類、排課、追蹤體能進度。

> **Live:** [workworkworki.netlify.app](https://workworkworki.netlify.app)（Netlify 自動從 `main` 部署）

---

## 功能

| 頁面 | 說明 |
|------|------|
| **Home** | 貼上 Instagram Reels 網址一鍵匯入；影片卡片顯示自動擷取的縮圖 |
| **ClipEditor** | 設定剪輯起點/終點、命名動作、歸類類別；可拖拉時間軸控制影片進度 |
| **Depot** | 以類別資料夾瀏覽所有動作；長按可重新命名或刪除資料夾；資料夾封面自動截圖最新動作 |
| **Planner** | 週曆檢視；每天可新增動作並上下拖排順序；左滑動作可刪除；顯示組數 × 次數（點擊可編輯） |
| **Profile** | 完整月曆（標記運動日）；Workouts / Streak / Saved 統計；體重與體脂進度條（最初 → 🏃‍➡️ → 目標） |

---

## 技術棧

- **React Native + Expo SDK 57**（Web 平台）
- **React Navigation** — Bottom Tabs + Native Stack
- **expo-video** — `VideoView` + `useVideoPlayer` 影片播放
- **Canvas API** — 從影片 Blob 擷取縮圖（base64 JPEG）
- **IndexedDB** — 影片 Blob 儲存（`utils/videoDB.js`）
- **localStorage** — 影片 metadata、clips、categories、planner、body stats
- **PanResponder + Animated** — 拖排與左滑刪除手勢
- **PWA** — `manifest.json` + Service Worker，可加到主畫面

---

## 專案結構

```
WorkWorkWorki/
├── App.js                  # 導航設定（Bottom Tabs + HomeStack）
├── context/
│   └── AppContext.js        # 全域狀態（videos/clips/categories/planner）
├── screens/
│   ├── HomeScreen.js        # 影片匯入與縮圖卡片
│   ├── ClipEditorScreen.js  # 影片剪輯（時間軸 scrubber）
│   ├── DepotScreen.js       # 類別資料夾瀏覽
│   ├── PlannerScreen.js     # 週計劃表（拖排 + 左滑刪除）
│   └── ProfileScreen.js     # 月曆 + 統計 + 體重體脂進度
├── utils/
│   └── videoDB.js           # IndexedDB CRUD（saveVideoBlob/getVideoBlob）
├── web/
│   ├── index.html           # Expo build 模板（PWA meta tags）
│   ├── manifest.json        # PWA manifest
│   └── service-worker.js    # 離線快取策略
└── dist/                    # Build 輸出（gitignored，手動 git add -f 後部署）
```

---

## 本機開發

```bash
npm install
npm run web       # 啟動 Expo 開發伺服器（http://localhost:8081）
```

---

## Build & 部署

Netlify 設定為從 `main` branch 的 `dist/` 目錄自動部署。

**每次 build 流程：**

```bash
# 1. Build
npx expo export -p web

# 2. 還原自訂 index.html（Expo 每次 build 都會覆蓋）
#    把 <script src> 裡的 bundle hash 換成新的，其餘 meta tags 保留

# 3. 複製 PWA 檔案
cp web/manifest.json dist/manifest.json
cp web/service-worker.js dist/service-worker.js

# 4. 強制加入 dist（被 .gitignore 忽略）
git add -f dist/

# 5. Commit & Push → Netlify 自動部署
git push origin main
```

> **注意：** `dist/index.html` 每次 build 都會被覆蓋，需手動還原 PWA meta tags 並更新 `<script src>` 的 bundle hash。

---

## 資料儲存

| key | 儲存位置 | 內容 |
|-----|----------|------|
| `wwk_videos` | localStorage | 影片 metadata（id、title、thumbnail base64） |
| `wwk_clips` | localStorage | 動作清單（id、name、category、startMs、endMs、reps、sets） |
| `wwk_categories` | localStorage | 類別名稱陣列 |
| `wwk_planner` | localStorage | `{ [YYYY-MM-DD]: clipId[] }` |
| `wwk_body_stats` | localStorage | `[{ date, weight, bodyFat }]` |
| `wwk_body_goals` | localStorage | `{ startWeight, targetWeight, startBodyFat, targetBodyFat }` |
| `wwk_videos_db` | IndexedDB | 影片 Blob（store: `videos`） |

---

## PWA 安裝（iOS Safari）

1. 用 Safari 開啟網站
2. 分享 → 加入主畫面
3. 若先前已安裝舊版，須**先刪除**再重新加入（`apple-mobile-web-app-status-bar-style` 只在首次安裝時生效）
