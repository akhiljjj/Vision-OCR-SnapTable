from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pytesseract
import shutil
import os
from PIL import Image
import io
import sys
tesseract_bin = shutil.which("tesseract")
print(f"DEBUG: Tesseract binary located at: {tesseract_bin}")
if os.path.exists("/usr/bin/tesseract"):
    pytesseract.pytesseract.tesseract_cmd = "/usr/bin/tesseract"
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
    try:
        image_data = await file.read()
        if not image_data:
            raise HTTPException(status_code=400, detail="Empty upload")

        try:
            image = Image.open(io.BytesIO(image_data))
            image.load()
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid or unsupported image file")

        try:
            text = pytesseract.image_to_string(image)
        except pytesseract.TesseractNotFoundError as e:
            raise HTTPException(
                status_code=500,
                detail=f"Tesseract not available on server: {str(e)}",
            )

        return {"text": text}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR failed: {type(e).__name__}: {str(e)}")


@app.get("/api/health")
def health():
    return {
        "ok": True,
        "python": sys.version,
        "tesseract_cmd": getattr(pytesseract.pytesseract, "tesseract_cmd", None),
        "tesseract_in_path": shutil.which("tesseract"),
        "pillow_version": getattr(Image, "__version__", None),
    }