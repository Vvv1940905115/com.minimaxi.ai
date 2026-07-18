(function () {
    'use strict';

    try {
        if (typeof require === 'undefined') {
            alert("致命错误：Node.js 的 'require' 不可用。");
            return;
        }

        // Logging to Desktop as requested - Defined EARLY
        const fs = require('fs');
        const path = require('path');
        const os = require('os');


        function writeLog(msg) {
            try {
                const home = os.homedir();
                const folder = path.join(home, 'Desktop', 'AI_light', 'AiBow_Voice_MiniMax_2.5');
                if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
                const logPath = path.join(folder, 'debug.txt');
                const time = new Date().toLocaleString();
                fs.appendFileSync(logPath, `[${time}] ${msg}\n`);
            } catch (e) { console.error("Log Error:", e); }
        }

        // 配置持久化：使用固定磁盘路径而非 localStorage。
        // CEP 的 localStorage 按扩展目录路径隔离，重命名/移动扩展会导致密钥丢失（login fail）。
        // 改为写入用户主目录下的固定文件，与扩展文件夹名无关，重命名后配置仍然保留。
        const CONFIG_DIR = path.join(os.homedir(), '.minimaxi_ai');
        const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

        function loadConfigFile() {
            try {
                if (fs.existsSync(CONFIG_FILE)) {
                    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
                    const obj = JSON.parse(raw);
                    writeLog("Config loaded from " + CONFIG_FILE);
                    return obj || {};
                }
            } catch (e) {
                writeLog("loadConfigFile error: " + e.message);
            }
            return {};
        }

        function saveConfigFile() {
            try {
                if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
                const data = {
                    apiKey: STATE.config.apiKey,
                    groupId: STATE.config.groupId,
                    outputFolder: STATE.config.outputFolder,
                    clonedVoices: STATE.clonedVoices
                };
                fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
                writeLog("Config saved to " + CONFIG_FILE);
            } catch (e) {
                writeLog("saveConfigFile error: " + e.message);
                alert("保存设置失败：" + e.message);
            }
        }

        writeLog("--- Extension Loading ---");

        // Requires
        let csInterface = null;
        try {
            if (typeof CSInterface !== 'undefined') {
                csInterface = new CSInterface();
            }
        } catch (e) {
            console.log("CSInterface not initialized (Resolve Mode?)");
        }

        // 中文面板菜单（覆盖 CEP/授权框架的默认英文菜单）
        // 注意：嵌套子菜单项在部分 CEP 版本中不会触发 flyoutMenuClicked，
        // 因此这里把“支持”下的四项改为顶级菜单项，确保点击都能响应。
        const PANEL_MENU_XML = `<Menu>
  <MenuItem Id="checkUpdates" Label="检查更新..."/>
  <MenuItem Label="---"/>
  <MenuItem Id="contactSupport" Label="联系支持..."/>
  <MenuItem Id="provideFeedback" Label="提供反馈..."/>
  <MenuItem Id="requestFeature" Label="请求功能..."/>
  <MenuItem Id="reportBug" Label="报告错误..."/>
</Menu>`;

        // 统一打开外部链接（优先用 CEP API，失败再回退到 window.open）
        function openExternal(url) {
            try {
                if (csInterface && csInterface.openURLInDefaultBrowser) {
                    csInterface.openURLInDefaultBrowser(url);
                    return;
                }
            } catch (e) {
                writeLog("openURLInDefaultBrowser failed: " + e.message);
            }
            try { window.open(url, '_blank'); } catch (e) { /* ignore */ }
        }

        // 复制文本到剪贴板（优先 CEP 原生 API，其次 navigator.clipboard，最后 execCommand）
        async function copyText(text) {
            try {
                if (window.cep && window.cep.util && window.cep.util.copyToClipboard) {
                    window.cep.util.copyToClipboard(text);
                    return true;
                }
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(text);
                    return true;
                }
            } catch (e) { /* ignore */ }
            try {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                ta.style.userSelect = 'text';
                ta.style.webkitUserSelect = 'text';
                document.body.appendChild(ta);
                ta.select();
                const ok = document.execCommand('copy');
                document.body.removeChild(ta);
                return ok;
            } catch (e) {
                return false;
            }
        }

        function setupPanelMenu() {
            if (!csInterface) return;
            try {
                csInterface.setPanelFlyoutMenu(PANEL_MENU_XML);

                csInterface.addEventListener("com.adobe.csxs.events.flyoutMenuClicked", (event) => {
                    let data = event.data;
                    try {
                        if (typeof data === 'string') data = JSON.parse(data);
                    } catch (e) {
                        data = {};
                    }
                    writeLog("flyoutMenuClicked: " + JSON.stringify(data));
                    const id = (data && data.menuId) || '';

                    switch (id) {
                        case 'checkUpdates':
                            openExternal("https://github.com/Vvv1940905115/com.minimaxi.ai");
                            break;
                        case 'contactSupport':
                            // 弹出「联系支持」窗口，显示并复制 QQ
                            openSupportModal();
                            break;
                        case 'provideFeedback':
                            openFeedbackModal('provideFeedback');
                            break;
                        case 'requestFeature':
                            openFeedbackModal('requestFeature');
                            break;
                        case 'reportBug':
                            openFeedbackModal('reportBug');
                            break;
                        default:
                            break;
                    }
                });
                writeLog("Panel menu set (Chinese).");
            } catch (e) {
                writeLog("setupPanelMenu error: " + e.message);
            }
        }

        // 保护面板菜单不被授权框架覆盖回英文默认菜单
        function guardPanelMenu() {
            if (!csInterface) return;
            try {
                // 拦截通过 CSInterface 设置的面板菜单
                if (CSInterface && CSInterface.prototype && CSInterface.prototype.setPanelFlyoutMenu) {
                    const orig = CSInterface.prototype.setPanelFlyoutMenu;
                    CSInterface.prototype.setPanelFlyoutMenu = function (_menu) {
                        return orig.call(this, PANEL_MENU_XML);
                    };
                }
                // 拦截直接调用 window.__adobe_cep__.invokeSync 的情况
                if (window.__adobe_cep__ && window.__adobe_cep__.invokeSync) {
                    const orig = window.__adobe_cep__.invokeSync.bind(window.__adobe_cep__);
                    window.__adobe_cep__.invokeSync = function (name, menu) {
                        if (name === "setPanelFlyoutMenu") {
                            return orig(name, PANEL_MENU_XML);
                        }
                        return orig(name, menu);
                    };
                }
                setupPanelMenu();
            } catch (e) {
                writeLog("guardPanelMenu error: " + e.message);
            }
        }
        guardPanelMenu();

        const https = require('https');
        const http = require('http');

        // --- State Management ---
        const savedConfig = loadConfigFile();
        const STATE = {
            config: {
                apiKey: savedConfig.apiKey || "",
                groupId: savedConfig.groupId || "",
                outputFolder: savedConfig.outputFolder || path.join(os.homedir(), 'Documents', 'AiBow_MiniMax_Voice'),
            },
            clonedVoices: Array.isArray(savedConfig.clonedVoices) ? savedConfig.clonedVoices : [],
            blocks: [],
            selectedBlockId: null
        };
        let currentAudio = null; // for global stop

        // --- Types ---
        const createBlock = () => ({
            id: 'blk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            text: '你好，欢迎使用 MiniMax 语音合成。',
            model: 'speech-2.8-hd',
            voice: 'Cantonese_ProfessionalHost（F)',
            tone: '',
            mode: 'minimax',
            voicePath: '',
            params: {
                speed: 1.0,
                pitch: 0.0
            }
        });

        // --- Aescripts Licensing ---
        let AESP;
        let aesp = null;
        try {
            AESP = require('aescripts-cep-license');
        } catch (e) {
            writeLog("CRITICAL: Failed to load aescripts-cep-license: " + e.message);
            alert("严重错误：无法加载授权模块，请检查安装。");
        }

        function licenseCheckCallback(isValidLicense, isTrial, licenseType) {
            writeLog(`License Check: Valid=${isValidLicense}, Trial=${isTrial}, Type=${licenseType}`);
            console.log(`License Status: Valid=${isValidLicense}, Trial=${isTrial}, Type=${licenseType}`);

            const statusEl = document.getElementById('connection-status');

            if (isValidLicense) {
                setUiEnabled(true);
                if (statusEl) {
                    statusEl.classList.remove('disconnected');
                    statusEl.classList.add('connected');
                    statusEl.style.color = '#0f0';
                    statusEl.title = isTrial ? "试用模式" : "已授权";
                }
                startApp();
            } else {
                setUiEnabled(false);
                if (statusEl) {
                    statusEl.classList.remove('connected');
                    statusEl.classList.add('disconnected');
                    statusEl.style.color = '#f00';
                    statusEl.title = "未授权";
                }
            }
        }

        async function init() {
            writeLog("Initializing Licensing Framework...");
            console.log("Initializing Licensing Framework...");

            // Disable UI by default until check passes
            setUiEnabled(false);

            try {
                const aespConfig = {
                    productVersion: "2.5.0",
                    overwriteConfig: true,
                    productName: "AiBow Voice",
                    sku: "ABTABV",
                    id: "40105989",
                    licenseType: "licensed",
                    offerTrial: true,
                    url: "https://aescripts.com/aibow-voice/",
                    aboutText: "语音 MiniMax 2.5\n(c) 2026\n\n锋少持有本插件全部版权。\n提交 PR 请把使用反馈、更新时遇到的报错发送至 1940905115@qq.com，\n未附带反馈与报错信息的 PR 不予处理。",
                    privNum: "40105989"
                };

                aesp = new AESP(aespConfig, licenseCheckCallback);
                window.aesp = aesp;

            } catch (e) {
                console.error("License Init Failed:", e);
                writeLog("License Init Failed: " + e.message);
                alert("授权初始化失败：" + e.message);
            }

            // Setup Activate Button
            const btnActivate = document.getElementById('btn-activate');
            if (btnActivate) {
                btnActivate.addEventListener('click', () => {
                    if (aesp) aesp.register();
                });
            }
        }

        function setUiEnabled(enabled) {
            const buttons = document.querySelectorAll('button');
            const inputs = document.querySelectorAll('input, select, textarea');

            buttons.forEach(b => {
                // Don't disable close buttons for modals if we had any open, 
                // but effectively we want to lock the main UI.
                // For now, disable everything.
                b.disabled = !enabled;
                if (!enabled) b.style.opacity = '0.5';
                else b.style.opacity = '1';
            });

            inputs.forEach(i => {
                i.disabled = !enabled;
                if (!enabled) i.style.opacity = '0.5';
                else i.style.opacity = '1';
            });

            const workspace = document.getElementById('workspace');
            if (workspace) {
                workspace.style.opacity = enabled ? '1' : '0.5';
                workspace.style.pointerEvents = enabled ? 'auto' : 'none';
            }
        }







        async function startApp() {
            setupToolbar();
            setupRightPanel();
            setupSettings();
            setupCloneModal();
            setupSupportModal();
            setupFeedbackModal();
            setupAudioPlayer();
            refreshVoiceOptions();

            if (STATE.blocks.length === 0) addBlock();

            // Global Stop: 点击非播放按钮/非播放器区域时停止预览
            document.body.addEventListener('click', (e) => {
                const isPlayBtn = e.target.closest('button');
                const isPlayer = e.target.closest('#audio-player');
                if (!isPlayBtn && !isPlayer && currentAudio) {
                    currentAudio.pause();
                    currentAudio = null;
                    updatePlayerUI();
                }
            }, true);
        }

        // --- Core Logic ---

        function addBlock() {
            const blk = createBlock();
            STATE.blocks.push(blk);
            renderBlockList();
            selectBlock(blk.id);
        }

        function selectBlock(id, skipRender = false) {
            STATE.selectedBlockId = id;



            if (!skipRender) renderBlockList();
            else updateHighlights();
            const blk = getBlock(id);
            if (blk) syncRightPanel(blk);
        }

        function updateHighlights() {
            const container = document.getElementById('audio-list-container');
            Array.from(container.children).forEach(div => {
                div.classList.remove('selected');
                if (div.dataset.id === STATE.selectedBlockId) div.classList.add('selected');
            });
        }

        function stringToColor(str) {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                hash = str.charCodeAt(i) + ((hash << 5) - hash);
            }
            const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
            return '#' + "00000".substring(0, 6 - c.length) + c;
        }

        function renderBlockList() {
            const container = document.getElementById('audio-list-container');
            container.innerHTML = '';

            STATE.blocks.forEach(blk => {
                const div = document.createElement('div');
                div.className = 'audio-block' + (blk.id === STATE.selectedBlockId ? ' selected' : '');
                div.dataset.id = blk.id;
                div.setAttribute('draggable', 'true'); // Enable drag

                // Drag Events
                div.ondragstart = (e) => {
                    e.dataTransfer.setData('text/plain', blk.id);
                    e.dataTransfer.effectAllowed = 'move';
                };
                div.ondragover = (e) => {
                    e.preventDefault(); // Necessary for drop
                    e.dataTransfer.dropEffect = 'move';
                };
                div.ondrop = (e) => {
                    e.preventDefault();
                    const draggedId = e.dataTransfer.getData('text/plain');
                    if (draggedId !== blk.id) {
                        reorderBlocks(draggedId, blk.id);
                    }
                };

                div.onclick = (e) => {
                    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') {
                        selectBlock(blk.id);
                    }
                };

                const initial = blk.voice ? blk.voice[0] : '?';
                const iconColor = stringToColor(blk.voice || "MiniMax");
                // Escape quotes
                const safeText = blk.text.replace(/"/g, '&quot;');

                div.innerHTML = `
                <div class="block-icon" style="background-color: ${iconColor}; display:flex; align-items:center; justify-content:center; color:#fff; font-size:24px; font-weight:bold;">${initial}</div>
                <div class="block-content">
                    <div class="block-header"><span class="char-name">${blk.voice} (${blk.model})</span></div>
                    <input type="text" class="block-input" value="${safeText}">
                    <canvas class="block-wave" height="40"></canvas>
                    <div class="block-actions">
                         <button class="btn-mini btn-play">▶</button>
                         <button class="btn-mini btn-import" title="导入项目">↓</button>
                         <button class="btn-mini btn-del">×</button>
                    </div>
                </div>
            `;

                const input = div.querySelector('.block-input');
                input.oninput = () => { blk.text = input.value; };
                input.onfocus = () => { if (STATE.selectedBlockId !== blk.id) selectBlock(blk.id, true); };
                input.onclick = (e) => e.stopPropagation();

                div.querySelector('.btn-play').onclick = (e) => { e.stopPropagation(); previewBlock(blk); };
                div.querySelector('.btn-import').onclick = async (e) => {
                    e.stopPropagation();
                    try {
                        showLoading(true);
                        const fpath = await exportBlockAudio(blk);
                        if (fpath) await importToHost(fpath);
                    } catch (e) {
                        alert('导入失败：' + e.message);
                    } finally {
                        showLoading(false);
                    }
                };
                div.querySelector('.btn-del').onclick = (e) => { e.stopPropagation(); deleteBlock(blk.id); };

                container.appendChild(div);
            });
        }

        // 解码音频并绘制波形到对应块的 canvas
        async function drawBlockWaveform(blk) {
            if (!blk.lastAudio) return;
            const canvas = document.querySelector('.audio-block[data-id="' + blk.id + '"] .block-wave');
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            canvas.width = Math.max(100, Math.floor(rect.width) || (canvas.parentElement ? canvas.parentElement.clientWidth : 200));
            const h = canvas.height;
            const c = canvas.getContext('2d');
            c.clearRect(0, 0, canvas.width, h);
            try {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (!AudioCtx) return;
                const ctx = new AudioCtx();
                const buf = blk.lastAudio;
                const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
                const audioBuf = await ctx.decodeAudioData(ab);
                const data = audioBuf.getChannelData(0);
                const w = canvas.width;
                const amp = h / 2;
                const step = Math.max(1, Math.floor(data.length / w));
                c.fillStyle = '#96CE01';
                for (let x = 0; x < w; x++) {
                    let min = 1.0, max = -1.0;
                    const start = x * step;
                    for (let i = 0; i < step; i++) {
                        const d = data[start + i] || 0;
                        if (d < min) min = d;
                        if (d > max) max = d;
                    }
                    const y = (1 - max) * amp;
                    const barH = Math.max(1, (max - min) * amp);
                    c.fillRect(x, y, 1, barH);
                }
                ctx.close();
            } catch (e) {
                c.fillStyle = '#555';
                c.font = '11px sans-serif';
                c.fillText('无法显示波形', 8, h / 2);
            }
        }

        function syncRightPanel(blk) {
            const mSel = document.getElementById('model-select');
            const vSel = document.getElementById('voice-select');
            const sSlide = document.getElementById('slider-speed');
            const tSlide = document.getElementById('slider-temp');
            const tSel = document.getElementById('input-tone'); // New
            // const eSel = document.getElementById('engine-select');
            const t5Path = document.getElementById('t5-ref-path');
            const minimaxControls = document.getElementById('minimax-controls');
            const t5Controls = document.getElementById('t5-controls');

            // Engine Select
            // if (eSel) eSel.value = blk.mode || 'minimax';

            // Visibility
            if (blk.mode === 't5') {
                minimaxControls.classList.add('hidden');
                t5Controls.classList.remove('hidden');
            } else {
                minimaxControls.classList.remove('hidden');
                t5Controls.classList.add('hidden');
            }

            if (mSel) mSel.value = blk.model;
            if (vSel) vSel.value = blk.voice || "Cantonese_ProfessionalHost（F)";
            // if (t5Path) t5Path.value = blk.voicePath || "";
            if (tSel) tSel.value = blk.tone || "";

            if (sSlide) {
                sSlide.value = blk.params.speed !== undefined ? blk.params.speed : 1.0;
                document.getElementById('val-speed').textContent = sSlide.value;
            }
            if (tSlide) {
                let t = blk.params.pitch;
                if (t === undefined) t = 0.0;
                tSlide.value = t;
                document.getElementById('val-temp').textContent = t;
            }
        }

        // --- Actions ---

        async function synthesis(blk, saveToFile = false, addToTimeline = true) {
            // if (!STATE.config.apiKey) { alert("Please set MiniMax API Key in Settings"); return null; }

            try {
                let result;
                if (blk.mode === 't5') {
                    result = await callLocalT5(blk);
                } else {
                    if (!STATE.config.apiKey) { alert("请在设置中填写 MiniMax API 密钥"); return null; }
                    result = await callMiniMaxTTS(blk);
                }

                const audioBuffer = result.data;
                const mimeType = result.mimeType;

                blk.lastAudio = audioBuffer;
                blk.lastMimeType = mimeType;
                drawBlockWaveform(blk);

                if (audioBuffer && saveToFile) {
                    // For T5, the result might already be a file path string if handled that way,
                    // but callLocalT5 will return buffer to keep consistent interface for preview.
                    // Actually, if we use the server for T5, it can save file directly.
                    // But for preview we need bytes.
                    // Let's stick to buffer for consistency here, unless it's too large.

                    const sanText = blk.text.replace(/[^a-zA-Z0-9\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf]/g, '').substring(0, 10) || "Audio";
                    const nextSeq = getNextSequenceNumber(STATE.config.outputFolder);
                    const seqStr = nextSeq.toString().padStart(3, '0');

                    // Determine extension
                    let ext = '.wav';
                    if (mimeType && (mimeType.includes('mp3') || mimeType.includes('mpeg'))) {
                        ext = '.mp3';
                    }

                    const fname = `${seqStr}_${sanText}_${blk.mode}${ext}`;

                    if (!fs.existsSync(STATE.config.outputFolder)) fs.mkdirSync(STATE.config.outputFolder, { recursive: true });
                    const fpath = path.join(STATE.config.outputFolder, fname);
                    fs.writeFileSync(fpath, audioBuffer);

                    if (addToTimeline) importToHost(fpath);
                    return fpath;
                } else {
                    return audioBuffer;
                }

            } catch (e) {
                console.error(e);
                alert("合成错误：" + e.message);
                throw e;
            }
        }

        async function callLocalT5(blk) {
            writeLog(`Requesting T5 synthesis: ${blk.text}`);
            const payload = {
                text: blk.text,
                voice_path: blk.voicePath || null,
                speed: parseFloat(blk.params.speed || 1.0)
            };

            return new Promise((resolve, reject) => {
                const req = http.request({
                    hostname: 'localhost',
                    port: 8085,
                    path: '/generate_t5',
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                }, res => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        if (res.statusCode >= 400) return reject(new Error("服务器错误：" + data));
                        try {
                            const json = JSON.parse(data);
                            if (!json.success) return reject(new Error(json.message));

                            // The server builds the file. We need to read it back into buffer for consistency with 'preview'
                            // Or we can just play the fileUrl if previews supported it, but our previewBlock makes a Blob.
                            // So let's read the file.
                            if (json.path && fs.existsSync(json.path)) {
                                const buf = fs.readFileSync(json.path);
                                resolve({ data: buf, mimeType: 'audio/wav' });
                            } else {
                                reject(new Error("文件未创建。"));
                            }
                        } catch (e) { reject(e); }
                    });
                });
                req.on('error', (e) => reject(new Error("本地服务器错误。是否在运行？" + e.message)));
                req.write(JSON.stringify(payload));
                req.end();
            });
        }

        async function callMiniMaxTTS(blk) {
            const url = 'https://api.minimaxi.com/v1/t2a_v2';

            const voiceSetting = {
                voice_id: blk.voice,
                speed: parseFloat(blk.params.speed !== undefined ? blk.params.speed : 1.0),
                vol: 1.0,
                pitch: parseFloat(blk.params.pitch !== undefined ? blk.params.pitch : 0.0)
            };

            // MiniMax T2A V2 的 voice_setting 不支持 emotion 字段，
            // 将语气转换为文本前缀提示词，避免 invalid params 错误。
            // 粤语克隆音色：先把文本自动转成带 Jyutping 标注，才能用粤语发音。
            let contentText = blk.text;
            if (isCantoneseClonedVoice(blk.voice) && typeof window.toJyutping === 'function') {
                contentText = window.toJyutping(blk.text);
            }
            let ttsText = contentText;
            if (blk.tone && blk.tone.trim()) {
                ttsText = `(${blk.tone.trim()}语气) ${contentText}`;
            }

            const payload = {
                model: blk.model,
                text: ttsText,
                stream: false,
                output_format: 'hex',
                voice_setting: voiceSetting,
                audio_setting: {
                    sample_rate: 32000,
                    bitrate: 128000,
                    format: 'mp3',
                    channel: 1
                }
            };

            const keyMask = STATE.config.apiKey ? (STATE.config.apiKey.slice(0, 6) + '...') : '(empty)';
            writeLog(`Requesting MiniMax TTS: url=${url}, model=${blk.model}, voice=${blk.voice}, keyMask=${keyMask}, groupId=${STATE.config.groupId || '(empty)'}`);
            writeLog(`TTS original length=${blk.text.length}, final length=${ttsText.length}, speed=${voiceSetting.speed}, pitch=${voiceSetting.pitch}`);
            writeLog(`TTS final text (first 300 chars): ${ttsText.substring(0, 300)}`);

            return new Promise((resolve, reject) => {
                const req = https.request(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${STATE.config.apiKey}`
                    }
                }, res => {
                    let data = [];
                    res.on('data', chunk => data.push(chunk));
                    res.on('end', () => {
                        const buf = Buffer.concat(data);
                        const str = buf.toString();
                        writeLog(`MiniMax response status=${res.statusCode}, body=${str}`);

                        if (res.statusCode >= 400) {
                            const errMsg = `API 错误 ${res.statusCode}: ${str}`;
                            return reject(new Error(errMsg));
                        }

                        try {
                            const json = JSON.parse(str);
                            if (json.base_resp && json.base_resp.status_code !== 0) {
                                const errMsg = `API 错误：${json.base_resp.status_msg}`;
                                return reject(new Error(errMsg));
                            }

                            writeLog("API Response Success");

                            if (json.data && json.data.audio) {
                                const audioHex = json.data.audio;
                                const audioBuf = Buffer.from(audioHex, 'hex');
                                const format = (json.extra_info && json.extra_info.audio_format) ? json.extra_info.audio_format : 'mp3';
                                const mimeType = `audio/${format === 'mp3' ? 'mpeg' : format}`;
                                return resolve({ data: audioBuf, mimeType: mimeType });
                            }

                            reject(new Error("响应中未找到音频数据。"));
                        } catch (e) {
                            writeLog("Parse Error: " + e.message + " Raw: " + str.substring(0, 200));
                            reject(new Error("响应解析错误：" + e.message));
                        }
                    });
                });
                req.on('error', (e) => {
                    writeLog("Network request error: " + e.message);
                    reject(new Error("网络请求错误：" + e.message));
                });
                req.write(JSON.stringify(payload));
                req.end();
            });
        }

        // --- Voice Cloning (MiniMax 音色快速复刻) ---

        function buildGroupQuery() {
            return STATE.config.groupId ? ('?GroupId=' + encodeURIComponent(STATE.config.groupId)) : '';
        }

        // 判断某个 voice_id 是否为「粤语」克隆音色
        function isCantoneseClonedVoice(voiceId) {
            const v = STATE.clonedVoices.find(c => c.voice_id === voiceId);
            return !!(v && v.lang === 'cantonese');
        }

        // Step 1: 上传参考音频，获取 file_id（以字符串返回以保留 int64 精度）
        function uploadCloneFile(filePath) {
            const fileData = fs.readFileSync(filePath);
            const filename = path.basename(filePath);
            const ext = path.extname(filePath).toLowerCase();
            const ctMap = { '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4' };
            const contentType = ctMap[ext] || 'application/octet-stream';
            const boundary = '----AiBowMiniMax' + Date.now();

            const head = Buffer.from(
                `--${boundary}\r\nContent-Disposition: form-data; name="purpose"\r\n\r\nvoice_clone\r\n` +
                `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`
            );
            const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
            const body = Buffer.concat([head, fileData, tail]);

            writeLog(`Uploading clone sample: ${filename} (${fileData.length} bytes)`);

            return new Promise((resolve, reject) => {
                const req = https.request({
                    hostname: 'api.minimaxi.com',
                    path: '/v1/files/upload' + buildGroupQuery(),
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${STATE.config.apiKey}`,
                        'Content-Type': `multipart/form-data; boundary=${boundary}`,
                        'Content-Length': body.length
                    }
                }, res => {
                    let data = '';
                    res.on('data', c => data += c);
                    res.on('end', () => {
                        if (res.statusCode >= 400) {
                            writeLog(`Upload error ${res.statusCode}: ${data}`);
                            return reject(new Error(`上传错误 ${res.statusCode}: ${data.substring(0, 200)}`));
                        }
                        // 用正则先取出 file_id 字符串，避免 JSON.parse 丢失 int64 精度
                        const idMatch = data.match(/"file_id"\s*:\s*(\d+)/);
                        if (idMatch) {
                            writeLog("Upload success, file_id=" + idMatch[1]);
                            return resolve(idMatch[1]);
                        }
                        try {
                            const json = JSON.parse(data);
                            if (json.base_resp && json.base_resp.status_code !== 0) {
                                return reject(new Error("上传失败：" + json.base_resp.status_msg));
                            }
                        } catch (e) { /* ignore */ }
                        reject(new Error("未获取到 file_id：" + data.substring(0, 200)));
                    });
                });
                req.on('error', e => reject(new Error("上传网络错误：" + e.message)));
                req.write(body);
                req.end();
            });
        }

        // Step 2: 用 file_id 发起复刻，注册自定义 voice_id
        function cloneVoiceRequest(fileId, voiceId, opts) {
            opts = opts || {};
            // 手动拼 JSON，保证 file_id 作为大整数不加引号、不丢精度
            let bodyStr = `{"file_id": ${fileId}, "voice_id": "${voiceId}"`;
            if (opts.needNoiseReduction) bodyStr += `, "need_noise_reduction": true`;
            if (opts.needVolumeNormalization) bodyStr += `, "need_volume_normalization": true`;
            if (opts.text && opts.text.trim()) {
                const safeText = opts.text.trim().replace(/\\/g, '\\\\').replace(/"/g, '\\"');
                bodyStr += `, "text": "${safeText}", "model": "${opts.model || 'speech-2.8-hd'}"`;
            }
            bodyStr += `}`;
            const body = Buffer.from(bodyStr, 'utf8');

            writeLog(`Cloning voice: voice_id=${voiceId}, file_id=${fileId}`);

            return new Promise((resolve, reject) => {
                const req = https.request({
                    hostname: 'api.minimaxi.com',
                    path: '/v1/voice_clone' + buildGroupQuery(),
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${STATE.config.apiKey}`,
                        'Content-Type': 'application/json',
                        'Content-Length': body.length
                    }
                }, res => {
                    let data = '';
                    res.on('data', c => data += c);
                    res.on('end', () => {
                        if (res.statusCode >= 400) {
                            writeLog(`Clone error ${res.statusCode}: ${data}`);
                            return reject(new Error(`复刻错误 ${res.statusCode}: ${data.substring(0, 200)}`));
                        }
                        try {
                            const json = JSON.parse(data);
                            if (json.base_resp && json.base_resp.status_code !== 0) {
                                return reject(new Error("复刻失败：" + json.base_resp.status_msg));
                            }
                            writeLog("Clone success: " + voiceId);
                            resolve(json);
                        } catch (e) {
                            reject(new Error("复刻响应解析错误：" + data.substring(0, 200)));
                        }
                    });
                });
                req.on('error', e => reject(new Error("复刻网络错误：" + e.message)));
                req.write(body);
                req.end();
            });
        }

        // 将克隆音色填充到下拉框
        function refreshVoiceOptions() {
            const group = document.getElementById('cloned-voice-group');
            if (!group) return;
            group.innerHTML = '';
            if (!STATE.clonedVoices || STATE.clonedVoices.length === 0) {
                group.style.display = 'none';
                return;
            }
            group.style.display = '';
            STATE.clonedVoices.forEach(v => {
                const opt = document.createElement('option');
                opt.value = v.voice_id;
                const langTag = v.lang === 'cantonese' ? '克隆·粤' : '克隆·普';
                opt.textContent = (v.name ? v.name : v.voice_id) + '（' + langTag + '）';
                group.appendChild(opt);
            });
        }

        function saveClonedVoices() {
            localStorage.setItem('minimax_cloned_voices', JSON.stringify(STATE.clonedVoices));
            saveConfigFile();
        }

        // 生成唯一且合规的 voice_id（字母开头、以字母/数字结尾、8-256 位）
        function genVoiceId() {
            const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
            return 'Clone_' + suffix;
        }

        function setupCloneModal() {
            const modal = document.getElementById('clone-modal');
            const statusEl = document.getElementById('clone-status');
            const pathEl = document.getElementById('clone-file-path');
            const idEl = document.getElementById('clone-voice-id');

            const setStatus = (msg, color) => {
                if (statusEl) {
                    statusEl.textContent = msg || '';
                    statusEl.style.color = color || '#888';
                }
            };

            document.getElementById('btn-clone').onclick = () => {
                setStatus('');
                // 每次打开都自动生成一个唯一 ID，避免与服务端重复
                idEl.value = genVoiceId();
                modal.classList.remove('hidden');
            };
            document.getElementById('btn-close-clone').onclick = () => modal.classList.add('hidden');

            document.getElementById('btn-regen-id').onclick = () => {
                idEl.value = genVoiceId();
            };

            document.getElementById('btn-clone-browse').onclick = () => {
                const result = window.cep.fs.showOpenDialogEx(false, false, "选择参考音频", STATE.config.outputFolder, ["mp3", "wav", "m4a"]);
                if (result.data && result.data.length > 0) {
                    pathEl.value = result.data[0];
                }
            };

            document.getElementById('btn-do-clone').onclick = async () => {
                const filePath = pathEl.value;
                const voiceId = idEl.value.trim();
                const displayName = document.getElementById('clone-display-name').value.trim();
                const previewText = document.getElementById('clone-preview-text').value;
                const model = document.getElementById('clone-model').value;
                const lang = document.getElementById('clone-lang').value;
                const needNoise = document.getElementById('clone-noise-reduction').checked;
                const needVol = document.getElementById('clone-vol-norm').checked;

                if (!STATE.config.apiKey) { setStatus('请先在设置中填写 MiniMax API 密钥', '#f66'); return; }
                if (!filePath) { setStatus('请选择参考音频文件', '#f66'); return; }
                if (!fs.existsSync(filePath)) { setStatus('音频文件不存在', '#f66'); return; }
                if (!/^[a-zA-Z][a-zA-Z0-9_-]{6,254}[a-zA-Z0-9]$/.test(voiceId)) {
                    setStatus('音色 ID 不合法：需字母开头，8-256 位，仅含字母/数字/-/_，且不以 - 或 _ 结尾', '#f66');
                    return;
                }
                if (STATE.clonedVoices.some(v => v.voice_id === voiceId)) {
                    setStatus('该音色 ID 已存在，点 ↻ 重新生成', '#f66');
                    return;
                }

                try {
                    setStatus('正在上传音频…', '#6cf');
                    const fileId = await uploadCloneFile(filePath);

                    setStatus('上传成功，正在克隆音色…', '#6cf');
                    await cloneVoiceRequest(fileId, voiceId, {
                        text: previewText,
                        model: model,
                        needNoiseReduction: needNoise,
                        needVolumeNormalization: needVol
                    });

                    STATE.clonedVoices.push({ voice_id: voiceId, name: displayName || voiceId, lang: lang, created: Date.now() });
                    saveClonedVoices();
                    refreshVoiceOptions();

                    // 自动应用到当前块
                    const vSel = document.getElementById('voice-select');
                    if (vSel) vSel.value = voiceId;
                    const blk = getBlock(STATE.selectedBlockId);
                    if (blk) { blk.voice = voiceId; renderBlockList(); }

                    setStatus('克隆成功！已添加音色：' + (displayName || voiceId), '#6f6');
                } catch (e) {
                    writeLog("Clone flow error: " + e.message);
                    setStatus('克隆失败：' + e.message, '#f66');
                }
            };
        }

        // --- Contact Support Modal ---
        function setupSupportModal() {
            const modal = document.getElementById('support-modal');
            if (!modal) return;
            const qqEl = document.getElementById('support-qq');
            const statusEl = document.getElementById('support-copy-status');
            const qq = qqEl ? qqEl.value : '1940905115';

            document.getElementById('btn-close-support').onclick = () => modal.classList.add('hidden');

            document.getElementById('btn-copy-qq').onclick = async () => {
                const ok = await copyText(qq);
                if (statusEl) statusEl.textContent = ok ? '已复制：' + qq : '复制失败，请手动复制：' + qq;
            };

            document.getElementById('btn-open-qq').onclick = () => {
                openExternal(`tencent://message/?uin=${qq}&Site=${encodeURIComponent('AiBow Voice MiniMax')}&Menu=yes`);
            };
        }

        function openSupportModal() {
            const modal = document.getElementById('support-modal');
            if (!modal) return;
            // 强制启用弹窗内按钮（避免授权前被 setUiEnabled 禁用）
            modal.querySelectorAll('button').forEach(b => { b.disabled = false; b.style.opacity = '1'; });
            const statusEl = document.getElementById('support-copy-status');
            if (statusEl) statusEl.textContent = '';
            modal.classList.remove('hidden');
        }

        // --- Feedback Modal (提供反馈 / 请求功能 / 报告错误) ---
        function setupFeedbackModal() {
            const modal = document.getElementById('feedback-modal');
            if (!modal) return;
            const emailEl = document.getElementById('feedback-email');
            const statusEl = document.getElementById('feedback-copy-status');
            const email = emailEl ? emailEl.value : '1940905115@qq.com';

            document.getElementById('btn-close-feedback').onclick = () => modal.classList.add('hidden');

            document.getElementById('btn-copy-email').onclick = async () => {
                const ok = await copyText(email);
                if (statusEl) statusEl.textContent = ok ? '已复制：' + email : '复制失败，请手动复制：' + email;
            };

            document.getElementById('btn-send-email').onclick = () => {
                const title = (document.getElementById('feedback-title') || {}).textContent || 'AiBow Voice MiniMax';
                openExternal(`mailto:${email}?subject=${encodeURIComponent('AiBow Voice MiniMax ' + title)}`);
            };
        }

        function openFeedbackModal(type) {
            const modal = document.getElementById('feedback-modal');
            if (!modal) return;
            const titles = {
                provideFeedback: '提供反馈',
                requestFeature: '请求功能',
                reportBug: '报告错误'
            };
            const titleEl = document.getElementById('feedback-title');
            if (titleEl) titleEl.textContent = titles[type] || '联系我们';
            modal.querySelectorAll('button').forEach(b => { b.disabled = false; b.style.opacity = '1'; });
            const statusEl = document.getElementById('feedback-copy-status');
            if (statusEl) statusEl.textContent = '';
            modal.classList.remove('hidden');
        }

        function getNextSequenceNumber(folder) {
            if (!fs.existsSync(folder)) return 1;
            try {
                const files = fs.readdirSync(folder);
                let max = 0;
                const regex = /^(\d{3,})_.*\.(wav|mp3)$/;
                files.forEach(f => {
                    const match = f.match(regex);
                    if (match) {
                        const num = parseInt(match[1]);
                        if (!isNaN(num) && num > max) max = num;
                    }
                });
                return max + 1;
            } catch (e) { return 1; }
        }

        async function previewBlock(blk) {
            if (!STATE.config.apiKey) { alert("请在设置中填写 MiniMax API 密钥"); return; }
            showLoading(true);
            try {
                // We need mimeType for correct preview if not WAV
                const result = await callMiniMaxTTS(blk);
                const buf = result.data;
                const mime = result.mimeType || 'audio/wav';

                if (buf) {
                    blk.lastAudio = buf;
                    blk.lastMimeType = mime;
                    drawBlockWaveform(blk);
                    const blob = new Blob([buf], { type: mime });
                    const url = URL.createObjectURL(blob);
                    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
                    const audio = new Audio(url);
                    currentAudio = audio;
                    attachAudioEvents(audio);
                    audio.onended = () => { currentAudio = null; updatePlayerUI(); };
                    audio.play();
                }
            } catch (e) { console.error(e); alert("预览错误：" + e.message); }
            showLoading(false);
        }

        async function playAll() {
            if (!STATE.config.apiKey) { alert("请在设置中填写 MiniMax API 密钥"); return; }
            showLoading(true);
            for (const blk of STATE.blocks) {
                try {
                    const result = await callMiniMaxTTS(blk);
                    const buf = result.data;
                    const mime = result.mimeType || 'audio/wav';
                    if (buf) {
                        await new Promise(r => {
                            const b = new Blob([buf], { type: mime });
                            const u = URL.createObjectURL(b);
                            const a = new Audio(u);
                            currentAudio = a;
                            attachAudioEvents(a);
                            a.onended = () => { currentAudio = null; updatePlayerUI(); r(); };
                            a.play();
                        });
                    }
                } catch (e) { console.error(e); }
            }
            showLoading(false);
        }

        async function exportSelected() {
            showLoading(true);
            const blk = getBlock(STATE.selectedBlockId);
            if (blk) await synthesis(blk, true, document.getElementById('chk-add-timeline').checked);
            showLoading(false);
        }

        async function exportAll() {
            showLoading(true);
            const add = document.getElementById('chk-add-timeline').checked;
            for (let i = STATE.blocks.length - 1; i >= 0; i--) {
                await synthesis(STATE.blocks[i], true, add);
                await new Promise(r => setTimeout(r, 500));
            }
            showLoading(false);
        }

        function showLoading(b) {
            const el = document.getElementById('loading-overlay');
            if (b) el.classList.remove('hidden'); else el.classList.add('hidden');
        }

        function setupSettings() {
            document.getElementById('btn-close-settings').onclick = () => document.getElementById('settings-modal').classList.add('hidden');
            document.getElementById('btn-settings').onclick = () => {
                document.getElementById('setting-api-key').value = STATE.config.apiKey;
                document.getElementById('setting-group-id').value = STATE.config.groupId;
                document.getElementById('setting-output-path').value = STATE.config.outputFolder;
                document.getElementById('settings-modal').classList.remove('hidden');
            };

            document.getElementById('btn-save-settings').onclick = () => {
                STATE.config.apiKey = document.getElementById('setting-api-key').value;
                STATE.config.groupId = document.getElementById('setting-group-id').value.trim();
                const outPath = document.getElementById('setting-output-path').value;
                if (outPath) STATE.config.outputFolder = outPath;

                localStorage.setItem('minimax_tts_key', STATE.config.apiKey);
                localStorage.setItem('minimax_group_id', STATE.config.groupId);
                localStorage.setItem('minimax_v2_output', STATE.config.outputFolder);
                saveConfigFile();
                document.getElementById('settings-modal').classList.add('hidden');
            };

            document.getElementById('btn-browse-output').onclick = () => {
                const result = window.cep.fs.showOpenDialogEx(false, true, "选择输出文件夹", STATE.config.outputFolder);
                if (result.data && result.data.length > 0) {
                    document.getElementById('setting-output-path').value = result.data[0];
                }
            };
        }

        function setupToolbar() {
            document.getElementById('btn-play-all').onclick = playAll;
            document.getElementById('btn-add-block').onclick = addBlock;
            document.getElementById('btn-load-project').onclick = loadProject;
        }

        function saveProject() {
            const data = JSON.stringify(STATE.blocks, null, 2);
            const result = window.cep.fs.showSaveDialogEx("保存项目", STATE.config.outputFolder, ["json"], "project.json");
            if (result.data) {
                fs.writeFileSync(result.data, data);
                alert("已保存！");
            }
        }

        function loadProject() {
            const result = window.cep.fs.showOpenDialogEx(false, false, "加载项目", STATE.config.outputFolder, ["json"]);
            if (result.data && result.data.length > 0) {
                try {
                    const data = fs.readFileSync(result.data[0], 'utf8');
                    STATE.blocks = JSON.parse(data);
                    if (STATE.blocks.length === 0) addBlock();
                    renderBlockList();
                    selectBlock(STATE.blocks[0].id);
                } catch (e) { alert("加载错误：" + e.message); }
            }
        }

        function formatTime(s) {
            if (!s || isNaN(s)) return '0:00';
            const m = Math.floor(s / 60);
            const sec = Math.floor(s % 60).toString().padStart(2, '0');
            return `${m}:${sec}`;
        }

        function updatePlayerUI() {
            const playBtn = document.getElementById('player-play-pause');
            const progress = document.getElementById('player-progress');
            const curEl = document.getElementById('player-current');
            const durEl = document.getElementById('player-duration');
            if (!currentAudio) {
                if (playBtn) playBtn.textContent = '▶';
                if (progress) progress.value = 0;
                if (curEl) curEl.textContent = '0:00';
                if (durEl) durEl.textContent = '0:00';
                return;
            }
            if (playBtn) playBtn.textContent = currentAudio.paused ? '▶' : '❚❚';
            if (progress && currentAudio.duration) {
                progress.value = (currentAudio.currentTime / currentAudio.duration) * 100;
            }
            if (curEl) curEl.textContent = formatTime(currentAudio.currentTime);
            if (durEl) durEl.textContent = formatTime(currentAudio.duration);
        }

        function attachAudioEvents(audio) {
            audio.onloadedmetadata = () => updatePlayerUI();
            audio.ontimeupdate = () => updatePlayerUI();
            audio.onplay = () => updatePlayerUI();
            audio.onpause = () => updatePlayerUI();
            audio.onended = () => updatePlayerUI();
        }

        function setupAudioPlayer() {
            const playBtn = document.getElementById('player-play-pause');
            const progress = document.getElementById('player-progress');
            if (playBtn) {
                playBtn.onclick = () => {
                    if (!currentAudio) return;
                    if (currentAudio.paused) currentAudio.play();
                    else currentAudio.pause();
                };
            }
            if (progress) {
                progress.oninput = (e) => {
                    if (!currentAudio || !currentAudio.duration) return;
                    currentAudio.currentTime = (e.target.value / 100) * currentAudio.duration;
                };
            }
            updatePlayerUI();
        }


        function setupRightPanel() {
            document.getElementById('engine-select').onchange = (e) => {
                const blk = getBlock(STATE.selectedBlockId);
                if (blk) {
                    blk.mode = e.target.value;
                    syncRightPanel(blk); // update visibility immediately
                }
            };

            document.getElementById('model-select').onchange = (e) => {
                const blk = getBlock(STATE.selectedBlockId);
                if (blk) blk.model = e.target.value;
                renderBlockList();
            };

            const inputTone = document.getElementById('input-tone');
            if (inputTone) {
                inputTone.onchange = (e) => {
                    const blk = getBlock(STATE.selectedBlockId);
                    if (blk) blk.tone = e.target.value;
                };
            }

            document.getElementById('voice-select').onchange = (e) => {
                const blk = getBlock(STATE.selectedBlockId);
                if (blk) blk.voice = e.target.value;
                renderBlockList();
            };

            // T5 Browser (Reuse CEP dialog)
            document.getElementById('btn-browse-ref').onclick = () => {
                const result = window.cep.fs.showOpenDialogEx(false, false, "选择参考音频", STATE.config.outputFolder, ["wav", "mp3", "m4a"]);
                if (result.data && result.data.length > 0) {
                    const path = result.data[0];
                    document.getElementById('t5-ref-path').value = path;
                    const blk = getBlock(STATE.selectedBlockId);
                    if (blk) blk.voicePath = path;
                }
            };

            document.getElementById('slider-speed').oninput = (e) => {
                const val = e.target.value;
                document.getElementById('val-speed').textContent = val;
                const blk = getBlock(STATE.selectedBlockId);
                if (blk) blk.params.speed = val;
            }
            document.getElementById('slider-temp').oninput = (e) => {
                const val = e.target.value;
                document.getElementById('val-temp').textContent = val;
                const blk = getBlock(STATE.selectedBlockId);
                if (blk) blk.params.pitch = val;
            }
        }

        function getBlock(id) { return STATE.blocks.find(b => b.id === id); }
        function deleteBlock(id) {
            STATE.blocks = STATE.blocks.filter(b => b.id !== id);
            renderBlockList();
            if (STATE.blocks.length > 0) selectBlock(STATE.blocks[STATE.blocks.length - 1].id);
        }

        function reorderBlocks(srcId, targetId) {
            const srcIdx = STATE.blocks.findIndex(b => b.id === srcId);
            const tgtIdx = STATE.blocks.findIndex(b => b.id === targetId);
            if (srcIdx === -1 || tgtIdx === -1) return;

            const [item] = STATE.blocks.splice(srcIdx, 1);
            STATE.blocks.splice(tgtIdx, 0, item);
            renderBlockList();
        }

        async function exportBlockAudio(blk) {
            if (!blk.lastAudio) {
                // 没有缓冲则重新合成
                return await synthesis(blk, true, true);
            }
            // 把缓冲保存为文件
            let ext = '.wav';
            if (blk.lastMimeType && (blk.lastMimeType.includes('mp3') || blk.lastMimeType.includes('mpeg'))) {
                ext = '.mp3';
            }
            const sanText = blk.text.replace(/[^a-zA-Z0-9\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf]/g, '').substring(0, 10) || "Audio";
            const nextSeq = getNextSequenceNumber(STATE.config.outputFolder);
            const seqStr = nextSeq.toString().padStart(3, '0');
            const fname = `${seqStr}_${sanText}_${blk.mode}${ext}`;
            if (!fs.existsSync(STATE.config.outputFolder)) fs.mkdirSync(STATE.config.outputFolder, { recursive: true });
            const fpath = path.join(STATE.config.outputFolder, fname);
            fs.writeFileSync(fpath, blk.lastAudio);
            return fpath;
        }

        async function importToHost(fullpath) {
            // Adobe CEP Support
            if (csInterface) {
                const osPath = (os.platform() === 'win32') ? fullpath.replace(/\\/g, '\\\\') : fullpath;
                csInterface.evalScript(`importAndOrganize("${osPath}")`, (res) => {
                    console.log("Import:", res);
                    if (res && res.indexOf('Success') !== -1) {
                        let id = res.indexOf('SuccessID:') !== -1 ? res.split('SuccessID:')[1].trim() : res.split('Success:')[1].trim();
                        if (id) csInterface.evalScript(`addItemToSequence("${id}")`);
                    }
                });
                return;
            }

            // Resolve Bridge Support (Only if CSInterface is missing)
            if (window.ResolveBridge) {
                console.log("Using Resolve Bridge for import...");
                const res = await window.ResolveBridge.importAudio(fullpath);
                console.log("Resolve Import Result:", res);
                if (res.success) {
                    // Success
                } else {
                    alert("Resolve Import Failed: " + res.message);
                }
                return;
            }
        }

        // Hide AESP analytics consent banner (injected dynamically by licensing lib)
        function hideAnalyticsBanner() {
            const all = document.querySelectorAll('div');
            for (const el of all) {
                if (el.textContent && el.textContent.includes('analytics') &&
                    (el.textContent.includes('Allow') || el.textContent.includes('OK') || el.textContent.includes('Deny')) &&
                    el.children.length < 10 && !el.querySelector('#app-container')) {
                    el.style.display = 'none';
                }
            }
        }
        new MutationObserver(() => hideAnalyticsBanner()).observe(document.body, { childList: true, subtree: true });
        setInterval(hideAnalyticsBanner, 1000);

        // Start
        window.addEventListener('load', init);

    } catch (e) {
        alert("严重 JS 错误：" + e.message + "\n堆栈：" + e.stack);
        console.error("CRITICAL JS ERROR:", e);
    }
})();
