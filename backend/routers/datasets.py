import os, json, uuid, shutil
from fastapi import APIRouter, HTTPException, UploadFile, File
import pandas as pd

router = APIRouter()
STORAGE_RAW   = os.path.join(os.path.dirname(__file__), "../storage/raw")
STORAGE_CLEAN = os.path.join(os.path.dirname(__file__), "../storage/clean")
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
        if ext == ".csv": df = pd.read_csv(dest)
        elif ext == ".xlsx": df = pd.read_excel(dest)
        else: df = pd.read_parquet(dest)
    except Exception as e:
        shutil.rmtree(ds_dir)
        raise HTTPException(400, f"Could not parse file: {e}")

    df.to_parquet(os.path.join(ds_dir, "data.parquet"), index=False)
    return {"id": ds_id, "name": file.filename, "rows": len(df), "columns": len(df.columns), "column_names": list(df.columns), **_infer_meta(df)}

def _load_df(ds_id: str) -> pd.DataFrame:
    path = os.path.join(STORAGE_RAW, ds_id, "data.parquet")
    if not os.path.exists(path):
        # try clean
        path = os.path.join(STORAGE_CLEAN, ds_id, "data.parquet")
    if not os.path.exists(path):
        raise HTTPException(404, f"Dataset {ds_id} not found")
    return pd.read_parquet(path)


@router.get("")
def list_datasets():
    datasets = []
    if os.path.exists(STORAGE_RAW):
        for ds_id in sorted(os.listdir(STORAGE_RAW)):
            ds_dir = os.path.join(STORAGE_RAW, ds_id)
            p = os.path.join(ds_dir, "data.parquet")
            if os.path.isdir(ds_dir) and os.path.exists(p):
                try:
                    df = pd.read_parquet(p)
                    files = [f for f in os.listdir(ds_dir) if f != "data.parquet"]
                    name = files[0] if files else ds_id
                    datasets.append({"id": ds_id, "name": name, "rows": len(df), "columns": len(df.columns), "type": "raw"})
                except Exception:
                    pass

    if os.path.exists(STORAGE_CLEAN):
        for ds_id in sorted(os.listdir(STORAGE_CLEAN)):
            ds_dir = os.path.join(STORAGE_CLEAN, ds_id)
            p = os.path.join(ds_dir, "data.parquet")
            if os.path.isdir(ds_dir) and os.path.exists(p):
                try:
                    df = pd.read_parquet(p)
                    datasets.append({"id": ds_id, "name": ds_id, "rows": len(df), "columns": len(df.columns), "type": "clean"})
                except Exception:
                    pass

    return datasets


@router.get("/{ds_id}")
def get_dataset(ds_id: str):
    df = _load_df(ds_id)
    dtypes = {col: str(df[col].dtype) for col in df.columns}
    null_counts = {col: int(df[col].isnull().sum()) for col in df.columns}
    preview = df.head(50).where(pd.notnull(df), None).to_dict(orient="records")

    name = ds_id
    # Check if it's a raw dataset by checking for its directory in STORAGE_RAW
    raw_dir = os.path.join(STORAGE_RAW, ds_id)
    if os.path.isdir(raw_dir):
        files = [f for f in os.listdir(raw_dir) if f != "data.parquet"]
        if files: name = files[0]
    else:
        # If not in raw, it must be in clean. Try to find its source for a better name.
        history_path = os.path.join(STORAGE_CLEAN, ds_id, "ops_history.json")
        if os.path.exists(history_path):
            try:
                with open(history_path) as f:
                    history = json.load(f)
                    if isinstance(history, dict):
                        source_id = history.get("source_dataset_id")
                        if source_id:
                            source_raw_dir = os.path.join(STORAGE_RAW, source_id)
                            if os.path.isdir(source_raw_dir):
                                files = [f for f in os.listdir(source_raw_dir) if f != "data.parquet"]
                                if files: name = files[0]
            except (json.JSONDecodeError, KeyError):
                pass

    return {
        "id": ds_id, "name": name,
        "rows": len(df), "columns": len(df.columns),
        "column_names": list(df.columns),
        "dtypes": dtypes, "null_counts": null_counts, "preview": preview,
    }


@router.get("/{ds_id}/preview")
def preview_dataset(ds_id: str, page: int = 0, page_size: int = 50):
    df = _load_df(ds_id)
    slice_ = df.iloc[page*page_size:(page+1)*page_size]
    return {
        "rows": slice_.where(pd.notnull(slice_), None).to_dict(orient="records"),
        "total": len(df),
        "page": page,
        "page_size": page_size,
    }
