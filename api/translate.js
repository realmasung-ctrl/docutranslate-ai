// Vercel Serverless Function: ตัวกลางส่งข้อความไปแปลกับ DeepL โดยซ่อน API Key ไว้ฝั่ง server
// Path: /api/translate
//
// หน้าเว็บ (app.js + docx-core.js) แกะไฟล์ .docx ในเบราว์เซอร์ แล้วส่งมาเฉพาะ "ข้อความ" เป็น JSON
// จึงไม่ติดเพดาน request body ของ Vercel (~4.5 MB) แม้ไฟล์ Word จะมีรูปเยอะ
//
// ตั้งค่า Environment Variable บน Vercel:  DEEPL_API_KEY = <คีย์ของคุณ>
// (ไม่มีค่าเริ่มต้นในโค้ด ห้ามใส่คีย์ลงในไฟล์นี้)

const MAX_TEXTS = 50;          // DeepL รับได้ไม่เกิน 50 ข้อความต่อ request
const MAX_TOTAL_CHARS = 100000;

const TARGET_RE = /^[A-Za-z]{2}(-[A-Za-z]{2,4})?$/;
const SOURCE_RE = /^[A-Za-z]{2}$/;

function sendError(res, status, message, extra) {
    if (extra && extra.retryAfter) res.setHeader('Retry-After', String(extra.retryAfter));
    return res.status(status).json({ error: message });
}

module.exports = async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return sendError(res, 405, 'Method Not Allowed');
    }

    // คีย์ของเซิร์ฟเวอร์ หรือคีย์ที่ผู้ใช้ส่งมาเอง (โหมด "ใส่ Key เอง") — ไม่บันทึก ไม่ log
    const userKey = (req.headers['x-user-api-key'] || '').toString().trim();
    const apiKey = userKey || process.env.DEEPL_API_KEY;
    if (!apiKey) {
        return sendError(res, 500, 'เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า DEEPL_API_KEY (ตั้งใน Vercel → Settings → Environment Variables)');
    }

    // ตรวจข้อมูลที่ส่งมา
    const body = req.body && typeof req.body === 'object' ? req.body : null;
    if (!body) return sendError(res, 400, 'รูปแบบคำขอไม่ถูกต้อง (ต้องเป็น JSON)');

    const { texts, targetLang, sourceLang, xml } = body;
    if (!Array.isArray(texts) || texts.length === 0 || texts.length > MAX_TEXTS ||
        !texts.every(t => typeof t === 'string')) {
        return sendError(res, 400, `ต้องส่ง texts เป็น array ของข้อความ 1–${MAX_TEXTS} รายการ`);
    }
    const totalChars = texts.reduce((n, t) => n + t.length, 0);
    if (totalChars > MAX_TOTAL_CHARS) {
        return sendError(res, 413, 'ข้อความต่อคำขอยาวเกินไป');
    }
    if (typeof targetLang !== 'string' || !TARGET_RE.test(targetLang)) {
        return sendError(res, 400, 'ภาษาปลายทางไม่ถูกต้อง');
    }

    const payload = { text: texts, target_lang: targetLang.toUpperCase() };
    if (typeof sourceLang === 'string' && SOURCE_RE.test(sourceLang)) {
        payload.source_lang = sourceLang.toUpperCase();
    }
    if (xml) {
        // ข้อความถูกห่อด้วย <x i="N">…</x> เพื่อให้คงตำแหน่งสไตล์ (ตัวหนา/สี) ไว้
        payload.tag_handling = 'xml';
        payload.outline_detection = false;
        payload.non_splitting_tags = ['x'];
    }

    const baseUrl = apiKey.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';

    let deeplRes;
    try {
        deeplRes = await fetch(`${baseUrl}/v2/translate`, {
            method: 'POST',
            headers: {
                'Authorization': `DeepL-Auth-Key ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
    } catch (err) {
        console.error('DeepL network error:', err && err.message);
        return sendError(res, 502, 'เซิร์ฟเวอร์เชื่อมต่อ DeepL ไม่สำเร็จ');
    }

    if (!deeplRes.ok) {
        console.error('DeepL error status:', deeplRes.status);
        if (deeplRes.status === 403 || deeplRes.status === 401) {
            return sendError(res, 502, 'DeepL API Key ไม่ถูกต้องหรือถูกยกเลิก');
        }
        if (deeplRes.status === 456) {
            return sendError(res, 502, 'โควตาการแปลของ DeepL หมดแล้ว');
        }
        if (deeplRes.status === 429) {
            return sendError(res, 429, 'DeepL รับคำขอถี่เกินไป กรุณารอสักครู่', { retryAfter: 2 });
        }
        return sendError(res, 502, `DeepL ตอบกลับด้วยรหัส HTTP ${deeplRes.status}`);
    }

    const data = await deeplRes.json().catch(() => null);
    if (!data || !Array.isArray(data.translations) || data.translations.length !== texts.length) {
        return sendError(res, 502, 'DeepL ตอบกลับข้อมูลไม่ครบ');
    }

    return res.status(200).json({ translations: data.translations.map(t => t.text) });
};
