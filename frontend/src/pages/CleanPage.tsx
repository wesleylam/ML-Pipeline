import React, { useState } from 'react'
import { Dataset, Operation, previewClean, saveClean } from '../api/client'
import { Btn, Card, CardTitle, StatCard, FormGroup, Select, Input, Divider, EmptyState } from '../components/ui'

interface Props { dataset: Dataset | null; onCleanSaved: (id: string) => void }

const OP_DEFS = [
  { op: 'fill_missing',    label: 'Fill Missing',      color: 'var(--accent2)',  params: [{ key: 'column', label: 'Column', type: 'col' }, { key: 'strategy', label: 'Strategy', type: 'select', options: ['mean','median','mode','constant'] }, { key: 'value', label: 'Fill value', type: 'text', showIf: 'strategy=constant' }] },
  { op: 'drop_nulls',      label: 'Drop Null Rows',    color: 'var(--accent3)',  params: [] },
  { op: 'drop_duplicates', label: 'Drop Duplicates',   color: 'var(--accent3)',  params: [] },
  { op: 'drop_columns',    label: 'Drop Columns',      color: 'var(--accent3)',  params: [{ key: 'columns', label: 'Columns (comma-sep)', type: 'text' }] },
  { op: 'filter_rows',     label: 'Filter Rows',       color: 'var(--accent2)',  params: [{ key: 'column', label: 'Column', type: 'col' }, { key: 'operator', label: 'Operator', type: 'select', options: ['==','!=','>','<','>=','<='] }, { key: 'value', label: 'Value', type: 'text' }] },
  { op: 'cast_dtype',      label: 'Cast Type',         color: 'var(--yellow)',   params: [{ key: 'column', label: 'Column', type: 'col' }, { key: 'dtype', label: 'Type', type: 'select', options: ['float64','int64','str','bool'] }] },
  { op: 'rename_column',   label: 'Rename Column',     color: 'var(--purple)',   params: [{ key: 'old_name', label: 'Old name', type: 'col' }, { key: 'new_name', label: 'New name', type: 'text' }] },
]

interface OpInstance { uid: string; op: string; label: string; color: string; params: Record<string, string>; expanded: boolean }

export const CleanPage: React.FC<Props> = ({ dataset, onCleanSaved }) => {
  const [ops, setOps] = useState<OpInstance[]>([])
  const [preview, setPreview] = useState<any | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [saveAs, setSaveAs] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!dataset) return <EmptyState icon="🧹" title="No dataset loaded" sub="Upload a dataset first" />

  const cols = dataset.column_names || []
  const totalNulls = Object.values(dataset.null_counts || {}).reduce((a, b) => a + b, 0)

  const addOp = (def: typeof OP_DEFS[0]) => {
    const initParams: Record<string, string> = {}
    def.params.forEach(p => {
      if (p.type === 'col') initParams[p.key] = cols[0] || ''
      else if (p.type === 'select') initParams[p.key] = (p as any).options?.[0] || ''
      else initParams[p.key] = ''
    })
    setOps(prev => [...prev, { uid: `${def.op}_${Date.now()}`, op: def.op, label: def.label, color: def.color, params: initParams, expanded: true }])
  }

  const updateParam = (uid: string, key: string, val: string) =>
    setOps(prev => prev.map(o => o.uid === uid ? { ...o, params: { ...o.params, [key]: val } } : o))

  const removeOp = (uid: string) => setOps(prev => prev.filter(o => o.uid !== uid))

  const toApiOps = (): Operation[] => ops.map(o => {
    const params = { ...o.params }
    if (o.op === 'drop_columns' && typeof params.columns === 'string') {
      (params as any).columns = params.columns.split(',').map((s: string) => s.trim()).filter(Boolean)
    }
    return { op: o.op, params }
  })

  const handlePreview = async () => {
    setLoadingPreview(true); setError(null)
    try {
      const res = await previewClean(dataset.id, toApiOps())
      setPreview(res)
    } catch (e: any) { setError(e?.response?.data?.detail || 'Preview failed') }
    setLoadingPreview(false)
  }

  const handleSave = async () => {
    setSaving(true); setError(null)
    try {
      const res = await saveClean(dataset.id, toApiOps(), saveAs || undefined)
      setSaved(res.clean_id)
      onCleanSaved(res.clean_id)
    } catch (e: any) { setError(e?.response?.data?.detail || 'Save failed') }
    setSaving(false)
  }

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <StatCard value={dataset.rows.toLocaleString()} label="Original Rows" />
        <StatCard value={preview ? preview.result_rows.toLocaleString() : '—'} label="After Clean" color="var(--accent)" />
        <StatCard value={totalNulls} label="Null Values" color={totalNulls > 0 ? 'var(--accent3)' : 'var(--accent)'} />
        <StatCard value={ops.length} label="Operations" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
        {/* Left: ops builder */}
        <div>
          <Card>
            <CardTitle>Cleaning Operations</CardTitle>

            {ops.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text3)', fontSize: 12, border: '1px dashed var(--border)', borderRadius: 8, marginBottom: 12 }}>
                No operations yet — add one below
              </div>
            )}

            {ops.map((op, i) => {
              const def = OP_DEFS.find(d => d.op === op.op)!
              return (
                <div key={op.uid} style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, marginBottom: 8, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer' }}
                    onClick={() => setOps(prev => prev.map(o => o.uid === op.uid ? { ...o, expanded: !o.expanded } : o))}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', width: 18 }}>{String(i+1).padStart(2,'0')}</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 9, padding: '2px 6px', borderRadius: 3, fontWeight: 700, background: `${op.color}22`, color: op.color }}>{op.label.toUpperCase()}</span>
                    <span style={{ fontSize: 12, color: 'var(--text2)', flex: 1 }}>{op.label}</span>
                    {def.params.length > 0 && <span style={{ color: 'var(--text3)', fontSize: 12, transition: 'transform .2s', transform: op.expanded ? 'rotate(90deg)' : 'none' }}>›</span>}
                    <button onClick={e => { e.stopPropagation(); removeOp(op.uid) }} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 13 }}>✕</button>
                  </div>
                  {op.expanded && def.params.length > 0 && (
                    <div style={{ padding: '0 12px 12px 40px', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                      {def.params.map(p => {
                        const showIf = (p as any).showIf
                        if (showIf) {
                          const [k, v] = showIf.split('=')
                          if (op.params[k] !== v) return null
                        }
                        return (
                          <FormGroup key={p.key} label={p.label} style={{ minWidth: 120, flex: 1 }}>
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
            <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.1em', fontFamily: 'var(--mono)', marginBottom: 10 }}>Add Operation</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
              {OP_DEFS.map(def => (
                <button key={def.op} onClick={() => addOp(def)} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 6, padding: '8px 10px', fontSize: 11, cursor: 'pointer', textAlign: 'left', transition: 'all .15s', fontFamily: 'var(--sans)' }}
                  onMouseOver={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
                  onMouseOut={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text2)' }}>
                  + {def.label}
                </button>
              ))}
            </div>
          </Card>

          {/* Save bar */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Input value={saveAs} onChange={e => setSaveAs(e.target.value)} placeholder={`${dataset.id}_clean`} style={{ maxWidth: 200 }} />
            <Btn variant="primary" onClick={handleSave} disabled={saving}>{saving ? '⏳ Saving…' : saved ? '✓ Saved!' : '💾 Save Dataset'}</Btn>
            <Btn variant="secondary" onClick={handlePreview} disabled={loadingPreview}>{loadingPreview ? '⏳ Loading…' : '👁 Preview'}</Btn>
          </div>

          {error && <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(255,94,125,.1)', border: '1px solid rgba(255,94,125,.3)', borderRadius: 6, color: 'var(--accent3)', fontSize: 12 }}>⚠ {error}</div>}
          {saved && <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(0,229,160,.08)', border: '1px solid rgba(0,229,160,.3)', borderRadius: 6, color: 'var(--accent)', fontSize: 12 }}>✓ Saved as "{saved}" — ready to train</div>}
        </div>

        {/* Right: column stats */}
        <div>
          <Card style={{ alignSelf: 'start' }}>
            <CardTitle>Column Stats</CardTitle>
            {(preview ? Object.entries(preview.null_counts || {}) : Object.entries(dataset.null_counts || {})).map(([col, n]) => {
              const nullN = n as number
              const total = preview ? preview.result_rows : dataset.rows
              const pct = total > 0 ? ((nullN / total) * 100).toFixed(1) : '0'
              const dtype = (dataset.dtypes || {})[col] || ''
              return (
                <div key={col} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{col}</span>
                    <span style={{ fontSize: 10, color: 'var(--text3)', background: 'var(--bg)', padding: '1px 5px', borderRadius: 3 }}>{dtype}</span>
                  </div>
                  {nullN > 0 ? (
                    <>
                      <div style={{ height: 3, background: 'var(--bg)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent3)', borderRadius: 2 }} />
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>{nullN} nulls ({pct}%)</div>
                    </>
                  ) : (
                    <div style={{ fontSize: 10, color: 'var(--accent)' }}>✓ complete</div>
                  )}
                </div>
              )
            })}
          </Card>

          {preview && (
            <Card>
              <CardTitle>Preview Result</CardTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[['Rows', preview.result_rows], ['Cols', preview.result_cols], ['Original rows', preview.original_rows], ['Removed', preview.original_rows - preview.result_rows]].map(([l, v]) => (
                  <div key={l} style={{ background: 'var(--bg3)', borderRadius: 6, padding: '8px 10px' }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 700 }}>{String(v)}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)' }}>{l}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
