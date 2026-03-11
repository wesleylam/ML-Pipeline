import React, { useState, useMemo } from 'react'
import { TrainResult, exportResultCSV } from '../api/client'
import { Btn, Card, CardTitle, EmptyState, Divider } from '../components/ui'
import {
  BarChart, Bar, ScatterChart, Scatter, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

interface Props { result: TrainResult | null; jobId: string | null }

type AxisMode  = 'x' | 'y' | 'color'
type ChartType = 'importance' | 'scatter' | 'histogram' | 'line' | 'confusion'

interface FilterRule { col: string; op: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'contains'; val: string }

const AXIS_COLORS  = { x: 'var(--accent2)', y: 'var(--accent)', color: 'var(--accent3)' }
const tooltipStyle = { background: '#181b22', border: '1px solid #252830', borderRadius: 6, fontSize: 12 }
const tickStyle    = { fill: '#555b6e', fontSize: 11 }

function getContinuousColor(value: number, min: number, max: number, startColor = [0, 144, 255], endColor = [0, 229, 160]): string {
  if (min >= max) return `rgb(${startColor[0]}, ${startColor[1]}, ${startColor[2]})`;
  const ratio = (value - min) / (max - min);
  const r = Math.round(startColor[0] + ratio * (endColor[0] - startColor[0]));
  const g = Math.round(startColor[1] + ratio * (endColor[1] - startColor[1]));
  const b = Math.round(startColor[2] + ratio * (endColor[2] - startColor[2]));
  return `rgb(${r}, ${g}, ${b})`;
}

// ── Filter Bar ─────────────────────────────────────────────────────────────────
const FilterBar: React.FC<{
  allCols: string[]
  filters: FilterRule[]
  setFilters: React.Dispatch<React.SetStateAction<FilterRule[]>>
  totalRows: number
  filteredRows: number
}> = ({ allCols, filters, setFilters, totalRows, filteredRows }) => {
  const [addingCol, setAddingCol] = useState(allCols[0] || '')
  const [addingOp,  setAddingOp]  = useState<FilterRule['op']>('==')
  const [addingVal, setAddingVal] = useState('')

  const addFilter = () => {
    if (!addingVal.trim()) return
    setFilters(prev => [...prev, { col: addingCol, op: addingOp, val: addingVal.trim() }])
    setAddingVal('')
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 5,
    padding: '5px 8px', color: 'var(--text)', fontSize: 12, fontFamily: 'var(--mono)',
    outline: 'none', appearance: 'none' as const,
  }

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: filters.length > 0 ? 10 : 0 }}>
        <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.1em', flexShrink: 0 }}>Filter Predictions</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: filteredRows < totalRows ? 'var(--yellow)' : 'var(--text3)', marginLeft: 'auto' }}>
          {filteredRows.toLocaleString()} / {totalRows.toLocaleString()} rows
        </span>
        {filters.length > 0 && (
          <button onClick={() => setFilters([])} style={{ background: 'none', border: 'none', color: 'var(--accent3)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--mono)', flexShrink: 0 }}>
            clear all
          </button>
        )}
      </div>

      {/* Active filter chips */}
      {filters.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {filters.map((f, i) => (
            <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 12, background: 'rgba(0,144,255,.12)', border: '1px solid rgba(0,144,255,.25)', fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--accent2)' }}>
              <span>{f.col} {f.op} {f.val}</span>
              <button onClick={() => setFilters(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 12, padding: '0 0 0 2px', lineHeight: 1 }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Add filter row */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={addingCol} onChange={e => setAddingCol(e.target.value)} style={{ ...inputStyle, minWidth: 100 }}>
          {allCols.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={addingOp} onChange={e => setAddingOp(e.target.value as FilterRule['op'])} style={{ ...inputStyle, width: 70 }}>
          {['==','!=','>','<','>=','<=','contains'].map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <input value={addingVal} onChange={e => setAddingVal(e.target.value)} placeholder="value"
          onKeyDown={e => e.key === 'Enter' && addFilter()}
          style={{ ...inputStyle, width: 120 }} />
        <button onClick={addFilter}
          style={{ padding: '5px 12px', borderRadius: 5, background: 'var(--accent2)', color: '#000', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sans)' }}>
          + Add
        </button>
      </div>
    </div>
  )
}

// ── Results Page ───────────────────────────────────────────────────────────────
export const ResultsPage: React.FC<Props> = ({ result, jobId }) => {
  const [chartType, setChartType] = useState<ChartType>('importance')
  const [xAxis,     setXAxis]     = useState('predicted')
  const [yAxis,     setYAxis]     = useState('probability')
  const [colorBy,   setColorBy]   = useState('predicted')
  const [axisMode,  setAxisMode]  = useState<AxisMode>('x')
  const [filters,   setFilters]   = useState<FilterRule[]>([])

  const { metrics, feature_importance, predictions, is_classifier, column_names } = result || {
    metrics: {}, feature_importance: [], predictions: [], is_classifier: false, column_names: []
  }

  // ── All columns available in the predictions table ─────────────────────────
  const allPredCols = useMemo(() => {
    if (!result) return []
    const base = [...(column_names || []), 'actual', 'predicted']
    if (is_classifier) base.push('probability')
    else base.push('residual')
    return base.filter(c => predictions.length === 0 || (predictions[0] && predictions[0][c] !== undefined))
  }, [result, column_names, predictions, is_classifier])

  const numCols = useMemo(() =>
    allPredCols.filter(c => (predictions?.length || 0) === 0 || (predictions[0] && typeof predictions[0][c] === 'number')),
  [result, allPredCols, predictions])

  // ── Apply filters ──────────────────────────────────────────────────────────
  const filteredPredictions = useMemo(() => {
    if (!predictions) return []
    if (filters.length === 0) return predictions
    return predictions.filter(row => filters.every(f => {
      const rawVal = row[f.col]
      const numF   = parseFloat(f.val)
      const numRow = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal))
      if (f.op === 'contains') return String(rawVal).toLowerCase().includes(f.val.toLowerCase())
      if (!isNaN(numF) && !isNaN(numRow)) {
        if (f.op === '==')  return numRow === numF
        if (f.op === '!=')  return numRow !== numF
        if (f.op === '>')   return numRow >   numF
        if (f.op === '<')   return numRow <   numF
        if (f.op === '>=')  return numRow >=  numF
        if (f.op === '<=')  return numRow <=  numF
      }
      if (f.op === '==')  return String(rawVal) === f.val
      if (f.op === '!=')  return String(rawVal) !== f.val
      return true
    }))
  }, [result, predictions, filters])

  // ── Chart data (uses filtered set) ────────────────────────────────────────
  const scatterData = filteredPredictions.slice(0, 400).map((r, i) => ({
    x: r[xAxis] !== undefined ? r[xAxis] : i,
    y: r[yAxis] !== undefined ? r[yAxis] : r.probability,
    c: r[colorBy] !== undefined ? r[colorBy] : 0,
  }))

  const histData = useMemo(() => {
    if (!result) return []
    const vals = filteredPredictions.map(r => r[xAxis] as number).filter(v => v != null && typeof v === 'number')
    if (vals.length === 0) return []
    const mn = Math.min(...vals), mx = Math.max(...vals), bins = 14, size = (mx - mn) / bins || 1
    return Array.from({ length: bins }, (_, i) => ({
      bin: (mn + i * size).toFixed(1),
      count: vals.filter(v => v >= mn + i * size && v < mn + (i + 1) * size).length,
    }))
  }, [result, filteredPredictions, xAxis])

  const colorByStats = useMemo(() => {
    if (!numCols.includes(colorBy)) return null;
    const values = filteredPredictions.map(r => r[colorBy] as number).filter(v => typeof v === 'number' && isFinite(v));
    if (values.length === 0) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    return { min, max };
  }, [filteredPredictions, colorBy, numCols]);

  const lineData = filteredPredictions.slice(0, 80).map((r, i) => ({
    i,
    val: r[yAxis] !== undefined ? r[yAxis] as number : null,
  }))

  if (!result) return <EmptyState icon="📊" title="No results yet" sub="Train a model to explore results here" />

  const cm = (metrics?.confusion_matrix as number[][]) || null

  const hasAxes = ['scatter', 'histogram', 'line'].includes(chartType)
  const currentAxisVal = axisMode === 'x' ? xAxis : axisMode === 'y' ? yAxis : colorBy

  const setAxis = (col: string) => {
    if (axisMode === 'x') setXAxis(col)
    else if (axisMode === 'y') setYAxis(col)
    else setColorBy(col)
  }

  const colBtnHighlight = (col: string): [string, string] | null => {
    if (col === xAxis     && ['scatter','histogram','line'].includes(chartType)) return ['rgba(0,144,255,.1)',  'var(--accent2)']
    if (col === yAxis     && ['scatter','line'].includes(chartType))             return ['rgba(0,229,160,.08)', 'var(--accent)']
    if (col === colorBy   && chartType === 'scatter')                            return ['rgba(255,94,125,.08)','var(--accent3)']
    return null
  }

  const metricCards = !metrics || Object.keys(metrics).length === 0 ? [] : is_classifier
    ? [['Accuracy',  ((metrics.accuracy  as number) * 100).toFixed(1) + '%'],
       ['F1 Score',  (metrics.f1         as number).toFixed(3)],
       ['Precision', (metrics.precision  as number).toFixed(3)],
       ['Recall',    (metrics.recall     as number).toFixed(3)]]
    : [['R²',   (metrics.r2   as number).toFixed(4)],
       ['MSE',  (metrics.mse  as number).toFixed(4)],
       ['RMSE', (metrics.rmse as number).toFixed(4)]]

  const chartTypes: { id: ChartType; label: string }[] = [
    { id: 'importance', label: 'Feature Importance' },
    { id: 'scatter',    label: 'Scatter'            },
    { id: 'histogram',  label: 'Histogram'          },
    { id: 'line',       label: 'Line'               },
    ...(is_classifier && cm ? [{ id: 'confusion' as ChartType, label: 'Confusion Matrix' }] : []),
  ]

  const tableCols = [...(column_names || []).slice(0, 5), 'actual', 'predicted', is_classifier ? 'probability' : 'residual']

  return (
    <div className="fade-in">
      {/* Metrics */}
      {metricCards.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${metricCards.length}, 1fr)`, gap: 10, marginBottom: 20 }}>
          {metricCards.map(([l, v]) => (
            <div key={l} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 26, fontWeight: 700, color: 'var(--accent)' }}>{v}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.1em', marginTop: 4 }}>{l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Chart + axis panel */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 16, alignItems: 'start', marginBottom: 16 }}>
        <div>
          {/* Chart type tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {chartTypes.map(ct => (
              <button key={ct.id} onClick={() => setChartType(ct.id)}
                style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: `1px solid ${chartType === ct.id ? 'var(--accent2)' : 'var(--border)'}`, background: chartType === ct.id ? 'rgba(0,144,255,.1)' : 'var(--bg3)', color: chartType === ct.id ? 'var(--accent2)' : 'var(--text2)', transition: 'all .15s', fontFamily: 'var(--sans)' }}>
                {ct.label}
              </button>
            ))}
          </div>

          {/* Axis pills */}
          {hasAxes && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>mapping:</span>
              {([['x', xAxis, 'rgba(0,144,255,.15)', 'var(--accent2)'], ['y', yAxis, 'rgba(0,229,160,.12)', 'var(--accent)'], ['color', colorBy, 'rgba(255,94,125,.12)', 'var(--accent3)']] as const).map(([k, v, bg, fg]) => (
                <span key={k} style={{ padding: '2px 8px', borderRadius: 12, fontFamily: 'var(--mono)', fontSize: 10, background: bg, color: fg }}>{k}:{v}</span>
              ))}
              {filters.length > 0 && (
                <span style={{ padding: '2px 8px', borderRadius: 12, fontFamily: 'var(--mono)', fontSize: 10, background: 'rgba(255,217,80,.12)', color: 'var(--yellow)', marginLeft: 4 }}>
                  {filteredPredictions.length.toLocaleString()} / {predictions.length.toLocaleString()} filtered
                </span>
              )}
            </div>
          )}

          {/* Chart */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, height: 340 }}>
            {chartType === 'importance' && feature_importance.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={feature_importance} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#252830" horizontal={false} />
                  <XAxis type="number" tick={tickStyle} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="feature" tick={{ fill: '#8b90a0', fontSize: 11, fontFamily: 'Space Mono' }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                    {feature_importance.map((_, i) => <Cell key={i} fill={['#00e5a0','#0090ff','#a78bfa','#ff9f43','#ffd950','#ff5e7d'][i % 6]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}

            {chartType === 'scatter' && (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 20, bottom: 24, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#252830" />
                  <XAxis type="number" dataKey="x" name={xAxis} tick={tickStyle} axisLine={false} label={{ value: xAxis, fill: '#555b6e', fontSize: 11, position: 'insideBottom', offset: -10 }} domain={['dataMin', 'dataMax']} />
                  <YAxis type="number" dataKey="y" name={yAxis} tick={tickStyle} axisLine={false} label={{ value: yAxis, fill: '#555b6e', fontSize: 10, angle: -90, position: 'insideLeft' }} domain={['dataMin', 'dataMax']} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: any, n: string) => [v, n === 'x' ? xAxis : yAxis]} />
                  <Scatter data={scatterData as any[]}>
                    {scatterData.map((d, i) => {
                      let fillColor = '#0090ff';
                      if (colorByStats && typeof d.c === 'number' && isFinite(d.c)) {
                        fillColor = getContinuousColor(d.c, colorByStats.min, colorByStats.max);
                      } else if (d.c !== null && d.c !== undefined) {
                        fillColor = Number(d.c) === 1 ? '#00e5a0' : '#0090ff';
                      }
                      return <Cell key={i} fill={fillColor} opacity={0.75} />;
                    })}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            )}

            {chartType === 'histogram' && histData.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={histData} margin={{ bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#252830" vertical={false} />
                  <XAxis dataKey="bin" tick={{ fill: '#555b6e', fontSize: 10 }} axisLine={false} tickLine={false} label={{ value: xAxis, fill: '#555b6e', fontSize: 11, position: 'insideBottom', offset: -10 }} />
                  <YAxis tick={tickStyle} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" fill="#0090ff" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}

            {chartType === 'line' && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData} margin={{ bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#252830" />
                  <XAxis dataKey="i" tick={{ fill: '#555b6e', fontSize: 10 }} axisLine={false} label={{ value: 'index (filtered)', fill: '#555b6e', fontSize: 11, position: 'insideBottom', offset: -10 }} />
                  <YAxis tick={tickStyle} axisLine={false} label={{ value: yAxis, fill: '#555b6e', fontSize: 10, angle: -90, position: 'insideLeft' }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="val" stroke="#00e5a0" strokeWidth={2} dot={false} name={yAxis} />
                </LineChart>
              </ResponsiveContainer>
            )}

            {chartType === 'confusion' && cm && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 48 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10, fontFamily: 'var(--mono)', textAlign: 'center' }}>CONFUSION MATRIX</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                    {[
                      { v: cm[0]?.[0], label: 'True Neg',  good: true  },
                      { v: cm[0]?.[1], label: 'False Pos', good: false },
                      { v: cm[1]?.[0], label: 'False Neg', good: false },
                      { v: cm[1]?.[1], label: 'True Pos',  good: true  },
                    ].map(({ v, label, good }) => (
                      <div key={label} style={{ textAlign: 'center' }}>
                        <div style={{ width: 66, height: 66, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 700, background: good ? 'rgba(0,229,160,.25)' : 'rgba(255,94,125,.2)', color: good ? 'var(--accent)' : 'var(--accent3)' }}>{v ?? '—'}</div>
                        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4, fontFamily: 'var(--mono)' }}>{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  {cm[0] && cm[1] && [
                    ['TPR', ((cm[1][1] / (cm[1][1] + cm[1][0])) * 100).toFixed(1) + '%', 'var(--accent)'],
                    ['TNR', ((cm[0][0] / (cm[0][0] + cm[0][1])) * 100).toFixed(1) + '%', 'var(--accent)'],
                    ['FPR', ((cm[0][1] / (cm[0][0] + cm[0][1])) * 100).toFixed(1) + '%', 'var(--accent3)'],
                  ].map(([l, v, c]) => (
                    <div key={l} style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 3 }}>{l}</div>
                      <span style={{ fontSize: 10, fontFamily: 'var(--mono)', padding: '2px 7px', borderRadius: 3, background: `${c}22`, color: c }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Axis / Export panel */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
          {hasAxes ? (
            <>
              <CardTitle>Axis Controls</CardTitle>
              <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                {(['x', 'y', 'color'] as AxisMode[]).map(m => (
                  <button key={m} onClick={() => setAxisMode(m)}
                    style={{ flex: 1, padding: '5px 4px', borderRadius: 5, fontSize: 10, fontFamily: 'var(--mono)', cursor: 'pointer', textAlign: 'center', textTransform: 'uppercase', border: `1px solid ${axisMode === m ? AXIS_COLORS[m] : 'var(--border)'}`, background: axisMode === m ? `${AXIS_COLORS[m]}18` : 'var(--bg3)', color: axisMode === m ? AXIS_COLORS[m] : 'var(--text3)', transition: 'all .12s' }}>
                    {m}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 10, color: AXIS_COLORS[axisMode], fontFamily: 'var(--mono)', marginBottom: 10, letterSpacing: '.05em' }}>
                {axisMode.toUpperCase()} AXIS <span style={{ color: 'var(--text3)', marginLeft: 6 }}>= {currentAxisVal}</span>
              </div>
              {numCols.map(col => {
                const hi = colBtnHighlight(col)
                const [bg, fg] = hi || ['var(--bg3)', 'var(--text2)']
                return (
                  <button key={col} onClick={() => setAxis(col)}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', marginBottom: 3, borderRadius: 5, border: `1px solid ${hi ? fg : 'var(--border)'}`, background: bg, color: fg, fontFamily: 'var(--mono)', fontSize: 11, cursor: 'pointer', transition: 'all .12s' }}>
                    {col}
                  </button>
                )
              })}
              <Divider />
              <div style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.7 }}>Select X / Y / Color then click a column.</div>
            </>
          ) : (
            <>
              <CardTitle>Export</CardTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {jobId && <Btn variant="secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => exportResultCSV(jobId)}>⬇ Export CSV</Btn>}
              </div>
              <Divider />
              <div style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.6 }}>Switch to Scatter, Histogram, or Line to configure axes.</div>
            </>
          )}
        </div>
      </div>

      {/* ── Filter bar + predictions table ─────────────────────────────────── */}
      <FilterBar
        allCols={allPredCols}
        filters={filters}
        setFilters={setFilters}
        totalRows={predictions.length}
        filteredRows={filteredPredictions.length}
      />

      <Card style={{ marginTop: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <CardTitle style={{ margin: 0 }}>Predictions</CardTitle>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: filters.length > 0 ? 'var(--yellow)' : 'var(--text3)' }}>
            showing {Math.min(filteredPredictions.length, 100).toLocaleString()} of {filteredPredictions.length.toLocaleString()}
          </span>
        </div>
        <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {tableCols.map(col => (
                  <th key={col} style={{ background: 'var(--bg3)', padding: '9px 14px', textAlign: 'left', fontFamily: 'var(--mono)', fontSize: 11, color: col === 'predicted' ? 'var(--accent)' : col === 'actual' ? 'var(--accent2)' : 'var(--text3)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredPredictions.slice(0, 100).map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.01)' }}>
                  {tableCols.map(col => {
                    const val = row[col]
                    return (
                      <td key={col} style={{ padding: '7px 14px', fontFamily: 'var(--mono)', color: col === 'predicted' ? 'var(--accent)' : col === 'actual' ? 'var(--accent2)' : 'var(--text)' }}>
                        {val === null
                          ? <span style={{ color: 'var(--accent3)', fontStyle: 'italic' }}>null</span>
                          : typeof val === 'number' ? val.toFixed(4) : String(val)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredPredictions.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text3)', fontSize: 12 }}>
            No rows match the current filters.
          </div>
        )}
      </Card>
    </div>
  )
}