# 📄 DocuTranslate AI - ระบบแปลเอกสาร Word คงรูปแบบ & ซ่อน API Key ปลอดภัย 100%

แอปพลิเคชันแปลภาษาเอกสาร Microsoft Word (.docx) จากภาษาไทยเป็นภาษาอังกฤษ โดยคงสไตล์ ตาราง รูปภาพ และ **ป้อมปราการสูตรคำนวณ (Office Math / OMML)** ไว้โดยไม่ทำลายรูปแบบเดิม

---

## 🚀 วิธีนำขึ้น Vercel ออนไลน์ ให้เพื่อนใช้งาน (ซ่อน API Key ปลอดภัย 100%)

ระบบนี้ถูกออกแบบให้มี **Vercel Serverless Function (`api/translate.js`)** ทำหน้าที่เป็นตัวกลางรับไฟล์ไปแปลกับ DeepL โดย **ซ่อน API Key ไว้บน Vercel Server** ทำให้เพื่อนหรือผู้ใช้ทั่วไปมองไม่เห็น API Key ของคุณเลย 100%

### ขั้นตอนการอัปโหลดขึ้น Vercel (ใช้เวลา 2 นาที):

1. **เข้าสู่ระบบ Vercel**:
   - เปิดเว็บไซต์ [Vercel.com](https://vercel.com/) แล้ว Log in
2. **สร้าง Project ใหม่**:
   - กดปุ่ม **"Add New..."** $\rightarrow$ **"Project"**
   - หรือลากโฟลเดอร์ `Test` นี้ขึ้นไปบน Vercel (หากใช้ Vercel CLI เพียงพิมพ์ `vercel` ใน Terminal)
3. **ตั้งค่า API Key ซ่อนไว้ใน Environment Variable**:
   - ในหน้าการตั้งค่าก่อนกด Deploy ให้ไปที่หัวข้อ **Environment Variables**
   - **Name**: `DEEPL_API_KEY`
   - **Value**: `<DeepL Auth Key ของคุณ ลงท้ายด้วย :fx ถ้าเป็นแพ็กเกจฟรี>`
   - กด **Add** แล้วกด **Deploy**
   - ⚠️ ห้ามใส่คีย์ลงในโค้ดหรือไฟล์ README ใดๆ ให้ใส่ใน Environment Variable ของ Vercel เท่านั้น (ถ้าเคยเผลอใส่แล้ว ให้ลบคีย์เดิมที่ DeepL และสร้างใหม่)
4. **เสร็จสิ้น!**:
   - คุณจะได้ลิงก์เว็บไซต์ออนไลน์จริง (เช่น `https://docutranslate-ai.vercel.app`) สามารถส่งให้เพื่อนลากไฟล์ Word มาแปลได้ทันที โดยที่เพื่อนไม่ต้องใส่ API Key ใดๆ เลย!

---

## 📁 โครงสร้างโปรเจกต์

- `index.html` : หน้า UI หลัก (Dark Glassmorphism)
- `style.css` : สไตล์การจัดวางและ Grid กันการบีบอัด
- `app.js` : ตัวจัดการหน้าบ้าน เลือกเครื่องมือแปล (Vercel / DeepL Key เอง / Gemini / Demo)
- `docx-core.js` : แกะและประกอบ .docx แปลทีละย่อหน้า ครอบคลุมเนื้อหา, header/footer, เชิงอรรถ/ท้ายเรื่อง, คอมเมนต์, SmartArt/กราฟ และคงสูตร (OMML)
- `api/translate.js` : Vercel Serverless Function รับ "ข้อความ" เป็น JSON แล้วส่งต่อให้ DeepL โดยซ่อน API Key (ไม่รับไฟล์ จึงไม่ติดเพดานขนาด 4.5 MB ของ Vercel)
- `vercel.json` : ตั้งเวลาสูงสุดของ Function
- `package.json` / `test/` : ชุดทดสอบ `npm test` (ใช้ Node 20+)

## 🔒 หมายเหตุด้านความปลอดภัย

- endpoint `/api/translate` เปิดให้ทุกคนที่รู้ URL เรียกได้ และจะใช้โควตา DeepL ของคุณ ถ้าจะเปิดให้คนทั่วไปใช้ ควรตั้ง usage limit ใน DeepL และพิจารณาเพิ่ม rate limit หรือรหัสผ่านหน้าเว็บ
- โหมด "DeepL (ใส่ Key เอง)" ส่งคีย์ของผู้ใช้ผ่าน `/api/translate` ไปยัง DeepL โดยไม่เก็บ เพราะ DeepL ไม่อนุญาตให้เบราว์เซอร์เรียกตรง (CORS)
