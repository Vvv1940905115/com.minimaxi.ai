# AiBow Voice MiniMax — CEP 擴展外掛

> 一個基於 Adobe CEP 架構的音頻製作工具，支援 Premiere Pro / After Effects / DaVinci Resolve，集成 MiniMax TTS API 實現高品質語音合成與配音。

---


## 1. 專案資訊

| 項目 | 內容 |
|------|------|
| 擴展 ID | `com.minimaxi.ai` |
| 面板 ID | `com.minimaxi.ai.panel` |
| 產品名稱 | MiniMax 配音 |
| 版本 | 2.5.0 |
| 授權方式 | aescripts-cep-license，產品 AiBow Voice，金鑰 `ABTABV` |
| 支援主機 | Premiere Pro（manifest 完整支援）、After Effects（host 腳本支援）、DaVinci Resolve（橋接支援） |
| 核心功能 | MiniMax TTS API 語音合成、粵拼注音、語音克隆、音頻播放/波形繪製 |

---

## 2. 目錄結構

```
com.minimaxi.ai/
├── package.json              # 專案配置，含 npm 腳本及 Electron 打包
├── mimetype                  # CEP 擴展識別檔
├── META-INF/                 # 擴展簽名目錄
├── 12356.png                 # 面板圖示（64x64 PNG，顯示在視窗標題列）
├── 日係_minimax.mp3          # 面板預設音頻（範例檔，顯示在播放清單中）
├── CSXS/
│   └── manifest.xml          # CEP 擴展清單，定義主機兼容與 UI 配置
├── host/                     # 主機端 ExtendScript（.jsx）腳本
│   ├── index.jsx             # AE/PPro 共用腳本：導入音頻 + 添加到時間軸/合成
│   └── index_ppro.jsx        # PPro 專用版：使用 AI_GENERATED 垃圾桶導入
└── client/                   # 前端面板（HTML/CSS/JS），運行於 CEP/Chromium 環境
    ├── index.html            # 主面板 UI（包含所有功能入口）
    ├── style.css             # 主樣式表（品牌色 -vv-green: #96CE01）
    ├── main.js               # 主邏輯（MiniMax API 調用、音頻播放、狀態管理）
    ├── CSInterface.js        # Adobe CEP 通訊橋接庫
    ├── jyutping-data.js      # 粵拼（Jyutping）音節映射數據
    ├── resolve_bridge.js     # DaVinci Resolve Python 橋接客戶端
    ├── main_voice.js         # VoiceVox 引擎支援（本地 TTS 備選）
    ├── config_manager.js     # Gemini 配置管理器（用於 API 金鑰設定）
    ├── settings_manager.js   # Gemini 設定面板 UI 管理
    ├── pitch_editor.js       # VoiceVox 音高編輯器
    ├── nav.css               # 垂直導航/側邊欄樣式（用於設定面板）
    └── src_backup/           # 備份版本：config_manager / license_manager / main_voice / settings_manager
```

---

## 3. 技術要點

- **CEP 架構**：使用 HTML + JS 前端嵌入 Adobe 的 Chromium 嵌入式框架（CEF），實現原生面板體驗
- **Node.js 支援**：manifest 中為 PPRO 啟用 `--enable-nodejs` 和 `--mixed-context`，使 `main.js` 可直接使用 `require('fs')` / `require('https')` 等 Node.js API
- **主機通信**：前端通過 `csInterface.evalScript("importAndOrganize('...')")` 調用 `host/*.jsx` 中的 ExtendScript 函數，實現導入時間軸/合成等操作
- **配置儲存**：使用檔案系統存儲（`~/.minimaxi_ai/config.json`），避免依賴 `localStorage`（CEP 中 localStorage 會在擴展重啟時遺失）
- **主題適配**：`main_voice.js` 監聽 `updateThemeWithAppSkinInfo` 事件，自動適配 Adobe 應用主題

---

## 4. 核心功能詳解

### 4.1 MiniMax TTS 語音合成

- **API 端點**：`https://api.minimaxi.com/v1/t2a_v2`
- **語音模型**：支援 Speech 2.6 / 2.8 HD / Turbo
- **參數控制**：語速（0.5–2.0）、音調（-1.0–1.0）、情感（開心/悲傷/憤怒/中性/恐懼/驚訝/厭惡）
- **粵拼支援**：可選輸入粵拼（Jyutping）音節，由 `jyutping-data.js` 提供音節到 IPA 的映射數據，實現標準粵語發音
- **語音克隆**：調用 `uploadCloneFile` 上傳樣本音頻，經 `cloneVoiceRequest` 返回 voice_id，後續合成可直接使用克隆語音

### 4.2 音頻播放與控制

面板內置完整音頻播放功能，相關邏輯位於 `main.js`：

- **預覽片段** `previewBlock(blk)`：調用 MiniMax API 生成音頻後，以 `Blob` + `Audio` 對象播放
- **全部播放** `playAll()`：按順序播放所有片段
- **波形繪製** `drawBlockWaveform(blk)`：使用 `canvas` 渲染 PCM 數據波形（品牌色 `#96CE01`）
- **全局播放器** `#audio-player`：提供獨立的播放控制條，包含進度條（`player-progress`）、時間顯示（`player-current` / `player-duration`）及 `updatePlayerUI()` 狀態更新
- **事件綁定**：所有播放控制按鈕在 `startApp` 初始化階段綁定到 `document.body`，確保 CEP 環境下的相容性

### 4.3 圖示與視覺元素

> **注意**：以下資源路徑在 `index.html` + `main.js` 中直接引用，若修改檔案位置請同時更新對應 URL

| 類型 | 路徑/位置 | 備註 |
|------|----------|------|
| 波形繪製 | `drawBlockWaveform`（main.js）`.block-wave` canvas | 即時渲染音頻波形於 canvas |
| 音高編輯器 | `pitch_editor.js` 的 `PitchGraphEditor` | canvas 繪製音高曲線，可拖拽編輯 **（此功能為 VoiceVox 專用，目前版本未啟用）** |
| 區塊狀態圖示 | `.block-icon`（style.css） | 以 Unicode 字符表示下載/播放/就緒狀態 |
| 面板圖示 | 根目錄 `12356.png` | 顯示在 **index.html 標題列**，建議更換為自有品牌圖示 |
| 預設音頻 | 根目錄 `日係_minimax.mp3` | 預留檔案，可忽略 |

若需修改面板圖示，請更新 `index.html` 中的 `<img>` 引用並同步 `main.js` 初始化邏輯。

### 4.4 主機導入與時間軸操作

- `main.js` 調用 `importToHost(fullpath)`：
  - 通過 `csInterface` 執行 `evalScript("importAndOrganize('檔案路徑')")`，再由 `addItemToSequence('素材名稱')` 添加到時間軸/合成
  - 若環境中存在 `window.ResolveBridge`，則轉用橋接器與 DaVinci Resolve 的 Python 後端通信
- `host/index.jsx`：
  - `importAndOrganize`：在專案面板中建立「Aivoice」素材箱，按順序命名 `AI_001` / `AI_002` 等
  - `addItemToComp` / `addItemToSequence`：將素材放入當前合成（AE）或時間軸（PPro），自動調整持續時間（AE）
- `host/index_ppro.jsx`：PPro 專用版本，使用 `AI_GENERATED` 垃圾桶導入（manifest 已配置指向 `index.jsx`）
- `resolve_bridge.js`：通過 `http://localhost:8085/import_audio` 與本地 Python 服務通信，實現 Resolve 導入

### 4.5 面板功能選單

面板右鍵選單由 `PANEL_MENU_XML` 定義，包含：

- **購買授權...**：跳轉至 aescripts 購買頁面
- **聯絡技術支援...**：複製技術支援 **QQ：940905115**，或用 QQ 開啟聊天
- **提交反饋... / 拷貝當前日誌... / 重設面板狀態...**：複製技術支援 **郵箱：940905115@qq.com**，或用郵件客戶端發送

> 選單事件在 `flyoutMenuClicked` 中處理，根據選單 ID 執行對應操作。`main.js` 中的 `guardPanelMenu()` 通過 `setPanelFlyoutMenu` 動態注入菜單。
> 拷貝功能使用 CEP 環境的 `window.cep.util.copyToClipboard`（而非 `navigator.clipboard` 或 `execCommand`），因 CEP 默認啟用 `user-select:none`。

### 4.6 設定面板功能

- 包含 `#settings-modal`：配置 MiniMax API 金鑰與 Group ID，支援粵拼開關與語音參數調整
- 配置存儲於 `~/.minimaxi_ai/config.json`，最多保留 3 個備份
- 語音克隆列表 `STATE.clonedVoices` 在記憶體中動態管理

---

## 5. 重要 / 棄用檔案說明

`client/` 目錄中包含一些**非 MiniMax 核心功能**的遺留檔案，仍由 `index.html` 載入：

- `main_voice.js` — VoiceVox 引擎整合（本地 TTS 服務 `localhost:50021`），主要用於開發/測試
- `config_manager.js` / `settings_manager.js` — Gemini 配置與設定 UI 的早期版本，功能已整合進主設定面板
- `pitch_editor.js` — VoiceVox 專用的音高曲線調整工具
- `nav.css` — 早期垂直導航/側邊欄樣式，部分設定面板仍在使用
- `src_backup/` — 保留備份（config_manager / license_manager / main_voice / settings_manager）
- 根目錄 `12356.png` / `日係_minimax.mp3` — 面板初始載入的預設資源

---

## 6. 安裝與使用

1. 將擴展目錄複製到 Adobe 擴展路徑：`C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\com.minimaxi.ai`
2. 確保 `aescripts-cep-license` 授權框架已正確配置（package.json 中引用 `file:./aescripts-CEP-licensing-framework-main`）
3. 啟動 Adobe 軟體後，在視窗選單中找到該擴展，即可打開 MiniMax 配音面板
4. 首次使用需在設定中填入 **MiniMax API 金鑰** 和 **Group ID**
5. 若需以 Electron 獨立運行：`npm start`（需預先安裝 `electron`）

---

## 7. 技術支援

- QQ：1940905115
- 郵箱：1940905115@qq.com
-
