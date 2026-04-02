from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import pytesseract
from PIL import Image
import io

app = FastAPI()

# The same CORS fix that worked for the Terminal!
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/ocr")
async def perform_ocr(file: UploadFile = File(...)):
    # Read the image bytes
    image_data = await file.read()
    image = Image.open(io.BytesIO(image_data))
    
    # Run Tesseract
    text = pytesseract.image_to_string(image)
    
    return {"text": text}