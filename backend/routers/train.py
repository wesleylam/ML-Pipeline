import os, uuid, json, threading
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import pandas as pd
import numpy as np

router = APIRouter()
STORAGE_RAW    = os.path.join(os.path.dirname(__file__), "../storage/raw")
STORAGE_CLEAN  = os.path.join(os.path.dirname(__file__), "../storage/clean")
STORAGE_MODELS = os.path.join(os.path.dirname(__file__), "../storage/models")
os.makedirs(STORAGE_MODELS, exist_ok=True)

# In-memory job store
JOBS: dict = {}


def _load_df(ds_id: str) -> pd.DataFrame:
    for base in [STORAGE_CLEAN, STORAGE_RAW]:
        path = os.path.join(base, ds_id, "data.parquet")
        if os.path.exists(path):
            return pd.read_parquet(path)
    raise FileNotFoundError(f"Dataset {ds_id} not found")


class PipelineStep(BaseModel):
    name: str        # sklearn class name e.g. "StandardScaler"
    category: str    # preprocessing | feature_selection | estimators
    params: dict = {}


class TrainRequest(BaseModel):
    dataset_id: str
    target_column: str
    feature_columns: Optional[List[str]] = None
    test_size: float = 0.2
    random_state: int = 42
    steps: List[PipelineStep]


def _build_step(step: PipelineStep):
    """Instantiate an sklearn step from its name and params."""
    from sklearn.preprocessing import (
        StandardScaler, MinMaxScaler, RobustScaler, Normalizer,
        OneHotEncoder, LabelEncoder, PolynomialFeatures
    )
    from sklearn.impute import SimpleImputer
    from sklearn.feature_selection import SelectKBest, VarianceThreshold, f_classif, f_regression, RFE
    from sklearn.decomposition import PCA
    from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor, GradientBoostingClassifier
    from sklearn.linear_model import LogisticRegression, LinearRegression
    from sklearn.svm import SVC
    from sklearn.neighbors import KNeighborsClassifier

    CLASS_MAP = {
        "StandardScaler": StandardScaler,
        "MinMaxScaler": MinMaxScaler,
        "RobustScaler": RobustScaler,
        "Normalizer": Normalizer,
        "SimpleImputer": SimpleImputer,
        "OneHotEncoder": OneHotEncoder,
        "LabelEncoder": LabelEncoder,
        "PolynomialFeatures": PolynomialFeatures,
        "SelectKBest": SelectKBest,
        "VarianceThreshold": VarianceThreshold,
        "PCA": PCA,
        "RFE": RFE,
        "RandomForestClassifier": RandomForestClassifier,
        "RandomForestRegressor": RandomForestRegressor,
        "GradientBoostingClassifier": GradientBoostingClassifier,
        "LogisticRegression": LogisticRegression,
        "LinearRegression": LinearRegression,
        "SVC": SVC,
        "KNeighborsClassifier": KNeighborsClassifier,
    }

    cls = CLASS_MAP.get(step.name)
    if cls is None:
        raise ValueError(f"Unknown step: {step.name}")

    # Sanitize params
    safe_params = {}
    for k, v in step.params.items():
        if k in ("include_bias",):
            safe_params[k] = str(v).lower() == "true"
        else:
            try:
                safe_params[k] = int(v) if str(v).isdigit() else float(v) if _is_float(str(v)) else v
            except Exception:
                safe_params[k] = v

    try:
        return cls(**safe_params)
    except Exception as e:
        raise ValueError(f"Could not instantiate {step.name}: {e}")


def _is_float(s):
    try:
        float(s)
        return True
    except ValueError:
        return False


def _run_training(job_id: str, req: TrainRequest):
    import joblib
    from sklearn.pipeline import Pipeline
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import (
        accuracy_score, f1_score, precision_score, recall_score,
        mean_squared_error, r2_score, confusion_matrix
    )
    from sklearn.preprocessing import LabelEncoder

    JOBS[job_id]["status"] = "running"
    JOBS[job_id]["log"] = []

    def log(msg):
        JOBS[job_id]["log"].append(msg)

    try:
        log("Loading dataset...")
        df = _load_df(req.dataset_id)

        log(f"Preparing features (target: {req.target_column})...")
        y = df[req.target_column]
        feature_cols = req.feature_columns or [c for c in df.columns if c != req.target_column]
        X = df[feature_cols]

        # Encode string target for classification
        le = None
        if y.dtype == object:
            le = LabelEncoder()
            y = le.fit_transform(y)

        log(f"Splitting train/test ({int((1-req.test_size)*100)}/{int(req.test_size*100)})...")
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=req.test_size, random_state=req.random_state
        )

        # Build pipeline steps — only numeric cols for most transformers
        log("Building sklearn Pipeline...")
        estimator_step = None
        pre_steps = []
        for step in req.steps:
            inst = _build_step(step)
            step_name = step.name.lower().replace(" ", "_")
            if step.category == "estimators":
                estimator_step = (step_name, inst)
            else:
                pre_steps.append((step_name, inst))

        if estimator_step is None:
            raise ValueError("No estimator in pipeline")

        # Handle mixed types: encode object cols before fitting
        obj_cols = X_train.select_dtypes(include="object").columns.tolist()
        if obj_cols:
            log(f"Label-encoding categorical columns: {obj_cols}")
            for col in obj_cols:
                enc = LabelEncoder()
                X_train[col] = enc.fit_transform(X_train[col].astype(str))
                X_test[col] = X_test[col].astype(str).map(lambda x: enc.transform([x])[0] if x in enc.classes_ else -1)

        pipeline = Pipeline(pre_steps + [estimator_step])

        log(f"Fitting pipeline ({len(pre_steps)} preprocessors + estimator)...")
        pipeline.fit(X_train, y_train)

        log("Evaluating on test set...")
        y_pred = pipeline.predict(X_test)
        estimator = pipeline.named_steps[estimator_step[0]]
        is_classifier = hasattr(estimator, "classes_") or hasattr(estimator, "predict_proba")

        metrics = {}
        if is_classifier:
            metrics["accuracy"] = float(accuracy_score(y_test, y_pred))
            metrics["f1"] = float(f1_score(y_test, y_pred, average="weighted", zero_division=0))
            metrics["precision"] = float(precision_score(y_test, y_pred, average="weighted", zero_division=0))
            metrics["recall"] = float(recall_score(y_test, y_pred, average="weighted", zero_division=0))
            cm = confusion_matrix(y_test, y_pred)
            metrics["confusion_matrix"] = cm.tolist()
        else:
            metrics["r2"] = float(r2_score(y_test, y_pred))
            metrics["mse"] = float(mean_squared_error(y_test, y_pred))
            metrics["rmse"] = float(np.sqrt(mean_squared_error(y_test, y_pred)))

        # Feature importance
        feature_importance = []
        if hasattr(estimator, "feature_importances_"):
            imps = estimator.feature_importances_
            # align with possibly-transformed feature count
            cols_used = feature_cols[:len(imps)]
            feature_importance = sorted(
                [{"feature": c, "importance": float(v)} for c, v in zip(cols_used, imps)],
                key=lambda x: x["importance"], reverse=True
            )
        elif hasattr(estimator, "coef_"):
            coef = np.abs(estimator.coef_).flatten()
            cols_used = feature_cols[:len(coef)]
            feature_importance = sorted(
                [{"feature": c, "importance": float(v)} for c, v in zip(cols_used, coef)],
                key=lambda x: x["importance"], reverse=True
            )

        log("Computing predictions dataframe...")
        # Build predictions table
        X_test_copy = X_test.copy()
        X_test_copy["actual"] = list(y_test)
        X_test_copy["predicted"] = list(y_pred)
        if hasattr(estimator, "predict_proba"):
            proba = pipeline.predict_proba(X_test)
            X_test_copy["probability"] = proba[:, 1] if proba.shape[1] == 2 else proba.max(axis=1)
        else:
            X_test_copy["probability"] = None
        if not is_classifier:
            X_test_copy["residual"] = X_test_copy["actual"] - X_test_copy["predicted"]

        predictions = X_test_copy.head(200).where(pd.notnull(X_test_copy), None).to_dict(orient="records")

        log("Saving model...")
        job_dir = os.path.join(STORAGE_MODELS, job_id)
        os.makedirs(job_dir, exist_ok=True)
        joblib.dump(pipeline, os.path.join(job_dir, "model.joblib"))

        meta = {
            "job_id": job_id,
            "dataset_id": req.dataset_id,
            "target_column": req.target_column,
            "feature_columns": feature_cols,
            "steps": [{"name": s.name, "category": s.category, "params": s.params} for s in req.steps],
            "is_classifier": is_classifier,
            "metrics": metrics,
            "feature_importance": feature_importance,
            "predictions": predictions,
            "column_names": list(X_test.columns),
        }
        with open(os.path.join(job_dir, "metadata.json"), "w") as f:
            json.dump(meta, f, indent=2, default=str)

        log("Done ✓")
        JOBS[job_id]["status"] = "done"
        JOBS[job_id]["result"] = meta

    except Exception as e:
        JOBS[job_id]["status"] = "failed"
        JOBS[job_id]["error"] = str(e)
        JOBS[job_id]["log"].append(f"ERROR: {e}")


@router.post("")
def start_training(req: TrainRequest):
    job_id = str(uuid.uuid4())[:8]
    JOBS[job_id] = {"status": "pending", "log": [], "result": None}
    t = threading.Thread(target=_run_training, args=(job_id, req), daemon=True)
    t.start()
    return {"job_id": job_id, "status": "pending"}


@router.get("/{job_id}/status")
def job_status(job_id: str):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return {"job_id": job_id, "status": job["status"], "log": job["log"], "error": job.get("error")}


@router.get("/{job_id}/results")
def job_results(job_id: str):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    if job["status"] != "done":
        raise HTTPException(400, f"Job is {job['status']}")
    return job["result"]


@router.get("")
def list_jobs():
    return [{"job_id": jid, "status": j["status"]} for jid, j in JOBS.items()]
