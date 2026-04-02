from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pytesseract
import shutil
import os
from PIL import Image
import io
import sys
import uvicorn


def _configure_tesseract() -> str | None:
    """
    Locate Tesseract in a flexible way (PATH first, then common locations)
    and configure pytesseract to use it.
    Returns the resolved path or None if not found.
    """
    tesseract_path = shutil.which("tesseract")
    if not tesseract_path:
        for loc in ("/usr/bin/tesseract", "/usr/local/bin/tesseract", "/bin/tesseract"):
            if os.path.exists(loc):
                tesseract_path = loc
                break

    if tesseract_path:
        pytesseract.pytesseract.tesseract_cmd = tesseract_path
    return tesseract_path


# Ensure docs are enabled and predictable in production.
# If Railway mounts this app under a prefix, the docs will typically be under that prefix too.
app = FastAPI(docs_url="/docs", redoc_url="/redoc", openapi_url="/openapi.json")

# The same CORS fix that worked for the Terminal!
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup_log():
    tesseract_path = shutil.which("tesseract")
    print(f"DEBUG startup: tesseract_in_path={tesseract_path!r}")


@app.post("/api/ocr")
async def perform_ocr(file: UploadFile = File(...)):
    try:
        print(
            f"DEBUG /api/ocr: filename={file.filename!r} content_type={file.content_type!r}"
        )

        tesseract_path = _configure_tesseract()
        if not tesseract_path:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Tesseract is not installed on the server (shutil.which('tesseract') is null). "
                    "Install it in your Railway image (e.g. via Nixpacks aptPkgs: tesseract-ocr)."
                ),
            )

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
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Tesseract OCR failed: {type(e).__name__}: {str(e)}"
            )

        return {"text": text}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR failed: {type(e).__name__}: {str(e)}")


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "vision-ocr-backend"}


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run("main:app", host="0.0.0.0", port=port)