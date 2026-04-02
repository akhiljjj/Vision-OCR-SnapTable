from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import pytesseract
import shutil
import os
from PIL import Image
import io
tesseract_bin = shutil.which("tesseract")
print(f"DEBUG: Tesseract binary located at: {tesseract_bin}")

if tesseract_bin:
    pytesseract.pytesseract.tesseract_cmd = tesseract_bin
else:
    # If it's not in the PATH, let's check common Linux locations
    common_locations = ["/usr/bin/tesseract", "/usr/local/bin/tesseract"]
    for loc in common_locations:
        if os.path.exists(loc):
            pytesseract.pytesseract.tesseract_cmd = loc
            print(f"DEBUG: Manually set Tesseract path to: {loc}")
            break
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