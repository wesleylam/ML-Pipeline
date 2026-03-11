import React, { useState, useRef, useCallback } from 'react'
import { Dataset, Operation, previewClean, saveClean } from '../api/client'
import { Btn, Card, CardTitle, StatCard, FormGroup, Select, Input, Divider, EmptyState } from '../components/ui'
import {
  BarChart, Bar, ScatterChart, Scatter, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

interface Props { dataset: Dataset | null; onCleanSaved: (id: string) => void }

const OP_DEFS = [
  { op: 'fill_missing',    label: 'Fill Missing',    color: 'var(--accent2)', params: [{ key: 'column', label: 'Column', type: 'col' }, { key: 'strategy', label: 'Strategy', type: 'select', options: ['mean','median','mode','constant'] }, { key: 'value', label: 'Fill value', type: 'text', showIf: 'strategy=constant' }] },
  { op: 'drop_nulls',      label: 'Drop Null Rows',  color: 'var(--accent3)', params: [] },
  { op: 'drop_duplicates', label: 'Drop Duplicates', color: 'var(--accent3)', params: [] },
  { op: 'drop_columns',    label: 'Drop Columns',    color: 'var(--accent3)', params: [{ key: 'columns', label: 'Columns (comma-sep)', type: 'text' }] },
  { op: 'filter_rows',     label: 'Filter Rows',     color: 'var(--accent2)', params: [{ key: 'column', label: 'Column', type: 'col' }, { key: 'operator', label: 'Operator', type: 'select', options: ['==','!=','>','<','>=','<='] }, { key: 'value', label: 'Value', type: 'text' }] },
  { op: 'cast_dtype',      label: 'Cast Type',       color: 'var(--yellow)',  params: [{ key: 'column', label: 'Column', type: 'col' }, { key: 'dtype', label: 'Type', type: 'select', options: ['float64','int64','str','bool'] }] },
  { op: 'rename_column',   label: 'Rename Column',   color: 'var(--purple)',  params: [{ key: 'old_name', label: 'Old name', type: 'col' }, { key: 'new_name', label: 'New name', type: 'text' }] },
]

interface OpInstance { uid: string; op: string; label: string; color: string; params: Record<string, string>; expanded: boolean }

type VizType = 'histogram' | 'scatter' | 'line' | 'nulls'
type AxisMode = 'x' | 'y'
const tooltipStyle = { background: '#181b22', border: '1px solid #252830', borderRadius: 6, fontSize: 12 }
const tickStyle    = { fill: '#555b6e', fontSize: 10 }

// ── Live Viz Panel ─────────────────────────────────────────────────────────────
const VizPanel: React.FC<{ preview: any | null; cols: string[]; loading: boolean }> = ({ preview, cols, loading }) => {
  const [vizType, setVizType] = React.useState<VizType>('histogram')
  const [xCol, setXCol] = React.useState(cols[0] || '')
  const [yCol, setYCol] = React.useState(cols[1] || cols[0] || '')
  const [axisMode, setAxisMode] = React.useState<AxisMode>('x')

  React.useEffect(() => {
    if (cols.length > 0 && !cols.includes(xCol)) setXCol(cols[0])
    if (cols.length > 1 && !cols.includes(yCol)) setYCol(cols[1] || cols[0])
  }, [cols])

  const rows: Record<string, unknown>[] = preview?.preview || []
  const activeCols: string[] = preview?.column_names || cols
  const numCols = activeCols.filter((c: string) => rows.length === 0 || typeof rows[0][c] === 'number')

  const histData = (() => {
    const vals = rows.map(r => r[xCol] as number).filter(v => v != null && typeof v === 'number')
    if (vals.length === 0) return []
    const mn = Math.min(...vals), mx = Math.max(...vals), bins = 14, size = (mx - mn) / bins || 1
    return Array.from({ length: bins }, (_, i) => ({
      bin: (mn + i * size).toFixed(1),
      count: vals.filter(v => v >= mn + i * size && v < mn + (i + 1) * size).length,
    }))
  })()

  const scatterData = rows.slice(0, 300).map(r => ({ x: r[xCol], y: r[yCol] }))
  const lineData    = rows.slice(0, 80).map((r, i) => ({ i, val: r[xCol] as number }))
  const nullData    = activeCols
    .map((c: string) => ({ col: c, nulls: preview?.null_counts?.[c] ?? 0 }))
    .filter((d: any) => d.nulls > 0)

  const vizTabs: { id: VizType; label: string }[] = [
    { id: 'histogram', label: 'Histogram' },
    { id: 'scatter',   label: 'Scatter'   },
    { id: 'line',      label: 'Line'      },
    { id: 'nulls',     label: 'Null Counts' },
  ]

  const colBtn = (c: string) => {
    const isX = c === xCol
    const isY = c === yCol && vizType === 'scatter'
    const active = vizType === 'scatter' ? (axisMode === 'x' ? isX : isY) : isX
    const fg = active ? (axisMode === 'y' && vizType === 'scatter' ? 'var(--accent)' : 'var(--accent2)') : 'var(--text3)'
    return (
      <button key={c} onClick={() => {
          if (vizType === 'scatter') { if (axisMode === 'x') setXCol(c); else setYCol(c) }
          else setXCol(c)
        }}
        style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, fontFamily: 'var(--mono)', cursor: 'pointer', border: `1px solid ${active ? fg : 'var(--border)'}`, background: active ? `${fg}18` : 'var(--bg3)', color: fg, transition: 'all .12s' }}>
        {c}
      </button>
    )
  }

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <CardTitle style={{ margin: 0 }}>Live Preview</CardTitle>
        {loading
          ? <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--accent)', letterSpacing: '.05em' }} className="pulsing">UPDATING…</span>
          : preview && <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{preview.result_rows?.toLocaleString()} rows</span>
        }
      </div>

      {/* Chart tabs */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 10, flexWrap: 'wrap' }}>
        {vizTabs.map(t => (
          <button key={t.id} onClick={() => setVizType(t.id)}
            style={{ padding: '4px 10px', borderRadius: 5, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--sans)', border: `1px solid ${vizType === t.id ? 'var(--accent2)' : 'var(--border)'}`, background: vizType === t.id ? 'rgba(0,144,255,.1)' : 'var(--bg3)', color: vizType === t.id ? 'var(--accent2)' : 'var(--text2)', transition: 'all .12s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Axis controls */}
      {vizType !== 'nulls' && numCols.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {vizType === 'scatter' && (
            <>
              {(['x','y'] as AxisMode[]).map(m => (
                <button key={m} onClick={() => setAxisMode(m)}
                  style={{ padding: '3px 7px', borderRadius: 4, fontSize: 10, fontFamily: 'var(--mono)', cursor: 'pointer', textTransform: 'uppercase', border: `1px solid ${axisMode === m ? (m === 'x' ? 'var(--accent2)' : 'var(--accent)') : 'var(--border)'}`, background: axisMode === m ? (m === 'x' ? 'rgba(0,144,255,.12)' : 'rgba(0,229,160,.1)') : 'var(--bg3)', color: axisMode === m ? (m === 'x' ? 'var(--accent2)' : 'var(--accent)') : 'var(--text3)', transition: 'all .12s' }}>
                  {m}
                </button>
              ))}
              <span style={{ fontSize: 10, color: 'var(--text3)', margin: '0 2px' }}>→</span>
            </>
          )}
          {numCols.map(colBtn)}
        </div>
      )}

      {/* Chart */}
      <div style={{ height: 220, opacity: loading ? 0.45 : 1, transition: 'opacity .2s' }}>
        {!preview && !loading && (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: 'var(--text3)', fontSize: 12 }}>
            <span style={{ fontSize: 28 }}>📊</span>
            Add an operation to see live preview
          </div>
        )}

        {preview && vizType === 'histogram' && histData.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={histData} margin={{ bottom: 22, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#252830" vertical={false} />
              <XAxis dataKey="bin" tick={{ fill: '#555b6e', fontSize: 9 }} axisLine={false} tickLine={false} label={{ value: xCol, fill: '#555b6e', fontSize: 10, position: 'insideBottom', offset: -14 }} />
              <YAxis tick={tickStyle} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="#0090ff" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}

        {preview && vizType === 'scatter' && scatterData.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 5, right: 10, bottom: 22, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#252830" />
              <XAxis type="number" dataKey="x" name={xCol} tick={tickStyle} axisLine={false} label={{ value: xCol, fill: '#555b6e', fontSize: 10, position: 'insideBottom', offset: -14 }} domain={['dataMin', 'dataMax']} />
              <YAxis type="number" dataKey="y" name={yCol} tick={tickStyle} axisLine={false} label={{ value: yCol, fill: '#555b6e', fontSize: 9, angle: -90, position: 'insideLeft' }} domain={['dataMin', 'dataMax']} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any, n: string) => [v, n === 'x' ? xCol : yCol]} />
              <Scatter data={scatterData as any[]} fill="#00e5a0" opacity={0.6} />
            </ScatterChart>
          </ResponsiveContainer>
        )}

        {preview && vizType === 'line' && lineData.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineData} margin={{ bottom: 22, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#252830" />
              <XAxis dataKey="i" tick={tickStyle} axisLine={false} />
              <YAxis tick={tickStyle} axisLine={false} label={{ value: xCol, fill: '#555b6e', fontSize: 9, angle: -90, position: 'insideLeft' }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="val" stroke="#00e5a0" strokeWidth={2} dot={false} name={xCol} />
            </LineChart>
          </ResponsiveContainer>
        )}

        {preview && vizType === 'nulls' && (
          nullData.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: 'var(--accent)', fontSize: 13 }}>
              <span style={{ fontSize: 28 }}>✓</span>No null values remaining
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={nullData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#252830" horizontal={false} />
                <XAxis type="number" tick={tickStyle} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="col" tick={{ fill: '#8b90a0', fontSize: 10, fontFamily: 'Space Mono' }} axisLine={false} tickLine={false} width={80} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="nulls" fill="#ff5e7d" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )
        )}
      </div>
    </div>
  )
}

// ── Main Clean Page ────────────────────────────────────────────────────────────
export const CleanPage: React.FC<Props> = ({ dataset, onCleanSaved }) => {
  const [ops, setOps]                       = useState<OpInstance[]>([])
  const [preview, setPreview]               = useState<any | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [saveAs, setSaveAs]                 = useState('')
  const [saving, setSaving]                 = useState(false)
  const [saved, setSaved]                   = useState<string | null>(null)
  const [error, setError]                   = useState<string | null>(null)
  const debounceRef                         = useRef<ReturnType<typeof setTimeout> | null>(null)

  if (!dataset) return <EmptyState icon="🧹" title="No dataset loaded" sub="Upload a dataset first" />

  const cols       = dataset.column_names || []
  const totalNulls = Object.values(dataset.null_counts || {}).reduce((a, b) => a + b, 0)

  const toApiOps = (currentOps: OpInstance[]): Operation[] => currentOps.map(o => {
    const params = { ...o.params }
    if (o.op === 'drop_columns' && typeof params.columns === 'string') {
      (params as any).columns = params.columns.split(',').map((s: string) => s.trim()).filter(Boolean)
    }
    return { op: o.op, params }
  })

  const firePreview = useCallback(async (currentOps: OpInstance[]) => {
    if (currentOps.length === 0) { setPreview(null); return }
    setLoadingPreview(true)
    try {
      const res = await previewClean(dataset.id, toApiOps(currentOps))
      setPreview(res)
      setError(null)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Preview failed')
    }
    setLoadingPreview(false)
  }, [dataset.id])

  const schedulePreview = (nextOps: OpInstance[]) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => firePreview(nextOps), 600)
  }

  const addOp = (def: typeof OP_DEFS[0]) => {
    const initParams: Record<string, string> = {}
    def.params.forEach(p => {
      if (p.type === 'col') initParams[p.key] = cols[0] || ''
      else if (p.type === 'select') initParams[p.key] = (p as any).options?.[0] || ''
      else initParams[p.key] = ''
    })
    setOps(prev => {
      const next = [...prev, { uid: `${def.op}_${Date.now()}`, op: def.op, label: def.label, color: def.color, params: initParams, expanded: true }]
      schedulePreview(next)
      return next
    })
  }

  const updateParam = (uid: string, key: string, val: string) => {
    setOps(prev => {
      const next = prev.map(o => o.uid === uid ? { ...o, params: { ...o.params, [key]: val } } : o)
      schedulePreview(next)
      return next
    })
  }

  const removeOp = (uid: string) => {
    setOps(prev => {
      const next = prev.filter(o => o.uid !== uid)
      schedulePreview(next)
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true); setError(null)
    try {
      const res = await saveClean(dataset.id, toApiOps(ops), saveAs || undefined)
      setSaved(res.clean_id)
      onCleanSaved(res.clean_id)
    } catch (e: any) { setError(e?.response?.data?.detail || 'Save failed') }
    setSaving(false)
  }

  const previewCols: string[] = preview?.column_names || cols

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <StatCard value={dataset.rows.toLocaleString()} label="Original Rows" />
        <StatCard value={preview ? preview.result_rows.toLocaleString() : '—'} label="After Clean" color="var(--accent)" />
        <StatCard value={preview ? (dataset.rows - preview.result_rows) : '—'} label="Rows Removed" color="var(--accent3)" />
        <StatCard value={totalNulls} label="Original Nulls" color={totalNulls > 0 ? 'var(--accent3)' : 'var(--accent)'} />
        <StatCard value={ops.length} label="Operations" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr 200px', gap: 16, alignItems: 'start' }}>

        {/* Col 1: ops builder */}
        <div>
          <Card>
            <CardTitle>Cleaning Operations</CardTitle>
            {ops.length === 0 && (
              <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text3)', fontSize: 12, border: '1px dashed var(--border)', borderRadius: 8, marginBottom: 12 }}>
                No operations yet
              </div>
            )}
            {ops.map((op, i) => {
              const def = OP_DEFS.find(d => d.op === op.op)!
              return (
                <div key={op.uid} style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, marginBottom: 6, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', cursor: 'pointer' }}
                    onClick={() => setOps(prev => prev.map(o => o.uid === op.uid ? { ...o, expanded: !o.expanded } : o))}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', width: 18, flexShrink: 0 }}>{String(i+1).padStart(2,'0')}</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 9, padding: '2px 5px', borderRadius: 3, fontWeight: 700, background: `${op.color}22`, color: op.color, whiteSpace: 'nowrap', flexShrink: 0 }}>{op.label.toUpperCase()}</span>
                    <span style={{ fontSize: 11, color: 'var(--text2)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{op.label}</span>
                    {def.params.length > 0 && <span style={{ color: 'var(--text3)', fontSize: 12, transition: 'transform .2s', transform: op.expanded ? 'rotate(90deg)' : 'none', flexShrink: 0 }}>›</span>}
                    <button onClick={e => { e.stopPropagation(); removeOp(op.uid) }} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 13, flexShrink: 0 }}>✕</button>
                  </div>
                  {op.expanded && def.params.length > 0 && (
                    <div style={{ padding: '0 10px 10px 36px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {def.params.map(p => {
                        const showIf = (p as any).showIf
                        if (showIf) { const [k, v] = showIf.split('='); if (op.params[k] !== v) return null }
                        return (
                          <FormGroup key={p.key} label={p.label}>
                            {p.type === 'col' ? (
                              <Select value={op.params[p.key] || ''} onChange={e => updateParam(op.uid, p.key, e.target.value)}>
                                {cols.map(c => <option key={c} value={c}>{c}</option>)}
                              </Select>
                            ) : p.type === 'select' ? (
                              <Select value={op.params[p.key] || ''} onChange={e => updateParam(op.uid, p.key, e.target.value)}>
                                {(p as any).options.map((o: string) => <option key={o} value={o}>{o}</option>)}
                              </Select>
                            ) : (
                              <Input value={op.params[p.key] || ''} onChange={e => updateParam(op.uid, p.key, e.target.value)} placeholder={p.label} />
                            )}
                          </FormGroup>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}

            <Divider />
            <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.1em', fontFamily: 'var(--mono)', marginBottom: 8 }}>Add Operation</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {OP_DEFS.map(def => (
                <button key={def.op} onClick={() => addOp(def)}
                  style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 6, padding: '7px 8px', fontSize: 11, cursor: 'pointer', textAlign: 'left', transition: 'all .15s', fontFamily: 'var(--sans)' }}
                  onMouseOver={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
                  onMouseOut={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text2)' }}>
                  + {def.label}
                </button>
              ))}
            </div>
          </Card>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Input value={saveAs} onChange={e => setSaveAs(e.target.value)} placeholder={`${dataset.id}_clean`} style={{ flex: 1, minWidth: 0 }} />
            <Btn variant="primary" onClick={handleSave} disabled={saving || ops.length === 0}>
              {saving ? '⏳…' : saved ? '✓ Saved' : '💾 Save'}
            </Btn>
          </div>
          {error && <div style={{ marginTop: 8, padding: '7px 10px', background: 'rgba(255,94,125,.1)', border: '1px solid rgba(255,94,125,.3)', borderRadius: 6, color: 'var(--accent3)', fontSize: 12 }}>⚠ {error}</div>}
          {saved && <div style={{ marginTop: 8, padding: '7px 10px', background: 'rgba(0,229,160,.08)', border: '1px solid rgba(0,229,160,.3)', borderRadius: 6, color: 'var(--accent)', fontSize: 12 }}>✓ Saved as "{saved}"</div>}
        </div>

        {/* Col 2: live viz + preview table */}
        <div>
          <VizPanel preview={preview} cols={previewCols} loading={loadingPreview} />

          {preview?.preview?.length > 0 && (
            <Card style={{ marginTop: 14 }}>
              <CardTitle>Preview Data</CardTitle>
              <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr>
                      {(preview.column_names || cols).slice(0, 7).map((c: string) => (
                        <th key={c} style={{ background: 'var(--bg3)', padding: '7px 12px', textAlign: 'left', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.preview.slice(0, 8).map((row: Record<string, unknown>, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        {(preview.column_names || cols).slice(0, 7).map((c: string) => {
                          const val = row[c]
                          return (
                            <td key={c} style={{ padding: '6px 12px', fontFamily: 'var(--mono)', fontSize: 11, color: val === null ? 'var(--accent3)' : 'var(--text)' }}>
                              {val === null ? <i>null</i> : typeof val === 'number' ? (Number.isInteger(val) ? String(val) : (val as number).toFixed(3)) : String(val)}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        {/* Col 3: column stats */}
        <Card style={{ alignSelf: 'start' }}>
          <CardTitle>Column Stats</CardTitle>
          {(preview ? Object.entries(preview.null_counts || {}) : Object.entries(dataset.null_counts || {})).map(([col, n]) => {
            const nullN  = n as number
            const total  = preview ? preview.result_rows : dataset.rows
            const pct    = total > 0 ? ((nullN / total) * 100).toFixed(1) : '0'
            const dtype  = (dataset.dtypes || {})[col] || ''
            return (
              <div key={col} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>{col}</span>
                  <span style={{ fontSize: 10, color: 'var(--text3)', background: 'var(--bg)', padding: '1px 5px', borderRadius: 3, flexShrink: 0, marginLeft: 4 }}>{dtype}</span>
                </div>
                {nullN > 0 ? (
                  <>
                    <div style={{ height: 3, background: 'var(--bg)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent3)', borderRadius: 2, transition: 'width .4s ease' }} />
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{nullN} nulls ({pct}%)</div>
                  </>
                ) : (
                  <div style={{ fontSize: 10, color: 'var(--accent)' }}>✓ complete</div>
                )}
              </div>
            )
          })}
        </Card>

      </div>
    </div>
  )
}