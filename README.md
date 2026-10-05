# FISHGROW Web Application

ระบบต้นแบบจัดการธุรกิจอาหารปลากะพงขาว FISHGROW โดยนำปลาหมอคางดำมาเพิ่มมูลค่า

ฟังก์ชัน: Dashboard, สินค้า, วัตถุดิบ, สูตรอาหาร, คำนวณต้นทุน, การผลิต, สต็อก, ลูกค้า, คำสั่งซื้อ, การเงิน และรายงาน

สูตรหลัก: ต้นทุนวัตถุดิบ = ปริมาณ × ราคา/หน่วย; ต้นทุนต่อ Batch = ผลรวมต้นทุนวัตถุดิบ; ต้นทุนต่อ kg = ต้นทุนต่อ Batch ÷ ผลผลิต; มูลค่าสต็อก = จำนวน × ราคาต่อหน่วย; กำไรเบื้องต้น = รายรับ − ค่าใช้จ่าย

เปิด index.html ใน browser ได้ทันที ข้อมูลที่เพิ่มใน prototype เก็บด้วย localStorage ก่อนเชื่อม database จริง

## Authentication

- ใช้ Supabase Auth สำหรับสมัครสมาชิก, User Login, Admin Login และ Logout
- role อ่านจาก `public.profiles` เท่านั้น และการสมัครสมาชิกใหม่จะได้ role `user` เสมอ
- หน้าจัดการธุรกิจเดิมเปิดเฉพาะ profile ที่มี role `admin`; หน้า User ไม่เห็นข้อมูล `app_state`
- frontend ใช้เฉพาะ Supabase publishable key ใน `supabase-client.js` และไม่มี `service_role` key
- หากต้องการแต่งตั้งผู้ดูแล ให้สร้างบัญชีผ่านหน้า User ก่อน แล้วเปลี่ยน `profiles.role` เป็น `admin` จาก Supabase Dashboard/SQL Editor ที่มีสิทธิ์ผู้ดูแล


