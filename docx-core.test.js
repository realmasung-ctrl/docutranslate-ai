const test = require('node:test');
const assert = require('node:assert');
const JSZip = require('jszip');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');
const DocxCore = require('../docx-core.js');

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
    'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" ' +
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';
const wrap = (tag, body) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:${tag} ${NS}>${body}</w:${tag}>`;
const run = (text, rPr = '') => `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}<w:t>${text}</w:t></w:r>`;

async function makeZip(parts) {
    const zip = new JSZip();
    for (const [name, xml] of Object.entries(parts)) zip.file(name, xml);
    return zip;
}

// ตัวแปลปลอม: ห่อข้อความด้วย EN[...] และคงแท็ก <x i="N"> ตามที่ DeepL ทำ
function fakeTranslator(log) {
    return async (texts, { xml }) => {
        log.push({ texts, xml });
        return texts.map(t => xml
            ? t.replace(/(<x i="\d+">)([^<]*)(<\/x>)/g, '$1EN[$2]$3').replace(/^([^<][^<]*)$/, 'EN[$1]')
            : `EN[${t}]`);
    };
}

const base = { DOMParser, XMLSerializer };
const text = async (zip, name) => zip.file(name).async('string');

test('รวมหลาย run เป็นประโยคเดียว และส่งแปลทีละย่อหน้า', async () => {
    const zip = await makeZip({
        'word/document.xml': wrap('document', `<w:body><w:p>${run('แรงที่')}${run('กระทำ')}${run('ต่อวัตถุ')}</w:p></w:body>`)
    });
    const log = [];
    await DocxCore.translateDocx(zip, { ...base, translate: fakeTranslator(log), preserveFormatting: false });
    assert.deepStrictEqual(log[0].texts, ['แรงที่กระทำต่อวัตถุ']);
    const out = await text(zip, 'word/document.xml');
    assert.match(out, /EN\[แรงที่กระทำต่อวัตถุ\]/);
    assert.match(out, /xml:space="preserve"/);
    assert.match(out, /^<\?xml/);
});

test('คงสไตล์: ตัวหนากลางประโยคแจกกลับเข้า run เดิม', async () => {
    const bold = '<w:b/>';
    const zip = await makeZip({
        'word/document.xml': wrap('document', `<w:body><w:p>${run('ค่า ')}${run('สำคัญ', bold)}${run(' มาก')}</w:p></w:body>`)
    });
    const log = [];
    const stats = await DocxCore.translateDocx(zip, { ...base, translate: fakeTranslator(log) });
    assert.strictEqual(stats.tagged, 1);
    assert.strictEqual(log[0].xml, true);
    assert.match(log[0].texts[0], /<x i="0">ค่า <\/x><x i="1">สำคัญ<\/x><x i="2"> มาก<\/x>/);
    const out = await text(zip, 'word/document.xml');
    // ตัวหนายังอยู่กับข้อความกลาง
    assert.match(out, /<w:b\/><\/w:rPr><w:t[^>]*>EN\[สำคัญ\]<\/w:t>/);
});

test('แท็กไม่ครบ: ถอยไปใส่ทั้งประโยคใน run แรกและลอกแท็กออก', async () => {
    const zip = await makeZip({
        'word/document.xml': wrap('document', `<w:body><w:p>${run('ก ')}${run('ข', '<w:i/>')}</w:p></w:body>`)
    });
    const broken = async texts => texts.map(() => 'hello <x i="0">there</x>'); // หายแท็ก 1
    const stats = await DocxCore.translateDocx(zip, { ...base, translate: broken });
    assert.strictEqual(stats.merged, 1);
    const out = await text(zip, 'word/document.xml');
    assert.match(out, /hello there/);
    assert.doesNotMatch(out, /&lt;x/);
});

test('สูตร m:oMath ไม่ถูกแตะ และตัดประโยคออกเป็นสองท่อน', async () => {
    const math = '<m:oMath><m:r><m:t>E=mc2</m:t></m:r></m:oMath>';
    const zip = await makeZip({
        'word/document.xml': wrap('document', `<w:body><w:p>${run('พลังงาน')}${math}${run('คือมวลคูณ')}</w:p></w:body>`)
    });
    const log = [];
    await DocxCore.translateDocx(zip, { ...base, translate: fakeTranslator(log), preserveFormatting: false });
    assert.deepStrictEqual(log[0].texts, ['พลังงาน', 'คือมวลคูณ']);
    const out = await text(zip, 'word/document.xml');
    assert.match(out, /<m:t>E=mc2<\/m:t>/);
});

test('แปล header, footer, footnotes, comments และ SmartArt ด้วย', async () => {
    const zip = await makeZip({
        'word/document.xml': wrap('document', `<w:body><w:p>${run('เนื้อหา')}</w:p></w:body>`),
        'word/header1.xml': wrap('hdr', `<w:p>${run('หัวกระดาษ')}</w:p>`),
        'word/footer2.xml': wrap('ftr', `<w:p>${run('ท้ายกระดาษ')}</w:p>`),
        'word/footnotes.xml': wrap('footnotes', `<w:footnote w:id="1"><w:p>${run('เชิงอรรถ')}</w:p></w:footnote>`),
        'word/comments.xml': wrap('comments', `<w:comment w:id="0"><w:p>${run('ความเห็น')}</w:p></w:comment>`),
        'word/diagrams/data1.xml': wrap('dataModel', `<a:p><a:r><a:rPr/><a:t>แผนภาพ</a:t></a:r></a:p>`)
    });
    const stats = await DocxCore.translateDocx(zip, { ...base, translate: fakeTranslator([]), preserveFormatting: false });
    assert.strictEqual(stats.parts, 6);
    for (const n of ['word/header1.xml', 'word/footer2.xml', 'word/footnotes.xml', 'word/comments.xml', 'word/diagrams/data1.xml']) {
        assert.match(await text(zip, n), /EN\[/, n);
    }
    // a:t ต้องไม่ถูกใส่ xml:space
    assert.doesNotMatch(await text(zip, 'word/diagrams/data1.xml'), /xml:space/);
});

test('กล่องข้อความซ้อนใน run ของย่อหน้าอื่น แปลแยกกัน', async () => {
    const inner = `<w:txbxContent><w:p>${run('ในกล่อง')}</w:p></w:txbxContent>`;
    const outer = `<w:p>${run('ข้างนอก')}<w:r><w:pict>${inner}</w:pict></w:r></w:p>`;
    const zip = await makeZip({ 'word/document.xml': wrap('document', `<w:body>${outer}</w:body>`) });
    const log = [];
    await DocxCore.translateDocx(zip, { ...base, translate: fakeTranslator(log), preserveFormatting: false });
    assert.deepStrictEqual(log.flatMap(l => l.texts).sort(), ['ข้างนอก', 'ในกล่อง'].sort());
});

test('ช่องว่างหน้า/หลังถูกคงไว้ และข้อความที่ซ้ำกันส่งแปลครั้งเดียว', async () => {
    const zip = await makeZip({
        'word/document.xml': wrap('document', `<w:body><w:p>${run('  สวัสดี  ')}</w:p><w:p>${run('สวัสดี')}</w:p><w:p>${run('123')}</w:p></w:body>`)
    });
    const log = [];
    const stats = await DocxCore.translateDocx(zip, { ...base, translate: fakeTranslator(log), preserveFormatting: false });
    assert.strictEqual(stats.segments, 2);   // "123" ไม่มีตัวอักษร จึงข้าม
    assert.deepStrictEqual(log[0].texts, ['สวัสดี']);
    assert.match(await text(zip, 'word/document.xml'), /<w:t xml:space="preserve">  EN\[สวัสดี\]  <\/w:t>/);
});

test('ตัวแปลตอบจำนวนไม่ครบ ต้อง error ไม่ใช่ข้ามเงียบ', async () => {
    const zip = await makeZip({ 'word/document.xml': wrap('document', `<w:body><w:p>${run('ก')}</w:p></w:body>`) });
    await assert.rejects(DocxCore.translateDocx(zip, { ...base, translate: async () => [] }), /จำนวนข้อความ/);
});

test('ไม่มีข้อความให้แปล / ไม่ใช่ docx', async () => {
    const empty = await makeZip({ 'word/document.xml': wrap('document', '<w:body><w:p/></w:body>') });
    await assert.rejects(DocxCore.translateDocx(empty, { ...base, translate: async t => t }), /ไม่พบข้อความ/);
    const bad = await makeZip({ 'foo.txt': 'x' });
    await assert.rejects(DocxCore.translateDocx(bad, { ...base, translate: async t => t }), /document\.xml/);
});
