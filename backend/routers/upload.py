import uuid, os, shutil
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import pandas as pd

router = APIRouter()
STORAGE_RAW = os.path.join(os.path.dirname(__file__), "../storage/raw")
os.makedirs(STORAGE_RAW, exist_ok=True)


def _infer_meta(df: pd.DataFrame) -> dict:
    dtypes = {col: str(df[col].dtype) for col in df.columns}
    null_counts = {col: int(df[col].isnull().sum()) for col in df.columns}
    preview = df.head(50).where(pd.notnull(df), None).to_dict(orient="records")
    stats = {}
    for col in df.select_dtypes(include="number").columns:
        stats[col] = {
            "min": float(df[col].min()) if not df[col].isnull().all() else None,
            "max": float(df[col].max()) if not df[col].isnull().all() else None,
            "mean": float(df[col].mean()) if not df[col].isnull().all() else None,
            "std": float(df[col].std()) if not df[col].isnull().all() else None,
        }
    return {"dtypes": dtypes, "null_counts": null_counts, "preview": preview, "stats": stats}


@router.post("/upload")
async def upload_dataset(file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in {".csv", ".xlsx", ".parquet"}:
        raise HTTPException(400, "Unsupported file type. Use CSV, XLSX or Parquet.")

    ds_id = str(uuid.uuid4())[:8]
    ds_dir = os.path.join(STORAGE_RAW, ds_id)
    os.makedirs(ds_dir, exist_ok=True)
    dest = os.path.join(ds_dir, file.filename)

    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        if ext == ".csv":
            df = pd.read_csv(dest)
        elif ext == ".xlsx":
            df = pd.read_excel(dest)
        else:
            df = pd.read_parquet(dest)
    except Exception as e:
        shutil.rmtree(ds_dir)
        raise HTTPException(400, f"Could not parse file: {e}")

    # Cache as parquet
    parquet_path = os.path.join(ds_dir, "data.parquet")
    df.to_parquet(parquet_path, index=False)

    meta = _infer_meta(df)
    return {
        "id": ds_id,
        "name": file.filename,
        "rows": len(df),
        "columns": len(df.columns),
        "column_names": list(df.columns),
        **meta,
    }
