/**
 * docx-core.js — แปลข้อความใน .docx ทีละย่อหน้า โดยคงโครงสร้าง OpenXML เดิม
 *
 * ใช้ได้ทั้งในเบราว์เซอร์ (window.DocxCore) และ Node (require) เพื่อให้ทดสอบได้
 *
 * หลักการ
 *  - รวมข้อความของ <w:r> ที่ติดกันในย่อหน้าเดียวกันเป็น "ประโยคเดียว" ก่อนส่งแปล
 *    (Word มักแตกประโยคเป็นหลาย run) แล้วใส่ผลลัพธ์กลับ
 *  - สูตร (m:oMath) ไม่ถูกแปลและทำหน้าที่ตัดประโยค
 *  - ถ้าเปิด preserveFormatting และย่อหน้ามีหลายสไตล์ (เช่น ตัวหนากลางประโยค)
 *    จะห่อแต่ละช่วงสไตล์ด้วย <x i="N">…</x> ให้ตัวแปลคงแท็กไว้ แล้วแจกข้อความกลับเข้า run เดิม
 *    ถ้าแท็กกลับมาไม่ครบ จะถอยไปใส่ทั้งประโยคใน run แรก
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.DocxCore = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // ส่วนของไฟล์ .docx ที่มีข้อความ และชื่อแท็กที่ใช้ในแต่ละชนิด
    const WORD = { p: 'w:p', r: 'w:r', t: 'w:t', rPr: 'w:rPr', xmlSpace: true };
    const DRAWING = { p: 'a:p', r: 'a:r', t: 'a:t', rPr: 'a:rPr', xmlSpace: false };

    const PART_RULES = [
        { re: /^word\/document\.xml$/, cfg: WORD },
        { re: /^word\/header\d*\.xml$/, cfg: WORD },
        { re: /^word\/footer\d*\.xml$/, cfg: WORD },
        { re: /^word\/footnotes\.xml$/, cfg: WORD },
        { re: /^word\/endnotes\.xml$/, cfg: WORD },
        { re: /^word\/comments\.xml$/, cfg: WORD },
        { re: /^word\/diagrams\/(data|drawing)\d*\.xml$/, cfg: DRAWING },
        { re: /^word\/charts\/chart\d+\.xml$/, cfg: DRAWING }
    ];

    const MATH_TAGS = new Set(['m:oMath', 'm:oMathPara']);
    // ลูกของ run ที่ไม่ทำให้ประโยคขาด
    const RUN_IGNORABLE = new Set(['w:rPr', 'a:rPr', 'w:lastRenderedPageBreak']);

    const DEFAULTS = {
        preserveFormulas: true,
        preserveFormatting: true,
        maxBatchTexts: 40,
        maxBatchChars: 20000,
        concurrency: 3
    };

    // ---------- ตัวช่วย XML ----------
    function escapeXml(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function unescapeXml(s) {
        return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
    }

    function elementChildren(node) {
        const out = [];
        for (let c = node.firstChild; c; c = c.nextSibling) {
            if (c.nodeType === 1) out.push(c);
        }
        return out;
    }

    function setText(node, text) {
        while (node.firstChild) node.removeChild(node.firstChild);
        if (text) node.appendChild(node.ownerDocument.createTextNode(text));
    }

    function hasLetter(s) {
        return /\p{L}/u.test(s);
    }

    // ---------- สร้าง "ประโยค" (segment) จากย่อหน้า ----------
    /**
     * คืนรายการ segment ของย่อหน้า แต่ละ segment = { groups: [{ runs:[{ts:[w:t…]}], text }] }
     * groups = run ติดกันที่สไตล์เหมือนกัน
     */
    function collectSegments(paragraph, cfg, opts, serializer) {
        const segments = [];
        let current = null; // { container, runs: [{ts, sig}] }

        function flush() {
            if (current && current.runs.length) segments.push(current);
            current = null;
        }

        function signature(run) {
            const rPr = elementChildren(run).find(c => c.tagName === cfg.rPr);
            return rPr ? serializer.serializeToString(rPr) : '';
        }

        function handleRun(run) {
            const kids = elementChildren(run);
            const ts = kids.filter(k => k.tagName === cfg.t);
            const others = kids.filter(k => k.tagName !== cfg.t && !RUN_IGNORABLE.has(k.tagName));

            if (ts.length === 0) {
                if (others.length) flush();
                return;
            }

            if (others.length) {
                // run ที่มี tab/br/รูป ฯลฯ ปนอยู่ ไม่รวมกับ run อื่น แต่ละ <w:t> แปลแยก
                flush();
                ts.forEach(t => {
                    segments.push({ container: run.parentNode, runs: [{ ts: [t], sig: signature(run) }] });
                });
                return;
            }

            if (current && current.container !== run.parentNode) flush();
            if (!current) current = { container: run.parentNode, runs: [] };
            current.runs.push({ ts, sig: signature(run) });
        }

        function walk(node) {
            for (const child of elementChildren(node)) {
                const tag = child.tagName;
                if (tag === cfg.p) continue; // ย่อหน้าซ้อน (กล่องข้อความ) มีรอบของตัวเอง
                if (opts.preserveFormulas && MATH_TAGS.has(tag)) { flush(); continue; }
                if (tag === cfg.r) { handleRun(child); continue; }
                walk(child); // hyperlink, ins, sdt, smartTag ฯลฯ
            }
        }

        walk(paragraph);
        flush();

        // แปลงเป็น groups และตัด segment ที่ไม่มีตัวอักษร (ตัวเลข/เว้นวรรคล้วน)
        const result = [];
        for (const seg of segments) {
            const groups = [];
            for (const run of seg.runs) {
                const text = run.ts.map(t => t.textContent).join('');
                const last = groups[groups.length - 1];
                if (last && last.sig === run.sig) {
                    last.runs.push(run);
                    last.text += text;
                } else {
                    groups.push({ sig: run.sig, runs: [run], text });
                }
            }
            const full = groups.map(g => g.text).join('');
            if (hasLetter(full)) result.push({ groups, full });
        }
        return result;
    }

    // ---------- สร้าง payload ส่งแปล และแกะผลลัพธ์ ----------
    function buildPayload(seg, preserveFormatting) {
        if (!preserveFormatting) return seg.full.trim();
        const lead = seg.full.match(/^\s*/)[0].length;
        const trail = seg.full.match(/\s*$/)[0].length;
        // ตัดช่องว่างหัว/ท้ายของทั้งประโยคออก (ใส่คืนตอนเขียนกลับ)
        const texts = seg.groups.map(g => g.text);
        texts[0] = texts[0].slice(Math.min(lead, texts[0].length));
        const li = texts.length - 1;
        texts[li] = texts[li].slice(0, texts[li].length - Math.min(trail, texts[li].length));

        if (seg.groups.length === 1) return escapeXml(texts[0]);
        return texts.map((t, i) => `<x i="${i}">${escapeXml(t)}</x>`).join('');
    }

    /** คืน array ข้อความต่อ group หรือ null ถ้าแท็กไม่ครบ */
    function parseTagged(translated, groupCount) {
        const re = /<x i="(\d+)">([\s\S]*?)<\/x>/g;
        const out = new Array(groupCount).fill(null);
        let m;
        let rest = translated;
        while ((m = re.exec(translated)) !== null) {
            const i = Number(m[1]);
            if (i >= groupCount || out[i] !== null) return null;
            out[i] = unescapeXml(m[2]);
            rest = rest.replace(m[0], '');
        }
        if (out.some(v => v === null)) return null;
        if (rest.trim().length > 0) return null; // มีข้อความหลุดนอกแท็ก
        return out;
    }

    function applySegment(seg, translated, opts, cfg) {
        const lead = seg.full.match(/^\s*/)[0];
        const trail = seg.full.match(/\s*$/)[0];
        const allRuns = seg.groups.flatMap(g => g.runs);

        function writeNode(t, text) {
            setText(t, text);
            if (cfg.xmlSpace && text) t.setAttribute('xml:space', 'preserve');
        }
        function blankRuns(runs) {
            runs.forEach(r => r.ts.forEach(t => setText(t, '')));
        }

        let perGroup = null;
        if (opts.preserveFormatting && seg.groups.length > 1) {
            perGroup = parseTagged(translated, seg.groups.length);
        }

        if (perGroup) {
            perGroup[0] = lead + perGroup[0].replace(/^\s+/, '');
            const li = perGroup.length - 1;
            perGroup[li] = perGroup[li].replace(/\s+$/, '') + trail;
            seg.groups.forEach((g, gi) => {
                blankRuns(g.runs);
                writeNode(g.runs[0].ts[0], perGroup[gi]);
            });
            return 'tagged';
        }

        // ใส่ทั้งประโยคใน run แรก
        let text = translated;
        if (opts.preserveFormatting) {
            // ถ้าตอบกลับมีแท็ก <x> (แต่แจกไม่ได้) ให้ลอกแท็กออก
            text = unescapeXml(text.replace(/<\/?x(?: i="\d+")?>/g, ''));
        }
        text = lead + text.trim() + trail;
        blankRuns(allRuns);
        writeNode(allRuns[0].ts[0], text);
        return seg.groups.length > 1 ? 'merged' : 'single';
    }

    // ---------- แบ่ง batch และรันขนาน ----------
    function makeBatches(items, maxTexts, maxChars) {
        const batches = [];
        let cur = [];
        let chars = 0;
        for (const it of items) {
            if (cur.length && (cur.length >= maxTexts || chars + it.text.length > maxChars)) {
                batches.push(cur);
                cur = [];
                chars = 0;
            }
            cur.push(it);
            chars += it.text.length;
        }
        if (cur.length) batches.push(cur);
        return batches;
    }

    async function runPool(tasks, concurrency) {
        let next = 0;
        async function worker() {
            while (next < tasks.length) {
                const i = next++;
                await tasks[i]();
            }
        }
        const n = Math.max(1, Math.min(concurrency, tasks.length));
        await Promise.all(Array.from({ length: n }, worker));
    }

    // ---------- ฟังก์ชันหลัก ----------
    /**
     * @param {JSZip} zip  ไฟล์ docx ที่โหลดด้วย JSZip แล้ว (จะถูกแก้ในที่)
     * @param {object} options
     *   translate(texts, { xml }) => Promise<string[]>   ตัวแปล (ต้องคืนจำนวนเท่าเดิม)
     *   DOMParser, XMLSerializer  (ค่าเริ่มต้น: ของเบราว์เซอร์)
     *   preserveFormulas, preserveFormatting, onProgress({phase, done, total})
     */
    async function translateDocx(zip, options) {
        const opts = Object.assign({}, DEFAULTS, options);
        const DP = opts.DOMParser || (typeof DOMParser !== 'undefined' ? DOMParser : null);
        const XS = opts.XMLSerializer || (typeof XMLSerializer !== 'undefined' ? XMLSerializer : null);
        if (!DP || !XS) throw new Error('ไม่พบ DOMParser/XMLSerializer');
        if (typeof opts.translate !== 'function') throw new Error('ต้องระบุฟังก์ชัน translate');
        const progress = opts.onProgress || (() => {});

        if (!zip.file('word/document.xml')) {
            throw new Error('ไม่พบโครงสร้าง word/document.xml ในไฟล์เอกสารนี้ (ไม่ใช่ไฟล์ .docx ที่ถูกต้อง)');
        }

        const serializer = new XS();
        const parser = new DP();
        const names = Object.keys(zip.files).filter(n => !zip.files[n].dir);

        // 1) สแกนทุกส่วนที่มีข้อความ
        const parts = [];
        progress({ phase: 'scan', done: 0, total: names.length });
        for (const name of names) {
            const rule = PART_RULES.find(r => r.re.test(name));
            if (!rule) continue;
            const xml = await zip.file(name).async('string');
            const doc = parser.parseFromString(xml, 'text/xml');
            if (doc.getElementsByTagName('parsererror').length) {
                throw new Error(`อ่านโครงสร้าง XML ของ ${name} ไม่ได้ (ไฟล์อาจเสียหาย)`);
            }
            const segments = [];
            const paragraphs = doc.getElementsByTagName(rule.cfg.p);
            for (let i = 0; i < paragraphs.length; i++) {
                collectSegments(paragraphs[i], rule.cfg, opts, serializer).forEach(s => segments.push(s));
            }
            parts.push({ name, xml, doc, cfg: rule.cfg, segments });
        }

        const allSegments = parts.flatMap(p => p.segments);
        if (allSegments.length === 0) {
            throw new Error('ไม่พบข้อความที่ต้องแปลในไฟล์เอกสารนี้');
        }

        // 2) ส่งแปลเฉพาะข้อความที่ไม่ซ้ำกัน
        const unique = new Map(); // payload -> translated
        allSegments.forEach(seg => {
            seg.payload = buildPayload(seg, opts.preserveFormatting);
            if (!unique.has(seg.payload)) unique.set(seg.payload, null);
        });
        const items = Array.from(unique.keys()).map(text => ({ text }));
        const batches = makeBatches(items, opts.maxBatchTexts, opts.maxBatchChars);

        let done = 0;
        progress({ phase: 'translate', done, total: items.length });
        const tasks = batches.map(batch => async () => {
            const out = await opts.translate(batch.map(b => b.text), { xml: !!opts.preserveFormatting });
            if (!Array.isArray(out) || out.length !== batch.length) {
                throw new Error('ตัวแปลตอบกลับจำนวนข้อความไม่ตรงกับที่ส่งไป');
            }
            batch.forEach((b, i) => unique.set(b.text, out[i]));
            done += batch.length;
            progress({ phase: 'translate', done, total: items.length });
        });
        await runPool(tasks, opts.concurrency);

        // 3) เขียนกลับ
        const stats = { parts: parts.filter(p => p.segments.length).length, segments: allSegments.length,
            unique: items.length, tagged: 0, merged: 0, single: 0 };
        progress({ phase: 'write', done: 0, total: parts.length });
        for (const part of parts) {
            if (!part.segments.length) continue;
            for (const seg of part.segments) {
                const translated = unique.get(seg.payload);
                if (typeof translated !== 'string' || translated.length === 0) continue; // เก็บต้นฉบับไว้
                stats[applySegment(seg, translated, opts, part.cfg)]++;
            }
            let out = serializer.serializeToString(part.doc);
            const decl = part.xml.match(/^﻿?<\?xml[^>]*\?>\s*/);
            if (decl && !/^<\?xml/.test(out)) out = decl[0].replace(/^﻿/, '') + out;
            zip.file(part.name, out);
        }
        progress({ phase: 'write', done: parts.length, total: parts.length });
        return stats;
    }

    return { translateDocx, escapeXml, unescapeXml, parseTagged, PART_RULES };
});
