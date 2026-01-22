import os
import base64
import json
from google.cloud import storage
from google.oauth2 import service_account

def get_storage_client():
    """
    สร้าง Storage Client โดยรองรับทั้ง:
    1. Base64 String (สำหรับ Render/Production)
    2. File Path (สำหรับ Localhost)
    """
    
    # 1. เช็คว่ามีค่าแบบ Base64 ใน Env Var ไหม (สำหรับ Render)
    base64_creds = os.getenv("GOOGLE_CREDENTIALS_BASE64")
    
    if base64_creds:
        try:
            # ถอดรหัส Base64 -> JSON String -> Dict
            creds_json = base64.b64decode(base64_creds).decode("utf-8")
            creds_info = json.loads(creds_json)
            
            # สร้าง Credentials Object
            credentials = service_account.Credentials.from_service_account_info(creds_info)
            print("✅ Loaded GCS Credentials from Base64")
            return storage.Client(credentials=credentials)
        except Exception as e:
            print(f"❌ Error loading Base64 credentials: {e}")
            # ถ้าพัง ให้ลองวิธีอื่นต่อ หรือ Raise Error เลยก็ได้

    # 2. ถ้าไม่มี Base64 ให้ลองหาจากไฟล์ (สำหรับ Local Dev)
    # หรือถ้าเครื่อง Local มีการ Login ผ่าน gcloud auth application-default login
    try:
        # ถ้ามีไฟล์ service-account.json อยู่ในโฟลเดอร์ ก็ใช้เลย
        if os.path.exists("service-account.json"):
             print("✅ Loaded GCS Credentials from local file")
             return storage.Client.from_service_account_json("service-account.json")
        
        # สุดท้าย: ใช้ Default ของเครื่อง (ถ้ามี)
        return storage.Client()
    except Exception as e:
        print(f"❌ Could not initialize Storage Client: {e}")
        raise e

BUCKET_NAME = "slipwake-online-41716"

def upload_to_gcs(file_obj, filename, folder="uploads"):
    try:
        client = get_storage_client()
        bucket = client.bucket(BUCKET_NAME)
        
        blob_path = f"{folder}/{filename}"
        blob = bucket.blob(blob_path)
        
        # อัพโหลด
        blob.upload_from_file(file_obj)
        
        # ทำให้เป็น Public (ถ้าต้องการ) หรือจะใช้ Signed URL ก็ได้
        # blob.make_public() 
        
        return blob.public_url
        
    except Exception as e:
        print(f"❌ Upload GCS Error: {e}")
        raise e