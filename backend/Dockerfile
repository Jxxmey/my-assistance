# ใช้ Python เวอร์ชันเล็กๆ แต่อัพเดท
FROM python:3.11-slim

# ตั้ง Folder ทำงาน
WORKDIR /app

# ติดตั้ง dependencies ระบบที่จำเป็น (เผื่อไว้สำหรับบาง library)
RUN apt-get update && apt-get install -y gcc

# ก๊อปปี้ไฟล์รายการ library และติดตั้ง
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ก๊อปปี้โค้ดทั้งหมด
COPY . .

# เปิด Port 8000
EXPOSE 8000

# คำสั่งรัน Server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]