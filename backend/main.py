import os
import shutil
import tempfile
import pandas as pd
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv

from auth import verify_token
from storage import upload_to_gcs
from google import genai
from google.genai import types

app = FastAPI()

# --- 1. ตั้งค่า AI ---
GENAI_API_KEY = os.getenv("GENAI_API_KEY") 

if not GENAI_API_KEY:
    raise ValueError("❌ Error: ไม่เจอ API Key ในไฟล์ .env")

client = genai.Client(api_key=GENAI_API_KEY)

# --- 2. ตั้งค่า CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {"message": "AI Assistant Backend is Running!"}

# --- 3. ระบบอัพโหลด ---
@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...), 
    user: dict = Depends(verify_token)
):
    original_filename = file.filename
    file_ext = os.path.splitext(original_filename)[1].lower()
    temp_path = None
    upload_path = None 

    try:
        # 1. สร้างไฟล์ชั่วคราว
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp_file:
            shutil.copyfileobj(file.file, tmp_file)
            temp_path = tmp_file.name
        
        upload_path = temp_path
        mime_type = file.content_type

        # 2. แปลง Excel -> CSV (ถ้ามี)
        if original_filename.endswith(('.xlsx', '.xls')):
            def convert_excel_task():
                df = pd.read_excel(temp_path)
                csv_path = temp_path.replace(file_ext, ".csv")
                df.to_csv(csv_path, index=False)
                return csv_path
            
            upload_path = await run_in_threadpool(convert_excel_task)
            mime_type = "text/csv" 

        # 3. อัพโหลดขึ้น GCS
        file.file.seek(0)
        gcs_url = upload_to_gcs(file.file, original_filename, folder=f"users/{user['uid']}")

        # 4. อัพโหลดให้ Gemini
        def upload_gemini_task():
            with open(upload_path, "rb") as f:
                return client.files.upload(
                    file=f, 
                    config={'mime_type': mime_type, 'display_name': original_filename}
                )
        gemini_file = await run_in_threadpool(upload_gemini_task)
        
        return {
            "status": "success", "filename": original_filename, 
            "url": gcs_url, "gemini_uri": gemini_file.uri, "mime_type": gemini_file.mime_type
        }

    except Exception as e:
        print(f"❌ Upload Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        # ✅ แก้ไขส่วนนี้: จัดย่อหน้าให้ถูกต้อง ไม่ Error แล้วครับ
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path) 
            except:
                pass
        
        if upload_path and upload_path != temp_path and os.path.exists(upload_path):
            try:
                os.remove(upload_path) 
            except:
                pass

# --- 4. ระบบคุยกับ AI (Streaming) ---
@app.post("/ask")
async def ask_ai(
    payload: dict = Body(...),
    user: dict = Depends(verify_token)
):
    question = payload.get("question")
    file_uri = payload.get("file_uri")
    mime_type = payload.get("mime_type")

    async def event_generator():
        try:
            content_parts = []
            if file_uri:
                content_parts.append(types.Part.from_uri(file_uri=file_uri, mime_type=mime_type))
            content_parts.append(types.Part.from_text(text=question))

            # เรียกใช้ generate_content_stream
            response_stream = client.models.generate_content_stream(
                model='gemini-2.0-flash',
                contents=[types.Content(role="user", parts=content_parts)]
            )
            
            for chunk in response_stream:
                if chunk.text:
                    yield chunk.text

        except Exception as e:
            yield f"Error: {str(e)}"

    return StreamingResponse(event_generator(), media_type="text/plain")