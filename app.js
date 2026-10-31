/**
 * DocuTranslate AI - Upgraded Application Logic with Settings Modal, PWA, & Vercel Integration
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- PWA Service Worker & Install Logic ---
    let deferredPrompt = null;
    const installAppBtn = document.getElementById('installAppBtn');

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(reg => console.log('PWA Service Worker registered:', reg.scope))
                .catch(err => console.log('Service Worker registration failed:', err));
        });
    }

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (installAppBtn) {
            installAppBtn.classList.remove('hidden');
        }
    });

    if (installAppBtn) {
        installAppBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                    showToast('ขอบคุณที่ติดตั้งแอป DocuTranslate AI!', 'success');
                }
                deferredPrompt = null;
                installAppBtn.classList.add('hidden');
            } else {
                showToast('หากใช้บน iOS Safari ให้กดปุ่ม Share แล้วเลือก "Add to Home Screen" เพื่อติดตั้ง', 'info');
            }
        });
    }

    // --- DOM Elements ---
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const dropzoneContent = document.getElementById('dropzoneContent');
    const fileDetails = document.getElementById('fileDetails');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    const removeFileBtn = document.getElementById('removeFileBtn');
    
    const translateBtn = document.getElementById('translateBtn');
    const apiEngine = document.getElementById('apiEngine');
    const apiKey = document.getElementById('apiKey');
    const apiKeyGroup = document.getElementById('apiKeyGroup');
    const apiKeyHelpLink = document.getElementById('apiKeyHelpLink');
    const apiKeyHint = document.getElementById('apiKeyHint');
    const toggleKeyVisibility = document.getElementById('toggleKeyVisibility');
    
    const sourceLang = document.getElementById('sourceLang');
    const targetLang = document.getElementById('targetLang');
    
    const progressSection = document.getElementById('progressSection');
    const statusMessage = document.getElementById('statusMessage');
    const progressPercentage = document.getElementById('progressPercentage');
    const progressBar = document.getElementById('progressBar');
    
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');
    
    const downloadSection = document.getElementById('downloadSection');
    const downloadBtn = document.getElementById('downloadBtn');
    const toastContainer = document.getElementById('toastContainer');

    // Modal Elements
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const resetCacheBtn = document.getElementById('resetCacheBtn');
    const modalActiveEngine = document.getElementById('modalActiveEngine');

    // --- State Variables ---
    let selectedFile = null;
    let translatedFileBlob = null;
    let translatedFileName = '';

    // --- Restore Saved Settings ---
    const savedEngine = localStorage.getItem('docutranslate_engine') || 'vercel';
    const savedApiKey = localStorage.getItem('docutranslate_apikey') || '';
    
    apiEngine.value = savedEngine;
    apiKey.value = savedApiKey;
    updateEngineUI(savedEngine);

    // --- Settings Modal Handlers ---
    if (settingsBtn && settingsModal) {
        settingsBtn.addEventListener('click', () => {
            const engineNames = {
                vercel: 'DeepL Serverless (Vercel)',
                deepl: 'DeepL API (Local)',
                gemini: 'Google Gemini API',
                demo: 'Demo Mode'
            };
            if (modalActiveEngine) {
                modalActiveEngine.textContent = engineNames[apiEngine.value] || apiEngine.value;
            }
            settingsModal.classList.remove('hidden');
        });
    }

    if (closeModalBtn && settingsModal) {
        closeModalBtn.addEventListener('click', () => {
            settingsModal.classList.add('hidden');
        });
    }

    if (settingsModal) {
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) {
                settingsModal.classList.add('hidden');
            }
        });
    }

    if (resetCacheBtn) {
        resetCacheBtn.addEventListener('click', () => {
            localStorage.clear();
            showToast('ล้างข้อมูลการตั้งค่าในเครื่องเรียบร้อยแล้ว!', 'success');
            setTimeout(() => window.location.reload(), 800);
        });
    }

    // --- Engine Change Listener ---
    apiEngine.addEventListener('change', (e) => {
        const engine = e.target.value;
        localStorage.setItem('docutranslate_engine', engine);
        updateEngineUI(engine);
        validateForm();
    });

    function updateEngineUI(engine) {
        apiKey.style.borderColor = '';
        if (engine === 'vercel') {
            apiKeyGroup.classList.add('hidden');
        } else if (engine === 'deepl') {
            apiKeyGroup.classList.remove('hidden');
            apiKeyHelpLink.href = 'https://www.deepl.com/pro-api';
            apiKeyHelpLink.classList.remove('hidden');
            apiKeyHint.textContent = 'ใส่ DeepL Auth Key (ลงท้ายด้วย :fx สำหรับแพ็กเกจฟรี) — ส่งผ่านเซิร์ฟเวอร์ของเว็บนี้ไปยัง DeepL เท่านั้น ไม่ถูกบันทึกฝั่งเซิร์ฟเวอร์';
            apiKey.placeholder = 'เช่น xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx';
        } else if (engine === 'gemini') {
            apiKeyGroup.classList.remove('hidden');
            apiKeyHelpLink.href = 'https://aistudio.google.com/app/apikey';
            apiKeyHelpLink.classList.remove('hidden');
            apiKeyHint.textContent = 'ใส่ Google Gemini API Key ที่ได้จาก Google AI Studio';
            apiKey.placeholder = 'เช่น AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxx';
        } else {
            apiKeyGroup.classList.add('hidden');
        }
    }

    // --- API Key Input Listener ---
    apiKey.addEventListener('input', (e) => {
        apiKey.style.borderColor = '';
        localStorage.setItem('docutranslate_apikey', e.target.value.trim());
        validateForm();
    });

    toggleKeyVisibility.addEventListener('click', () => {
        const isPassword = apiKey.type === 'password';
        apiKey.type = isPassword ? 'text' : 'password';
        toggleKeyVisibility.innerHTML = isPassword ? '<i data-lucide="eye-off"></i>' : '<i data-lucide="eye"></i>';
        lucide.createIcons();
    });

    // --- Drag and Drop File Handlers ---
    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add('drag-over');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('drag-over');
        }, false);
    });

    dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files && files.length > 0) {
            handleFileSelect(files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });

    function handleFileSelect(file) {
        if (!file.name.toLowerCase().endsWith('.docx')) {
            showToast('โปรดเลือกเฉพาะไฟล์เอกสาร Word (.docx) เท่านั้น', 'error');
            return;
        }

        selectedFile = file;
        fileName.textContent = file.name;
        fileSize.textContent = formatBytes(file.size);

        dropzoneContent.classList.add('hidden');
        fileDetails.classList.remove('hidden');
        
        fileInput.style.pointerEvents = 'none';

        downloadSection.classList.add('hidden');
        progressSection.classList.add('hidden');
        translatedFileBlob = null;

        validateForm();
    }

    removeFileBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        selectedFile = null;
        fileInput.value = '';
        fileInput.style.pointerEvents = 'auto';

        dropzoneContent.classList.remove('hidden');
        fileDetails.classList.add('hidden');
        downloadSection.classList.add('hidden');
        progressSection.classList.add('hidden');
        validateForm();
    });

    function validateForm() {
        const hasFile = selectedFile !== null;
        translateBtn.disabled = !hasFile;
    }

    // --- Translation Handler ---
    translateBtn.addEventListener('click', async () => {
        if (!selectedFile) {
            showToast('กรุณาลากหรือเลือกไฟล์ Word (.docx) ก่อนเริ่มแปลภาษา', 'error');
            return;
        }

        const engine = apiEngine.value;
        const key = apiKey.value.trim();
        const src = sourceLang.value;
        const tgt = targetLang.value;

        if (engine !== 'demo' && engine !== 'vercel' && !key) {
            apiKey.style.borderColor = 'var(--accent-rose)';
            apiKey.focus();
            showToast('กรุณากรอก API Key ในช่องตั้งค่าด้านซ้ายก่อนครับ (หรือเปลี่ยนเป็น "Demo Mode" เพื่อลองฟรี)', 'error');
            return;
        }

        progressSection.classList.remove('hidden');
        downloadSection.classList.add('hidden');
        translateBtn.disabled = true;

        updateProgress(10, 'กำลังเปิดอ่านโครงสร้างไฟล์ Word (.docx)...', 1);

        try {
            if (engine === 'vercel') {
                await translateWithVercelServerless(selectedFile, src, tgt);
            } else if (engine === 'deepl') {
                await translateWithDeepL(selectedFile, key, src, tgt);
            } else if (engine === 'gemini') {
                await translateWithGemini(selectedFile, key, src, tgt);
            } else {
                await simulateDemoTranslation(selectedFile);
            }
        } catch (err) {
            console.error('Translation error:', err);
            updateProgress(0, `เกิดข้อผิดพลาด: ${err.message}`, 0);
            showToast(`การแปลหยุดชะงัก: ${err.message}`, 'error');
            translateBtn.disabled = false;
        }
    });

    // --- Translation Engines ---
    // ทุกเอนจินใช้ DocxCore.translateDocx (แปลทีละย่อหน้า + header/footer/footnotes)
    // ต่างกันแค่ "ตัวแปลข้อความ" (translate function)

    function getOptions() {
        return {
            preserveFormulas: document.getElementById('preserveFormulas').checked,
            preserveFormatting: document.getElementById('preserveFormatting').checked
        };
    }

    async function translateDocument(file, translator, targetL, engineLabel) {
        const zip = await JSZip.loadAsync(file).catch(() => {
            throw new Error('เปิดไฟล์ไม่ได้ (ไฟล์เสียหายหรือไม่ใช่ .docx ที่ถูกต้อง)');
        });

        const opts = getOptions();
        updateProgress(20, 'กำลังวิเคราะห์ย่อหน้าในเอกสาร...', 1);

        const stats = await DocxCore.translateDocx(zip, {
            translate: translator,
            preserveFormulas: opts.preserveFormulas,
            preserveFormatting: opts.preserveFormatting,
            onProgress: ({ phase, done, total }) => {
                if (phase === 'translate') {
                    const pct = 25 + Math.round((total ? done / total : 1) * 60);
                    updateProgress(pct, `${engineLabel} แปลแล้ว ${done} / ${total} ข้อความ...`, 2);
                } else if (phase === 'write') {
                    updateProgress(92, 'กำลังประกอบโครงสร้างเอกสาร Word กลับเป็น .docx...', 3);
                }
            }
        });
        console.info('DocxCore stats:', stats);

        translatedFileBlob = await zip.generateAsync({
            type: 'blob',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            compression: 'DEFLATE'
        });
        translatedFileName = getTranslatedFileName(file.name, targetL);
        finishTranslation();
    }

    // ส่งข้อความไป /api/translate (Vercel) — คีย์อยู่ฝั่ง server; ถ้าส่ง userKey จะใช้คีย์ของผู้ใช้แทน
    function makeServerTranslator(sourceL, targetL, userKey) {
        return async (texts, { xml }) => {
            const headers = { 'Content-Type': 'application/json' };
            if (userKey) headers['x-user-api-key'] = userKey;
            const body = JSON.stringify({
                texts,
                targetLang: targetL,
                sourceLang: sourceL === 'AUTO' ? undefined : sourceL,
                xml
            });

            let lastError;
            for (let attempt = 0; attempt < 4; attempt++) {
                if (attempt > 0) await sleep(1000 * attempt);
                let res;
                try {
                    res = await fetch('/api/translate', { method: 'POST', headers, body });
                } catch (netErr) {
                    lastError = new Error('เชื่อมต่อเซิร์ฟเวอร์แปลภาษาไม่ได้ (โปรดตรวจสอบอินเทอร์เน็ต หรือเปิดผ่านเว็บที่ deploy บน Vercel)');
                    continue;
                }
                if (res.ok) {
                    const data = await res.json();
                    return data.translations;
                }
                const errData = await res.json().catch(() => ({}));
                lastError = new Error(errData.error || `เซิร์ฟเวอร์ตอบกลับด้วยรหัสข้อผิดพลาด HTTP ${res.status}`);
                if (![429, 502, 503, 504].includes(res.status) || res.status === 502 && /Key|โควตา/.test(lastError.message)) {
                    throw lastError; // ไม่ควรลองซ้ำ (เช่น คีย์ผิด/โควตาหมด)
                }
            }
            throw lastError;
        };
    }

    async function translateWithVercelServerless(file, sourceL, targetL) {
        updateProgress(20, 'กำลังวิเคราะห์เอกสารและส่งข้อความไปแปลผ่าน Vercel Serverless (ซ่อน API Key)...', 2);
        await translateDocument(file, makeServerTranslator(sourceL, targetL, null), targetL, 'DeepL');
    }

    // DeepL ไม่เปิด CORS ให้เบราว์เซอร์เรียกตรง จึงส่งผ่าน /api/translate โดยแนบคีย์ของผู้ใช้ (ไม่ถูกเก็บฝั่ง server)
    async function translateWithDeepL(file, key, sourceL, targetL) {
        updateProgress(20, 'กำลังวิเคราะห์เอกสารและส่งแปลด้วย DeepL Key ของคุณ...', 2);
        await translateDocument(file, makeServerTranslator(sourceL, targetL, key), targetL, 'DeepL');
    }

    // --- Gemini (เรียกจากเบราว์เซอร์ตรง) ---
    async function translateWithGemini(file, key, sourceL, targetL) {
        const langNames = { 'EN-US': 'American English', 'EN-GB': 'British English', ZH: 'Chinese', JA: 'Japanese' };
        const targetName = langNames[targetL] || targetL;
        const sourceName = sourceL === 'AUTO' ? 'the source language' : sourceL;

        async function callGemini(texts, xml) {
            const prompt = `Translate each string in the JSON array below from ${sourceName} to ${targetName}.
Rules:
- Return ONLY a JSON array of strings with exactly ${texts.length} items, in the same order.
- Keep numbers, math variables (x, y, F, m), equations, units and technical symbols unchanged.
${xml ? '- Strings are XML-escaped (&amp; &lt; &gt;): keep that escaping. Keep every tag like <x i="0">…</x> exactly, with the same count and the same i values; translate only the text inside them.\n' : ''}
${JSON.stringify(texts)}`;

            let res;
            try {
                res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
                    })
                });
            } catch (netErr) {
                throw new Error('ไม่สามารถเชื่อมต่อกับ Gemini API ได้');
            }
            if (!res.ok) {
                if (res.status === 400 || res.status === 403) throw new Error('Gemini API Key ไม่ถูกต้องหรือไม่มีสิทธิ์ใช้งาน');
                if (res.status === 429) throw new Error('Gemini API รับคำขอถี่เกินไปหรือโควตาหมด');
                throw new Error(`Gemini API ตอบกลับด้วยรหัส HTTP ${res.status}`);
            }
            const resData = await res.json();
            const responseText = resData.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const jsonMatch = responseText.match(/\[[\s\S]*\]/);
            if (!jsonMatch) return null;
            try {
                const arr = JSON.parse(jsonMatch[0]);
                return Array.isArray(arr) && arr.length === texts.length && arr.every(s => typeof s === 'string') ? arr : null;
            } catch (e) {
                return null;
            }
        }

        const translator = async (texts, { xml }) => {
            const arr = await callGemini(texts, xml);
            if (arr) return arr;
            // ตอบกลับไม่ครบ/ไม่ใช่ JSON: ลองแปลทีละข้อความ แทนการข้ามไปเงียบๆ
            const out = [];
            for (const t of texts) {
                const one = await callGemini([t], xml);
                if (!one) throw new Error('Gemini ตอบกลับรูปแบบที่อ่านไม่ได้ กรุณาลองใหม่หรือเปลี่ยนเครื่องมือแปล');
                out.push(one[0]);
            }
            return out;
        };

        updateProgress(20, 'กำลังวิเคราะห์เอกสารและส่งแปลด้วย Gemini API...', 2);
        await translateDocument(file, translator, targetL, 'Gemini');
    }

    function sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    // --- Demo Mode Simulation ---
    async function simulateDemoTranslation(file) {
        updateProgress(25, '[Demo Mode] อ่านและแยกโครงสร้าง XML เอกสาร Word...', 1);
        await new Promise(r => setTimeout(r, 1000));

        updateProgress(65, '[Demo Mode] แปลงข้อความตัวอย่าง และคงสไตล์ป้อมปราการสูตรคำนวณ...', 2);
        await new Promise(r => setTimeout(r, 1200));

        updateProgress(90, '[Demo Mode] ประกอบไฟล์กลับเป็นเอกสาร .docx...', 3);
        await new Promise(r => setTimeout(r, 800));

        try {
            const zip = await JSZip.loadAsync(file);
            const docXmlFile = zip.file('word/document.xml');
            if (docXmlFile) {
                let xmlString = await docXmlFile.async('text');
                xmlString = xmlString.replace(/รายงาน/g, 'Report')
                                     .replace(/เอกสาร/g, 'Document')
                                     .replace(/การคำนวณ/g, 'Calculation')
                                     .replace(/โดยที่/g, 'where');
                zip.file('word/document.xml', xmlString);
                translatedFileBlob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
            } else {
                translatedFileBlob = file;
            }
        } catch (e) {
            translatedFileBlob = file;
        }

        translatedFileName = getTranslatedFileName(file.name, targetLang.value);

        finishTranslation();
        showToast('การทดสอบในระบบ Demo Mode สำเร็จเรียบร้อย!', 'success');
    }

    // --- Finish & Download Setup ---
    function finishTranslation() {
        updateProgress(100, 'แปลเอกสารเสร็จสมบูรณ์เรียบร้อยแล้ว!', 3);
        
        setTimeout(() => {
            progressSection.classList.add('hidden');
            downloadSection.classList.remove('hidden');
            translateBtn.disabled = false;
        }, 500);
    }

    downloadBtn.addEventListener('click', () => {
        if (!translatedFileBlob) return;

        const url = URL.createObjectURL(translatedFileBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = translatedFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('ดาวน์โหลดไฟล์เอกสารที่แปลแล้วสำเร็จ!', 'success');
    });

    // --- Helper Functions ---
    function updateProgress(percent, msg, activeStep) {
        progressBar.style.width = `${percent}%`;
        progressPercentage.textContent = `${percent}%`;
        statusMessage.textContent = msg;

        [step1, step2, step3].forEach((s, idx) => {
            const stepNum = idx + 1;
            if (activeStep === 0) {
                s.className = 'step';
                s.innerHTML = '<i data-lucide="alert-circle"></i> ' + getStepLabel(stepNum);
            } else if (stepNum < activeStep) {
                s.className = 'step active';
                s.innerHTML = '<i data-lucide="check-circle-2"></i> ' + getStepLabel(stepNum);
            } else if (stepNum === activeStep) {
                s.className = 'step active';
                s.innerHTML = '<i data-lucide="loader-2" class="spin"></i> ' + getStepLabel(stepNum);
            } else {
                s.className = 'step';
                s.innerHTML = '<i data-lucide="clock"></i> ' + getStepLabel(stepNum);
            }
        });
        lucide.createIcons();
    }

    function getStepLabel(stepNum) {
        if (stepNum === 1) return 'อ่านไฟล์ Word';
        if (stepNum === 2) return 'ส่งแปลผ่าน API';
        return 'ประกอบไฟล์ใหม่';
    }

    function getTranslatedFileName(originalName, targetL) {
        const extIndex = originalName.lastIndexOf('.');
        const baseName = extIndex !== -1 ? originalName.substring(0, extIndex) : originalName;
        const ext = extIndex !== -1 ? originalName.substring(extIndex) : '.docx';
        return `${baseName}_Translated_${targetL}${ext}`;
    }

    function formatBytes(bytes, decimals = 1) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const iconName = type === 'error' ? 'alert-circle' : 'check-circle';
        toast.innerHTML = `<i data-lucide="${iconName}"></i> <span>${message}</span>`;
        
        toastContainer.appendChild(toast);
        lucide.createIcons();

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }
});
