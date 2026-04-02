from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pytesseract
import shutil
import os
from PIL import Image
import io
import sys


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
    common_paths = ["/usr/bin/tesseract", "/usr/local/bin/tesseract", "/bin/tesseract"]
    tesseract_in_path = shutil.which("tesseract")
    return {
        "ok": True,
        "python": sys.version,
        "tesseract_cmd": getattr(pytesseract.pytesseract, "tesseract_cmd", None),
        "tesseract_in_path": tesseract_in_path,
        "tesseract_common_paths": {p: os.path.exists(p) for p in common_paths},
        "pillow_version": getattr(Image, "__version__", None),
        "docs_url": app.docs_url,
        "openapi_url": app.openapi_url,
    }