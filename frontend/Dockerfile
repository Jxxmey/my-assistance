# ใช้ Node.js
FROM node:20-alpine

# ตั้ง Folder ทำงาน
WORKDIR /app

# ก๊อปปี้ไฟล์ package.json มาลง library ก่อน (เพื่อให้ Docker cache ได้)
COPY package*.json ./
RUN npm install

# ก๊อปปี้โค้ดทั้งหมด
COPY . .

# เปิด Port 5173 (Default ของ Vite)
EXPOSE 5173

# คำสั่งรัน (สำคัญ: ต้องเติม --host เพื่อให้เข้าจากข้างนอก container ได้)
CMD ["npm", "run", "dev", "--", "--host"]