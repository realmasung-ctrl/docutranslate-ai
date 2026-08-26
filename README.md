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
   - **Value**: `6c8b7ad2-fa24-4174-ab2d-4c8af334dd58:fx`
   - กด **Add** แล้วกด **Deploy**
4. **เสร็จสิ้น!**:
   - คุณจะได้ลิงก์เว็บไซต์ออนไลน์จริง (เช่น `https://docutranslate-ai.vercel.app`) สามารถส่งให้เพื่อนลากไฟล์ Word มาแปลได้ทันที โดยที่เพื่อนไม่ต้องใส่ API Key ใดๆ เลย!

---

## 📁 โครงสร้างโปรเจกต์

- `index.html` : หน้า UI หลัก (Dark Glassmorphism)
- `style.css` : สไตล์การจัดวางและ Grid กันการบีบอัด
- `app.js` : ตัวจัดการหน้าบ้าน เชื่อมต่อ Vercel API และระบบสำรอง
- `api/translate.js` : Vercel Serverless Function ประมวลผลเอกสารและซ่อน API Key
- `package.json` : ไฟล์ระบุ Dependency (`jszip`) สำหรับ Vercel
