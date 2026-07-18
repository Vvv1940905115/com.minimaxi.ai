# 语音 MiniMax — Adobe CEP 配音扩展

> 一个基于 **Adobe CEP（Common Extensibility Platform）** 架构的音频制作面板，集成 **MiniMax TTS API**，在 Premiere Pro 中实现高质量语音合成、声音克隆与一键导入时间轴。

---

## 1. 项目概览

| 项目 | 内容 |
|------|------|
| 扩展 ID | `com.minimaxi.ai` |
| 面板 ID | `com.minimaxi.ai.panel` |
| 产品名称 | 语音 MiniMax / MiniMax 配音 |
| 版本 | `2.5.0` |
| 授权方式 | `aescripts-cep-license` 框架；产品名 `AiBow Voice`，SKU `ABTABV`，产品 ID `40105989` |
| 授权主页 | `https://aescripts.com/aibow-voice/` |
| 核心能力 | MiniMax TTS 语音合成、声音克隆、粤拼（Jyutping）标注、音频播放/波形绘制、导入宿主时间轴 |
| 实际支持宿主 | **Premiere Pro**（manifest 仅声明 PPRO）；代码内含 After Effects 兼容逻辑，但 manifest 未将其列入 HostList，故 AE 面板不会显示；DaVinci Resolve 通过本地桥接支持 |

> 说明：旧版 README 称支持「Premiere Pro / After Effects / DaVinci Resolve」，但当前 `CSXS/manifest.xml` 的 `<HostList>` 只声明了 `PPRO`，因此**面板实际仅会在 Premiere Pro 中加载**。AE 逻辑保留在 `host/index.jsx` 中，Resolve 逻辑保留在 `client/resolve_bridge.js` 中，但均非 manifest 直接启用的宿主。

---

## 2. 目录结构（当前实际）

```
com.minimaxi.ai/
├── package.json              # 项目配置（Electron 启动/打包、依赖 aescripts-cep-license）
├── mimetype                  # CEP 扩展识别文件（application/vnd.adobe.air-ucf-package+zip）
├── META-INF/
│   └── signatures.xml        # 扩展签名（注意：仍引用已删除的旧文件，见第 7 节）
├── CSXS/
│   └── manifest.xml          # CEP 清单：声明 PPRO 宿主、面板 UI、Node.js 启用
├── host/                     # 宿主端 ExtendScript（.jsx）
│   ├── index.jsx             # AE / PPro 共用脚本（manifest 指向此文件）
│   └── index_ppro.jsx        # PPro 专用版（导入到 AI_GENERATED 素材箱）
└── client/                   # 前端面板（HTML/CSS/JS，运行于 CEP/Chromium 环境）
    ├── index.html            # 主面板 UI（按顺序加载下列脚本）
    ├── style.css             # 主样式表（品牌色 --vv-green: #96CE01）
    ├── main.js               # 核心逻辑：API 调用、授权、播放、导入、克隆
    ├── CSInterface.js        # Adobe CEP 通讯桥接库（官方库）
    ├── jyutping-data.js      # 粤拼（Jyutping）字→拼音对照表，提供 window.toJyutping
    ├── resolve_bridge.js     # DaVinci Resolve 本地 Python 服务桥接客户端
    ├── pitch_editor.js       # PitchGraphEditor 类（VoiceVox 遗留，当前未被实例化/未启用）
    └── src_backup/           # 当前为空目录（历史备份已删除）
```

### 2.1 `index.html` 实际加载的脚本

按 `index.html` 中 `<script>` 顺序，面板仅加载以下 5 个脚本：

```html
<script src="CSInterface.js"></script>
<script src="resolve_bridge.js"></script>
<script src="pitch_editor.js"></script>
<script src="jyutping-data.js"></script>
<script src="main.js"></script>
```

> 注意：旧版 README 提到 `config_manager.js`、`settings_manager.js`、`nav.css`、`main_voice.js` 仍被加载，但**当前 `index.html` 并未引用这些文件**（它们已在 git 中删除）。所有设置逻辑已整合进 `main.js` + `index.html` 内联弹窗。

---

## 3. 技术要点

- **CEP 架构**：前端为 HTML + JS，嵌入 Adobe 的 Chromium 嵌入式框架（CEF），作为原生面板运行。
- **Node.js 支持**：manifest 为 PPRO 启用 `--enable-nodejs` 与 `--mixed-context`，因此 `main.js` 可直接 `require('fs' / 'path' / 'os' / 'https' / 'http')`，无需打包器。
- **宿主通信**：前端通过 `csInterface.evalScript("importAndOrganize('...')")` 调用 `host/*.jsx` 中的 ExtendScript 函数，实现导入素材箱 / 添加到序列。Resolve 情况下走 `window.ResolveBridge.importAudio()`。
- **配置持久化**：使用固定磁盘路径 `~/.minimaxi_ai/config.json`（避免 CEP 中 `localStorage` 随扩展重命名而丢失）。同时 `main.js` 仍把部分键写入 `localStorage` 作为缓存（`minimax_tts_key`、`minimax_group_id`、`minimax_v2_output`、`minimax_cloned_voices`）。
- **日志**：`main.js` 将调试日志写入 `~/Desktop/AI_light/AiBow_Voice_MiniMax_2.5/debug.txt`。
- **授权门控**：`init()` 加载 `aescripts-cep-license`，回调 `licenseCheckCallback` 决定 UI 是否可用（`setUiEnabled`）。未授权时所有按钮/输入禁用，标题栏状态点为红色；授权/试用为绿色。

---

## 4. 核心功能详解

### 4.1 MiniMax TTS 语音合成

- **API 端点**：`https://api.minimaxi.com/v1/t2a_v2`
- **请求方式**：`https.request`（Node.js），`Authorization: Bearer <apiKey>`
- **模型**：`speech-2.8-hd`（默认）/`speech-2.8-turbo`/`speech-2.6-hd`/`speech-2.6-turbo`
- **参数**：
  - 语速 `speed`：`0.5 – 2.0`（滑块）
  - 音高 `pitch`：`-1.0 – 1.0`（滑块，UI 标签为「音高」）
  - 语气 `tone`：开心/温柔/悲伤/愤怒/低语/正式/新闻播报/可爱/严肃/威严/困惑/恐惧/冷淡等，合成时作为文本前缀 `(xxx语气) ...` 注入（MiniMax V2 不支持 emotion 字段）
- **输出**：API 返回 `hex` 音频 → `Buffer.from(hex)` → 默认 `mp3`（32k / 128kbps / 单声道）
- **音色**：内置大量预设（粤语系列、普通话系列、英文系列等），克隆音色归入「克隆音色」分组

### 4.2 声音克隆（MiniMax 音色快速复刻）

- **Step 1 上传**：`uploadCloneFile()` → `POST /v1/files/upload`（multipart，带 `purpose=voice_clone`），用正则提取 `file_id` 字符串以保留 int64 精度
- **Step 2 复刻**：`cloneVoiceRequest()` → `POST /v1/voice_clone`，手动拼 JSON 保证 `file_id` 大整数不丢精度；支持降噪、音量归一化、试听文本、模型选择
- **粤语克隆**：若克隆语言选「粤语」，合成时会通过 `window.toJyutping()` 把文本自动转成带粤拼标注，使克隆声音说粤语（`isCantoneseClonedVoice` 判断）
- **音色 ID 规则**：字母开头、8–256 位、仅含字母/数字/`-`/`_`，且不以 `-`/`_` 结尾；自动生成前缀 `Clone_`

### 4.3 音频播放与波形

- **预览**：`previewBlock(blk)` 调 API 生成音频 → `Blob` + `Audio` 播放
- **全部播放**：`playAll()` 按顺序逐条合成并播放
- **波形绘制**：`drawBlockWaveform(blk)` 用 `AudioContext.decodeAudioData` 解码后，在 `.block-wave` canvas 上以品牌色 `#96CE01` 渲染
- **全局播放器** `#audio-player`：播放/暂停、进度条、时间显示，由 `updatePlayerUI()` 更新
- **全局停止**：点击非播放按钮/非播放器区域时暂停当前音频（`startApp` 中绑定到 `document.body`）

### 4.4 面板菜单（Flyout Menu）

`PANEL_MENU_XML` 定义中文右键菜单，由 `setupPanelMenu()` 注入、`flyoutMenuClicked` 处理；`guardPanelMenu()` 拦截授权框架可能覆盖回英文菜单的行为：

- 检查更新… → 打开 `https://github.com/Vvv1940905115/com.minimaxi.ai`
- 联系支持… → 弹出 QQ 复制窗口（QQ：`1940905115`）
- 提供反馈… / 请求功能… / 报告错误… → 弹出邮箱窗口（邮箱：`1940905115@qq.com`）

> 复制优先用 `window.cep.util.copyToClipboard`（CEP 默认 `user-select:none`），回退到 `navigator.clipboard` / `execCommand`。

### 4.5 项目存取与导入宿主

- **保存/加载项目**：`saveProject()` / `loadProject()` 以 JSON 序列化 `STATE.blocks`（每条含 text/model/voice/tone/params）
- **导出并导入**：`synthesis(blk, saveToFile, addToTimeline)` 把音频写入输出文件夹（文件名 `NNN_文本_minimax.mp3`，序号自增），再 `importToHost()`
- **`importToHost(fullpath)`**：
  - 有 `csInterface`：先 `evalScript("importAndOrganize('...')")`，成功后再 `evalScript("addItemToSequence('...')")`
  - 有 `window.ResolveBridge`：调用 `ResolveBridge.importAudio()`（Resolve 桥接）
- **`host/index.jsx`**：`importAndOrganize` 在 PPro 建 `Aivoice` 素材箱、AE 建 `Aivoice` 文件夹并重命名为 `AI_001…`；`addItemToComp`/`addItemToSequence` 把素材放到当前序列（PPro）或合成（AE），并自动推进播放头（CTI）
- **`host/index_ppro.jsx`**：PPro 专用版，导入到 `AI_GENERATED` 素材箱并按 `AI_001…` 重命名（manifest 当前指向 `index.jsx`，此文件为备用/旧版）

### 4.6 本地 T5 引擎（隐藏功能）

- UI 中 `#t5-controls` 默认隐藏，引擎选择 `engine-select` 当前在 `index.html` 中被 `display:none` 隐藏（仅 MiniMax 可选）
- 若块 `mode==='t5'`，`callLocalT5()` 向 `http://localhost:8085/generate_t5` 发请求，由本地 T5 服务合成（首次需下载约 5GB 模型）

### 4.7 DaVinci Resolve 桥接

- `client/resolve_bridge.js` 定义 `window.ResolveBridge.importAudio()`，通过 `fetch` 调用本地 Python 服务 `http://localhost:8085/import_audio`
- 仅当 `csInterface` 不存在（非 CEP 环境）时由 `importToHost` 走此路径

### 4.8 设置与粤拼

- **设置弹窗** `#settings-modal`：MiniMax API 密钥、Group ID（克隆需要）、输出文件夹
- **粤拼数据** `jyutping-data.js`：`JYUTPING_MAP` 收录常用粤语字（与普通话读音不同的字）的粤拼，提供 `window.toJyutping(text)` 实现汉字→`字(jyutping)` 标注；不在表中的字原样保留

---

## 5. 已删除 / 遗留文件（当前不存在）

以下文件在 git 工作区中已被删除，**当前项目不再包含**，请勿在文档或代码中引用：

- 根目录 `12356.png`（旧面板图标）、`日係_minimax.mp3`（旧默认音频）
- `client/main_voice.js`（VoiceVox 集成，已移除）
- `client/config_manager.js` / `client/settings_manager.js`（旧 Gemini 配置，已整合进 main.js）
- `client/nav.css`（旧侧边栏样式，未被引用）
- `client/src_backup/*`（config_manager / license_manager / main_voice / settings_manager 备份，目录已空）

> `client/pitch_editor.js` 仍被 `index.html` 加载，但其 `PitchGraphEditor` 类**未被 `main.js` 实例化**，属于 VoiceVox 遗留代码，当前版本未启用。

---

## 6. 安装与使用

1. 将扩展目录复制到 Adobe 扩展路径：
   `C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\com.minimaxi.ai`
2. 确保 `aescripts-cep-license` 授权框架已安装（package.json 引用 `file:./aescripts-CEP-licensing-framework-main`，即 `node_modules/aescripts-cep-license`）
3. 启动 Premiere Pro，在「窗口 → 扩展」中找到「MiniMax 配音」面板
4. 首次使用在设置中填入 **MiniMax API 密钥**（克隆需 Group ID）
5. Electron 独立运行（开发用）：`npm install` 后 `npm start`（需 `electron ^33`）

---

## 7. 已知问题 / 注意事项

- **签名不一致**：`META-INF/signatures.xml` 的 `<Manifest>` 仍引用已删除的文件（`client/config_manager.js`、`client/main_voice.js`、`client/nav.css`、`client/settings_manager.js`、`client/src_backup/*` 以及根目录 png/mp3）。当前文件集合与签名清单不匹配，若启用严格签名校验可能导致扩展被拒载；如重新打包建议重新签名或更新清单。
- **manifest 宿主范围**：仅声明 PPRO，AE / Resolve 不在 HostList 中，面板不会在这两款软件里出现（相关代码仅为兼容保留）。
- **T5 / Resolve 依赖外部服务**：均需本机运行 `localhost:8085` 的 Python 后端，扩展本身不含该服务端。
- **授权横幅隐藏**：`main.js` 用 `MutationObserver` + 定时轮询强制隐藏 aescripts 授权库的 analytics 同意横幅。

---

## 8. 技术支援

- QQ：`1940905115`
- 邮箱：`1940905115@qq.com`
- 更新仓库：`https://github.com/Vvv1940905115/com.minimaxi.ai`
