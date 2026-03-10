import React, { useState } from 'react'
import { TrainResult, exportResultCSV } from '../api/client'
import { Btn, Card, CardTitle, EmptyState, Divider } from '../components/ui'
import {
  BarChart, Bar, ScatterChart, Scatter, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

interface Props { result: TrainResult | null; jobId: string | null }

const AXIS_COLORS = { x: 'var(--accent2)', y: 'var(--accent)', color: 'var(--accent3)' }
type AxisMode = 'x' | 'y' | 'color'
type ChartType = 'importance' | 'scatter' | 'histogram' | 'line' | 'confusion'

const tooltipStyle = { background: '#181b22', border: '1px solid #252830', borderRadius: 6, fontSize: 12 }
const tickStyle = { fill: '#555b6e', fontSize: 11 }

export const ResultsPage: React.FC<Props> = ({ result, jobId }) => {
  const [chartType, setChartType] = useState<ChartType>('importance')
  const [xAxis, setXAxis]   = useState('index')
  const [yAxis, setYAxis]   = useState('probability')
  const [colorBy, setColorBy] = useState('predicted')
  const [axisMode, setAxisMode] = useState<AxisMode>('x')

  if (!result) return <EmptyState icon="📊" title="No results yet" sub="Train a model to explore results here" />

  const { metrics, feature_importance, predictions, is_classifier, column_names } = result
  const numCols = ['index', ...(column_names || []), 'actual', 'predicted', 'probability', 'residual'].filter(c => {
    if (predictions.length === 0) return true
    const val = predictions[0][c]
    return val !== null && typeof val === 'number'
  })

  const hasAxes = ['scatter', 'histogram', 'line'].includes(chartType)
  const currentAxisVal = axisMode === 'x' ? xAxis : axisMode === 'y' ? yAxis : colorBy

  const setAxis = (col: string) => {
    if (axisMode === 'x') setXAxis(col)
    else if (axisMode === 'y') setYAxis(col)
    else setColorBy(col)
  }

  const colBtnClass = (col: string): string => {
    if (axisMode === 'x' && col === xAxis) return 'sel-x'
    if (axisMode === 'y' && col === yAxis) return 'sel-y'
    if (axisMode === 'color' && col === colorBy) return 'sel-c'
    return ''
  }

  // Chart data
  const scatterData = predictions.map((r, i) => ({
    x: r[xAxis] !== undefined ? r[xAxis] : i,
    y: r[yAxis] !== undefined ? r[yAxis] : r.probability,
    c: r[colorBy] !== undefined ? r[colorBy] : 0,
  }))

  const histData = (() => {
    const vals = predictions.map(r => r[xAxis] as number).filter(v => v != null && typeof v === 'number')
    if (vals.length === 0) return []
    const min = Math.min(...vals), max = Math.max(...vals), bins = 12, size = (max - min) / bins || 1
    return Array.from({ length: bins }, (_, i) => ({
      bin: (min + i * size).toFixed(1),
      count: vals.filter(v => v >= min + i * size && v < min + (i + 1) * size).length,
    }))
  })()

  const lineData = predictions.slice(0, 60).map((r, i) => ({
    i,
    val: r[yAxis] !== undefined ? r[yAxis] as number : null,
  }))

  const cm = (metrics.confusion_matrix as number[][]) || null

  const metricCards = is_classifier
    ? [['Accuracy', ((metrics.accuracy as number) * 100).toFixed(1) + '%'], ['F1 Score', (metrics.f1 as number).toFixed(3)], ['Precision', (metrics.precision as number).toFixed(3)], ['Recall', (metrics.recall as number).toFixed(3)]]
    : [['R²', (metrics.r2 as number).toFixed(4)], ['MSE', (metrics.mse as number).toFixed(4)], ['RMSE', (metrics.rmse as number).toFixed(4)]]

  const chartTypes: { id: ChartType; label: string }[] = [
    { id: 'importance', label: 'Feature Importance' },
    { id: 'scatter',    label: 'Scatter' },
    { id: 'histogram',  label: 'Histogram' },
    { id: 'line',       label: 'Line' },
    ...(is_classifier && cm ? [{ id: 'confusion' as ChartType, label: 'Confusion Matrix' }] : []),
  ]

  return (
    <div className="fade-in">
      {/* Metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${metricCards.length}, 1fr)`, gap: 10, marginBottom: 20 }}>
        {metricCards.map(([l, v]) => (
          <div key={l} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 26, fontWeight: 700, color: 'var(--accent)' }}>{v}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.1em', marginTop: 4 }}>{l}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 16, alignItems: 'start' }}>
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
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>mapping:</span>
              {[['x', xAxis, 'rgba(0,144,255,.15)', 'var(--accent2)'], ['y', yAxis, 'rgba(0,229,160,.12)', 'var(--accent)'], ['color', colorBy, 'rgba(255,94,125,.12)', 'var(--accent3)']].map(([k, v, bg, fg]) => (
                <span key={k} style={{ padding: '2px 8px', borderRadius: 12, fontFamily: 'var(--mono)', fontSize: 10, background: bg, color: fg }}>{k}:{v}</span>
              ))}
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
                  <XAxis dataKey="x" name={xAxis} tick={tickStyle} axisLine={false} label={{ value: xAxis, fill: '#555b6e', fontSize: 11, position: 'insideBottom', offset: -10 }} />
                  <YAxis dataKey="y" name={yAxis} tick={tickStyle} axisLine={false} label={{ value: yAxis, fill: '#555b6e', fontSize: 10, angle: -90, position: 'insideLeft' }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: any, n: string) => [v, n === 'x' ? xAxis : yAxis]} />
                  <Scatter data={scatterData as any[]}>
                    {scatterData.map((d, i) => <Cell key={i} fill={Number(d.c) === 1 ? '#00e5a0' : '#0090ff'} opacity={0.75} />)}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            )}

            {chartType === 'histogram' && (
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
                  <XAxis dataKey="i" tick={{ fill: '#555b6e', fontSize: 10 }} axisLine={false} label={{ value: 'index', fill: '#555b6e', fontSize: 11, position: 'insideBottom', offset: -10 }} />
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
                      { v: cm[0]?.[0], label: 'True Neg',  cls: 'tp' },
                      { v: cm[0]?.[1], label: 'False Pos', cls: 'fp' },
                      { v: cm[1]?.[0], label: 'False Neg', cls: 'fn' },
                      { v: cm[1]?.[1], label: 'True Pos',  cls: 'tn' },
                    ].map(({ v, label, cls }) => (
                      <div key={label} style={{ textAlign: 'center' }}>
                        <div style={{ width: 66, height: 66, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 700, background: cls === 'tp' || cls === 'tn' ? 'rgba(0,229,160,.25)' : 'rgba(255,94,125,.2)', color: cls === 'tp' || cls === 'tn' ? 'var(--accent)' : 'var(--accent3)' }}>{v ?? '—'}</div>
                        <div style={{ fontSize: 10, color: 'var(--text3)', textAlign: 'center', marginTop: 4, fontFamily: 'var(--mono)' }}>{label}</div>
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
              {/* Mode buttons */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                {(['x', 'y', 'color'] as AxisMode[]).map(m => (
                  <button key={m} onClick={() => setAxisMode(m)} style={{ flex: 1, padding: '5px 4px', borderRadius: 5, fontSize: 10, fontFamily: 'var(--mono)', cursor: 'pointer', textAlign: 'center', textTransform: 'uppercase', border: `1px solid ${axisMode === m ? AXIS_COLORS[m] : 'var(--border)'}`, background: axisMode === m ? `${AXIS_COLORS[m]}18` : 'var(--bg3)', color: axisMode === m ? AXIS_COLORS[m] : 'var(--text3)', transition: 'all .12s' }}>
                    {m}
                  </button>
                ))}
              </div>

              <div style={{ fontSize: 10, color: AXIS_COLORS[axisMode], fontFamily: 'var(--mono)', marginBottom: 10, letterSpacing: '.05em' }}>
                {axisMode.toUpperCase()} AXIS <span style={{ color: 'var(--text3)', marginLeft: 6 }}>= {currentAxisVal}</span>
              </div>

              {numCols.map(col => {
                const selCls = colBtnClass(col)
                const selColors: Record<string, [string, string]> = {
                  'sel-x': ['rgba(0,144,255,.1)', 'var(--accent2)'],
                  'sel-y': ['rgba(0,229,160,.08)', 'var(--accent)'],
                  'sel-c': ['rgba(255,94,125,.08)', 'var(--accent3)'],
                }
                const [bg, fg] = selColors[selCls] || ['var(--bg3)', 'var(--text2)']
                return (
                  <button key={col} onClick={() => setAxis(col)}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', marginBottom: 3, borderRadius: 5, border: `1px solid ${selCls ? fg : 'var(--border)'}`, background: bg, color: fg, fontFamily: 'var(--mono)', fontSize: 11, cursor: 'pointer', transition: 'all .12s' }}>
                    {col}
                  </button>
                )
              })}

              <Divider />
              <div style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.7 }}>
                Select X / Y / Color mode then click a column to assign it.
              </div>
            </>
          ) : (
            <>
              <CardTitle>Export</CardTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {jobId && <Btn variant="secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => exportResultCSV(jobId)}>⬇ Export CSV</Btn>}
                <Btn variant="secondary" style={{ width: '100%', justifyContent: 'center' }}>💾 Save Model</Btn>
              </div>
              <Divider />
              <div style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.6 }}>
                Switch to Scatter, Histogram, or Line to configure axis mapping.
              </div>
            </>
          )}
        </div>
      </div>

      {/* Predictions table */}
      <Card style={{ marginTop: 16 }}>
        <CardTitle>Predictions Sample</CardTitle>
        <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {[...(column_names || []).slice(0, 5), 'actual', 'predicted', is_classifier ? 'probability' : 'residual'].map(col => (
                  <th key={col} style={{ background: 'var(--bg3)', padding: '9px 14px', textAlign: 'left', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {predictions.slice(0, 10).map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  {[...(column_names || []).slice(0, 5), 'actual', 'predicted', is_classifier ? 'probability' : 'residual'].map(col => {
                    const val = row[col]
                    const isNum = typeof val === 'number'
                    return (
                      <td key={col} style={{ padding: '8px 14px', fontFamily: 'var(--mono)', color: col === 'predicted' ? 'var(--accent)' : col === 'actual' ? 'var(--accent2)' : isNum ? 'var(--text)' : 'var(--accent3)' }}>
                        {val === null ? <span style={{ color: 'var(--accent3)', fontStyle: 'italic' }}>null</span> : typeof val === 'number' ? val.toFixed(4) : String(val)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
