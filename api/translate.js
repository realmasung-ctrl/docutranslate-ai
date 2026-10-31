// Vercel Serverless Function for Secure DeepL Document & OpenXML Translation
// Path: /api/translate.js

const JSZip = require('jszip');

export const config = {
    api: {
        bodyParser: false, // Disable default body parsing to handle raw file buffer
    },
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Retrieve hidden API Key from Vercel Environment Variables
    const apiKey = process.env.DEEPL_API_KEY || 'ba1e9e02-94a1-40e6-b792-403f8b37baec:fx';
    const targetLang = req.headers['x-target-lang'] || 'EN';
    const preserveFormulas = req.headers['x-preserve-formulas'] !== 'false';

    try {
        // Read raw buffer from request
        const chunks = [];
        for await (const chunk of req) {
            chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);

        if (!buffer || buffer.length === 0) {
            return res.status(400).json({ error: 'ไม่พบไฟล์เอกสารที่อัปโหลด' });
        }

        // Process OpenXML with JSZip + DeepL Translate API securely on Vercel Server
        const zip = await JSZip.loadAsync(buffer);
        const docXmlFile = zip.file('word/document.xml');

        if (!docXmlFile) {
            return res.status(400).json({ error: 'ไม่พบโครงสร้าง word/document.xml ในไฟล์เอกสารนี้' });
        }

        const xmlString = await docXmlFile.async('text');
        
        // Simple XML text parsing for Vercel Node environment
        const textRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
        const textMatches = [];
        let match;

        while ((match = textRegex.exec(xmlString)) !== null) {
            const fullMatch = match[0];
            const textContent = match[1];

            if (textContent && textContent.trim().length > 0) {
                // If preserve formulas, check if inside <m:oMath>
                const matchIndex = match.index;
                const substringBefore = xmlString.substring(Math.max(0, matchIndex - 300), matchIndex);
                const isInsideMath = substringBefore.includes('<m:oMath>') && !substringBefore.includes('</m:oMath>');

                if (!preserveFormulas || !isInsideMath) {
                    textMatches.push({ fullMatch, textContent });
                }
            }
        }

        if (textMatches.length === 0) {
            return res.status(400).json({ error: 'ไม่พบข้อความที่ต้องแปลในเอกสาร' });
        }

        // DeepL API Base URL
        const baseUrl = apiKey.endsWith(':fx') 
            ? 'https://api-free.deepl.com/v2' 
            : 'https://api.deepl.com/v2';

        // Batch translate with DeepL API from Vercel Server (Zero CORS restrictions)
        const batchSize = 15;
        let updatedXmlString = xmlString;

        for (let i = 0; i < textMatches.length; i += batchSize) {
            const batch = textMatches.slice(i, i + batchSize);
            
            const params = new URLSearchParams();
            params.append('auth_key', apiKey);
            params.append('target_lang', targetLang.split('-')[0].toUpperCase());
            params.append('source_lang', 'TH');
            batch.forEach(item => params.append('text', item.textContent));

            const deeplRes = await fetch(`${baseUrl}/translate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params
            });

            if (!deeplRes.ok) {
                const errText = await deeplRes.text();
                throw new Error(`DeepL API ตอบกลับข้อผิดพลาด HTTP ${deeplRes.status}: ${errText}`);
            }

            const data = await deeplRes.json();

            if (data.translations && data.translations.length === batch.length) {
                batch.forEach((item, idx) => {
                    const translatedText = data.translations[idx]?.text;
                    if (translatedText) {
                        const newTag = item.fullMatch.replace(item.textContent, escapeXml(translatedText));
                        updatedXmlString = updatedXmlString.replace(item.fullMatch, newTag);
                    }
                });
            }
        }

        // Re-pack translated XML back into .docx Zip
        zip.file('word/document.xml', updatedXmlString);
        const outputBuffer = await zip.generateAsync({ type: 'nodebuffer' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', 'attachment; filename="translated.docx"');
        return res.status(200).send(outputBuffer);

    } catch (err) {
        console.error('Vercel Translation Error:', err);
        return res.status(500).json({ error: err.message || 'เกิดข้อผิดพลาดในการประมวลผลบน Vercel Server' });
    }
}

function escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
    });
}
