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
    const savedApiKey = localStorage.getItem('docutranslate_apikey') || '6c8b7ad2-fa24-4174-ab2d-4c8af334dd58:fx';
    
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
            apiKeyHint.textContent = 'ใส่ DeepL Auth Key (ลงท้ายด้วย :fx สำหรับแพ็กเกจฟรี)';
            apiKey.placeholder = 'เช่น 6c8b7ad2-fa24-4174-ab2d-4c8af334dd58:fx';
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
                await translateWithVercelServerless(selectedFile, tgt);
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

    // --- Vercel Serverless Function Engine ---
    async function translateWithVercelServerless(file, targetL) {
        updateProgress(35, 'กำลังส่งไฟล์ไปประมวลผลบน Vercel Serverless (ซ่อน API Key)...', 2);

        const preserveFormulas = document.getElementById('preserveFormulas').checked;

        let res;
        try {
            res = await fetch('/api/translate', {
                method: 'POST',
                headers: {
                    'x-target-lang': targetL,
                    'x-preserve-formulas': preserveFormulas ? 'true' : 'false'
                },
                body: file
            });
        } catch (netErr) {
            console.warn('Vercel API Route unavailable, falling back to Client-side DeepL Engine:', netErr);
            const defaultKey = localStorage.getItem('docutranslate_apikey') || '6c8b7ad2-fa24-4174-ab2d-4c8af334dd58:fx';
            await translateWithDeepLOpenXML(file, defaultKey, 'https://api-free.deepl.com/v2', sourceLang.value, targetL);
            return;
        }

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Vercel Server ตอบกลับด้วยรหัสข้อผิดพลาด HTTP ${res.status}`);
        }

        updateProgress(85, 'แปลเอกสารเสร็จเรียบร้อย! กำลังรับไฟล์ผลลัพธ์...', 3);
        translatedFileBlob = await res.blob();
        translatedFileName = getTranslatedFileName(file.name, targetL);
        finishTranslation();
    }

    // --- DeepL API Integration ---
    async function translateWithDeepL(file, key, sourceL, targetL) {
        updateProgress(20, 'กำลังเชื่อมต่อและประมวลผลกับ DeepL API...', 2);
        
        const baseUrl = key.endsWith(':fx') 
            ? 'https://api-free.deepl.com/v2' 
            : 'https://api.deepl.com/v2';

        updateProgress(35, 'กำลังเปิดใช้งาน DeepL Client XML Engine (คงรูปแบบและสูตร 100%)...', 2);
        await translateWithDeepLOpenXML(file, key, baseUrl, sourceL, targetL);
    }

    async function translateWithDeepLOpenXML(file, key, baseUrl, sourceL, targetL) {
        const zip = await JSZip.loadAsync(file);
        const docXmlFile = zip.file('word/document.xml');
        if (!docXmlFile) throw new Error('ไม่พบโครงสร้าง word/document.xml ในไฟล์เอกสารนี้');

        const xmlString = await docXmlFile.async('text');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

        const preserveFormulas = document.getElementById('preserveFormulas').checked;
        const textNodes = [];
        const allWTextNodes = xmlDoc.getElementsByTagName('w:t');

        for (let i = 0; i < allWTextNodes.length; i++) {
            const node = allWTextNodes[i];
            const textContent = node.textContent;
            if (textContent && textContent.trim().length > 0) {
                if (preserveFormulas && isInsideMathNode(node)) {
                    continue;
                }
                textNodes.push(node);
            }
        }

        if (textNodes.length === 0) {
            throw new Error('ไม่พบข้อความภาษาไทยที่ต้องแปลในไฟล์เอกสารนี้');
        }

        updateProgress(50, `พบข้อความ ${textNodes.length} ย่อหน้า กำลังส่งแปลด้วย DeepL API...`, 2);

        const batchSize = 10;
        for (let i = 0; i < textNodes.length; i += batchSize) {
            const batch = textNodes.slice(i, i + batchSize);
            
            const params = new URLSearchParams();
            params.append('auth_key', key);
            params.append('target_lang', targetL.split('-')[0].toUpperCase());
            if (sourceL !== 'AUTO') {
                params.append('source_lang', sourceL.toUpperCase());
            }
            batch.forEach(n => params.append('text', n.textContent));

            let res;
            try {
                res = await fetch(`${baseUrl}/translate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: params
                });
            } catch (netErr) {
                throw new Error('ไม่สามารถเชื่อมต่อกับ DeepL API ได้ (โปรดตรวจสอบอินเทอร์เน็ต)');
            }

            if (!res.ok) {
                if (res.status === 403 || res.status === 401) {
                    throw new Error('DeepL API Key ไม่ถูกต้อง หรือโควตาแปลฟรีของคุณหมดแล้ว');
                }
                throw new Error(`DeepL API ตอบกลับด้วยรหัส HTTP ${res.status}`);
            }

            const data = await res.json();
            if (data.translations && data.translations.length === batch.length) {
                batch.forEach((node, idx) => {
                    if (data.translations[idx]?.text) {
                        node.textContent = data.translations[idx].text;
                    }
                });
            }

            const currentPercent = Math.min(88, 50 + Math.round(((i + batchSize) / textNodes.length) * 35));
            updateProgress(currentPercent, `DeepL แปลแล้ว ${Math.min(i + batchSize, textNodes.length)} / ${textNodes.length} ย่อหน้า...`, 2);
        }

        updateProgress(92, 'กำลังประกอบโครงสร้างเอกสาร Word กลับเป็น .docx...', 3);
        const serializer = new XMLSerializer();
        const newXmlString = serializer.serializeToString(xmlDoc);
        zip.file('word/document.xml', newXmlString);

        translatedFileBlob = await zip.generateAsync({
            type: 'blob',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });
        translatedFileName = getTranslatedFileName(file.name, targetL);
        finishTranslation();
    }

    // --- Client-side JSZip + Gemini API Integration ---
    async function translateWithGemini(file, key, sourceL, targetL) {
        updateProgress(20, 'กำลังอ่านแกะไฟล์ Word XML ด้วย JSZip...', 1);

        const zip = await JSZip.loadAsync(file);
        const docXmlFile = zip.file('word/document.xml');

        if (!docXmlFile) {
            throw new Error('ไม่พบไฟล์โครงสร้าง word/document.xml ในเอกสารนี้');
        }

        const xmlString = await docXmlFile.async('text');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

        const preserveFormulas = document.getElementById('preserveFormulas').checked;
        const textNodes = [];
        const allWTextNodes = xmlDoc.getElementsByTagName('w:t');

        for (let i = 0; i < allWTextNodes.length; i++) {
            const node = allWTextNodes[i];
            const textContent = node.textContent;
            
            if (textContent && textContent.trim().length > 0) {
                if (preserveFormulas && isInsideMathNode(node)) {
                    continue;
                }
                textNodes.push(node);
            }
        }

        if (textNodes.length === 0) {
            throw new Error('ไม่พบข้อความภาษาไทยที่ต้องแปลในไฟล์เอกสารนี้');
        }

        updateProgress(40, `พบข้อความ ${textNodes.length} ย่อหน้า กำลังส่งแปลด้วย Gemini API...`, 2);

        const batchSize = 10;
        for (let i = 0; i < textNodes.length; i += batchSize) {
            const batch = textNodes.slice(i, i + batchSize);
            const textsToTranslate = batch.map(n => n.textContent);

            const prompt = `Translate the following array of Thai strings to ${targetL}. 
Keep any mathematical variables (e.g. x, y, F, m), numbers, equations, and technical symbols intact.
Return ONLY a valid JSON array of translated strings corresponding 1-to-1:
${JSON.stringify(textsToTranslate)}`;

            let res;
            try {
                res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }]
                    })
                });
            } catch (netErr) {
                throw new Error('ไม่สามารถเชื่อมต่อกับ Gemini API ได้');
            }

            if (!res.ok) {
                throw new Error(`Gemini API Key ไม่ถูกต้อง หรือมีข้อผิดพลาด status: ${res.status}`);
            }

            const resData = await res.json();
            const responseText = resData.candidates?.[0]?.content?.parts?.[0]?.text || '';
            
            const jsonMatch = responseText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                try {
                    const translatedArray = JSON.parse(jsonMatch[0]);
                    batch.forEach((node, idx) => {
                        if (translatedArray[idx]) {
                            node.textContent = translatedArray[idx];
                        }
                    });
                } catch (e) {
                    console.warn('JSON parse fallback');
                }
            }

            const currentPercent = Math.min(85, 40 + Math.round(((i + batchSize) / textNodes.length) * 45));
            updateProgress(currentPercent, `แปลแล้ว ${Math.min(i + batchSize, textNodes.length)} / ${textNodes.length} ย่อหน้า...`, 2);
        }

        updateProgress(90, 'กำลังประกอบไฟล์ Word กลับเป็น .docx...', 3);

        const serializer = new XMLSerializer();
        const newXmlString = serializer.serializeToString(xmlDoc);
        zip.file('word/document.xml', newXmlString);

        translatedFileBlob = await zip.generateAsync({ 
            type: 'blob', 
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
        });
        translatedFileName = getTranslatedFileName(file.name, targetL);

        finishTranslation();
    }

    function isInsideMathNode(node) {
        let parent = node.parentNode;
        while (parent) {
            if (parent.tagName === 'm:oMath' || parent.tagName === 'm:oMathPara') {
                return true;
            }
            parent = parent.parentNode;
        }
        return false;
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
            setTimeout(() => toast.remove(), 5000);
        }, 5000);
    }
});
