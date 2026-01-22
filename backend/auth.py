import firebase_admin
from firebase_admin import credentials, auth
from fastapi import HTTPException, Header

# โหลด Key ที่เราเพิ่งแปะลงไป
cred = credentials.Certificate("service-account.json")
firebase_admin.initialize_app(cred)

async def verify_token(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token header")
    
    token = authorization.split("Bearer ")[1]
    
    try:
        # เช็คกับ Firebase ว่า Token นี้ของจริงไหม
        decoded_token = auth.verify_id_token(token)
        return decoded_token  # ส่งข้อมูล user (uid, email) กลับไปให้ฟังก์ชันอื่นใช้
    except Exception as e:
        print(f"Auth Error: {e}")
        raise HTTPException(status_code=401, detail="Invalid or expired token")