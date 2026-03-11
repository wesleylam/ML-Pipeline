import os, json, uuid
from typing import List, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import pandas as pd
import numpy as np

router = APIRouter()
STORAGE_RAW   = os.path.join(os.path.dirname(__file__), "../storage/raw")
STORAGE_CLEAN = os.path.join(os.path.dirname(__file__), "../storage/clean")
os.makedirs(STORAGE_CLEAN, exist_ok=True)


def _load_df(ds_id: str) -> pd.DataFrame:
    for base in [STORAGE_RAW, STORAGE_CLEAN]:
        path = os.path.join(base, ds_id, "data.parquet")
        if os.path.exists(path):
            return pd.read_parquet(path)
    raise HTTPException(404, f"Dataset {ds_id} not found")


class Operation(BaseModel):
    op: str
    params: dict = {}


class CleanRequest(BaseModel):
    operations: List[Operation]


def apply_operation(df: pd.DataFrame, op: str, params: dict) -> pd.DataFrame:
    df = df.copy()

    if op == "drop_columns":
        cols = params.get("columns", [])
        df = df.drop(columns=[c for c in cols if c in df.columns], errors="ignore")

    elif op == "fill_missing":
        col = params.get("column")
        strategy = params.get("strategy", "mean")
        value = params.get("value", 0)
        if col and col in df.columns:
            if strategy == "mean":
                df[col] = df[col].fillna(df[col].mean())
            elif strategy == "median":
                df[col] = df[col].fillna(df[col].median())
            elif strategy == "mode":
                df[col] = df[col].fillna(df[col].mode()[0] if not df[col].mode().empty else np.nan)
            elif strategy == "constant":
                df[col] = df[col].fillna(value)
        else:
            # fill all
            num_cols = df.select_dtypes(include="number").columns
            if strategy == "mean":
                df[num_cols] = df[num_cols].fillna(df[num_cols].mean())
            elif strategy == "median":
                df[num_cols] = df[num_cols].fillna(df[num_cols].median())

    elif op == "drop_nulls":
        subset = params.get("subset") or None
        df = df.dropna(subset=subset)

    elif op == "drop_duplicates":
        subset = params.get("subset") or None
        df = df.drop_duplicates(subset=subset)

    elif op == "rename_column":
        old = params.get("old_name")
        new = params.get("new_name")
        if old and new and old in df.columns:
            df = df.rename(columns={old: new})

    elif op == "filter_rows":
        col = params.get("column")
        operator = params.get("operator", "==")
        val = params.get("value")
        if col and col in df.columns and val is not None:
            try:
                val = float(val) if df[col].dtype in [np.float64, np.int64] else val
                if operator == "==":   df = df[df[col] == val]
                elif operator == "!=": df = df[df[col] != val]
                elif operator == ">":  df = df[df[col] > val]
                elif operator == "<":  df = df[df[col] < val]
                elif operator == ">=": df = df[df[col] >= val]
                elif operator == "<=": df = df[df[col] <= val]
            except Exception:
                pass

    elif op == "cast_dtype":
        col = params.get("column")
        dtype = params.get("dtype", "float")
        if col and col in df.columns:
            try:
                df[col] = df[col].astype(dtype)
            except Exception:
                pass

    return df


@router.post("/{ds_id}/clean/preview")
def preview_clean(ds_id: str, req: CleanRequest):
    df = _load_df(ds_id)
    original_shape = df.shape
    for op_item in req.operations:
        df = apply_operation(df, op_item.op, op_item.params)
    preview = df.head(50).where(pd.notnull(df), None).to_dict(orient="records")
    null_counts = {col: int(df[col].isnull().sum()) for col in df.columns}
    return {
        "original_rows": original_shape[0],
        "original_cols": original_shape[1],
        "result_rows": len(df),
        "result_cols": len(df.columns),
        "column_names": list(df.columns),
        "null_counts": null_counts,
        "preview": preview,
    }


@router.post("/{ds_id}/clean/save")
def save_clean(ds_id: str, req: CleanRequest):
    df = _load_df(ds_id)
    for op_item in req.operations:
        df = apply_operation(df, op_item.op, op_item.params)

    clean_id = str(uuid.uuid4())[:8]
    clean_dir = os.path.join(STORAGE_CLEAN, clean_id)
    os.makedirs(clean_dir, exist_ok=True)
    df.to_parquet(os.path.join(clean_dir, "data.parquet"), index=False)

    # Save ops history
    ops_data = [{"op": o.op, "params": o.params} for o in req.operations]
    history = {
        "source_dataset_id": ds_id,
        "operations": ops_data
    }
    with open(os.path.join(clean_dir, "ops_history.json"), "w") as f:
        json.dump(history, f, indent=2)

    return {
        "clean_id": clean_id,
        "rows": len(df),
        "columns": len(df.columns),
        "column_names": list(df.columns),
        "message": f"Saved as '{clean_id}'",
    }


@router.get("/{ds_id}/clean/history")
def clean_history(ds_id: str):
    path = os.path.join(STORAGE_CLEAN, ds_id, "ops_history.json")
    if not os.path.exists(path):
        return []
    with open(path) as f:
        return json.load(f)
