export interface ParamDef {
  key: string
  label: string
  type: 'number' | 'select' | 'text'
  default: string | number
  options?: string[]
}

export interface StepDef {
  id: string
  name: string
  category: 'preprocessing' | 'feature_selection' | 'estimators'
  color: string
  desc: string
  params: ParamDef[]
}

export const STEP_CATALOGUE: Record<string, StepDef[]> = {
  preprocessing: [
    { id: 'standard_scaler',     name: 'StandardScaler',      category: 'preprocessing', color: 'var(--accent2)', desc: 'Zero mean, unit variance',          params: [] },
    { id: 'minmax_scaler',       name: 'MinMaxScaler',         category: 'preprocessing', color: 'var(--accent2)', desc: 'Scale to [0,1] range',               params: [{ key:'min', label:'Min', type:'number', default:0 }, { key:'max', label:'Max', type:'number', default:1 }] },
    { id: 'robust_scaler',       name: 'RobustScaler',         category: 'preprocessing', color: 'var(--accent2)', desc: 'Robust to outliers (IQR)',            params: [] },
    { id: 'normalizer',          name: 'Normalizer',           category: 'preprocessing', color: 'var(--accent2)', desc: 'Normalize samples to unit norm',      params: [{ key:'norm', label:'Norm', type:'select', default:'l2', options:['l1','l2','max'] }] },
    { id: 'simple_imputer',      name: 'SimpleImputer',        category: 'preprocessing', color: 'var(--yellow)',  desc: 'Fill missing values',                 params: [{ key:'strategy', label:'Strategy', type:'select', default:'mean', options:['mean','median','most_frequent','constant'] }] },
    { id: 'onehot_encoder',      name: 'OneHotEncoder',        category: 'preprocessing', color: 'var(--accent)',  desc: 'Binary encode categoricals',          params: [{ key:'handle_unknown', label:'Handle unknown', type:'select', default:'ignore', options:['ignore','error'] }] },
    { id: 'polynomial_features', name: 'PolynomialFeatures',   category: 'preprocessing', color: 'var(--purple)',  desc: 'Generate polynomial features',        params: [{ key:'degree', label:'Degree', type:'number', default:2 }, { key:'include_bias', label:'Include bias', type:'select', default:'false', options:['true','false'] }] },
  ],
  feature_selection: [
    { id: 'select_k_best',       name: 'SelectKBest',          category: 'feature_selection', color: 'var(--orange)', desc: 'Select top K features',          params: [{ key:'k', label:'K features', type:'number', default:10 }] },
    { id: 'variance_threshold',  name: 'VarianceThreshold',    category: 'feature_selection', color: 'var(--orange)', desc: 'Remove low-variance features',   params: [{ key:'threshold', label:'Threshold', type:'number', default:0.0 }] },
    { id: 'pca',                 name: 'PCA',                  category: 'feature_selection', color: 'var(--orange)', desc: 'Principal Component Analysis',    params: [{ key:'n_components', label:'n_components', type:'number', default:5 }] },
  ],
  estimators: [
    { id: 'rf_clf',         name: 'RandomForestClassifier',      category: 'estimators', color: 'var(--accent)',  desc: 'Ensemble of decision trees',    params: [{ key:'n_estimators', label:'n_estimators', type:'number', default:100 }, { key:'max_depth', label:'max_depth', type:'number', default:10 }] },
    { id: 'logistic_reg',   name: 'LogisticRegression',          category: 'estimators', color: 'var(--accent2)', desc: 'Fast linear classifier',        params: [{ key:'C', label:'C (reg)', type:'number', default:1.0 }, { key:'max_iter', label:'max_iter', type:'number', default:100 }, { key:'solver', label:'solver', type:'select', default:'lbfgs', options:['lbfgs','saga','newton-cg'] }] },
    { id: 'svc',            name: 'SVC',                         category: 'estimators', color: 'var(--accent3)', desc: 'Support Vector Classifier',     params: [{ key:'C', label:'C', type:'number', default:1.0 }, { key:'kernel', label:'kernel', type:'select', default:'rbf', options:['rbf','linear','poly','sigmoid'] }] },
    { id: 'rf_reg',         name: 'RandomForestRegressor',       category: 'estimators', color: 'var(--accent)',  desc: 'RF for regression tasks',       params: [{ key:'n_estimators', label:'n_estimators', type:'number', default:100 }, { key:'max_depth', label:'max_depth', type:'number', default:10 }] },
    { id: 'linear_reg',     name: 'LinearRegression',            category: 'estimators', color: 'var(--accent2)', desc: 'Simple linear model',           params: [] },
    { id: 'gradient_boost', name: 'GradientBoostingClassifier',  category: 'estimators', color: 'var(--yellow)',  desc: 'Boosted tree ensemble',         params: [{ key:'n_estimators', label:'n_estimators', type:'number', default:100 }, { key:'learning_rate', label:'lr', type:'number', default:0.1 }, { key:'max_depth', label:'max_depth', type:'number', default:3 }] },
    { id: 'knn',            name: 'KNeighborsClassifier',        category: 'estimators', color: 'var(--purple)',  desc: 'k-Nearest Neighbors',           params: [{ key:'n_neighbors', label:'n_neighbors', type:'number', default:5 }, { key:'weights', label:'weights', type:'select', default:'uniform', options:['uniform','distance'] }] },
  ],
}

export const ALL_STEP_DEFS: StepDef[] = Object.values(STEP_CATALOGUE).flat()
