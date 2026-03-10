import os, json
from fastapi import APIRouter, HTTPException
import pandas as pd

router = APIRouter()
STORAGE_RAW   = os.path.join(os.path.dirname(__file__), "../storage/raw")
STORAGE_CLEAN = os.path.join(os.path.dirname(__file__), "../storage/clean")


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
        for ds_id in os.listdir(STORAGE_RAW):
            p = os.path.join(STORAGE_RAW, ds_id, "data.parquet")
            if os.path.exists(p):
                try:
                    df = pd.read_parquet(p)
                    # get original filename
                    files = [f for f in os.listdir(os.path.join(STORAGE_RAW, ds_id)) if f != "data.parquet"]
                    name = files[0] if files else ds_id
                    datasets.append({"id": ds_id, "name": name, "rows": len(df), "columns": len(df.columns)})
                except Exception:
                    pass
    return datasets


@router.get("/{ds_id}")
def get_dataset(ds_id: str):
    df = _load_df(ds_id)
    dtypes = {col: str(df[col].dtype) for col in df.columns}
    null_counts = {col: int(df[col].isnull().sum()) for col in df.columns}
    preview = df.head(50).where(pd.notnull(df), None).to_dict(orient="records")
    files = [f for f in os.listdir(os.path.join(STORAGE_RAW, ds_id)) if f != "data.parquet"]
    name = files[0] if files else ds_id
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
