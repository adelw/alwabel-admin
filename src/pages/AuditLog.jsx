import { useState, useEffect, useCallback } from 'react'
import { useStore } from '../store'
import { sb } from '../lib/supabase'
import { fieldLabel } from '../lib/auditLog'

// ══════════════════════════════════════════════════════════════
// صفحة سجل التغييرات — AuditLog.jsx
// ══════════════════════════════════════════════════════════════

const PAGE_SIZE = 50

const ACTION_META = {
  insert: { label: 'إضافة', color: '#16a34a', bg: 'rgba(22,163,74,.08)', ico: '➕' },
  update: { label: 'تعديل', color: '#2563eb', bg: 'rgba(37,99,235,.08)', ico: '✏️' },
  delete: { label: 'حذف',   color: '#dc2626', bg: 'rgba(220,38,38,.08)', ico: '🗑️' },
}

const SOURCE_META = {
  dashboard:     { label: 'لوحة التحكم', ico: '🖥️', color: '#16a34a', bg: 'rgba(22,163,74,.08)' },
  app:           { label: 'التطبيق',     ico: '📱', color: '#8b5cf6', bg: 'rgba(139,92,246,.08)' },
  whatsapp_bot:  { label: 'بوت واتساب',  ico: '🤖', color: '#25d366', bg: 'rgba(37,211,102,.08)' },
  system:        { label: 'النظام',      ico: '⚙️', color: '#6b7280', bg: 'rgba(100,100,100,.06)' },
  sql_editor:    { label: 'SQL',         ico: '🗄️', color: '#6b7280', bg: 'rgba(100,100,100,.06)' },
}

const TABLE_META = {
  members:                 { label: 'الأعضاء',      ico: '👥' },
  marriages:               { label: 'الزيجات',      ico: '💍' },
  events:                  { label: 'الفعاليات',    ico: '📅' },
  posts:                   { label: 'المنشورات',    ico: '📝' },
  post_comments:           { label: 'التعليقات',    ico: '💬' },
  tree_tags:               { label: 'التاقات',      ico: '🏷️' },
  member_tags:             { label: 'ربط تاقات',    ico: '🔗' },
  privacy_settings:        { label: 'الخصوصية',     ico: '🔒' },
  member_field_privacy:    { label: 'إخفاء حقول',   ico: '👁️' },
  member_change_requests:  { label: 'طلبات تعديل',  ico: '📋' },
  otp_codes:               { label: 'رمز تحقق',     ico: '🔑' },
}

// ── تصنيف ذكي للعملية ──
function smartAction(log) {
  // OTP = رمز تحقق (مو "إضافة")
  if (log.table_name === 'otp_codes') {
    return { label: 'رمز تحقق', color: '#d97706', bg: 'rgba(217,119,6,.08)', ico: '🔑' }
  }
  return ACTION_META[log.action] || ACTION_META.update
}

// ── ملخص ذكي ──
function smartSummary(log, memberById) {
  // لو فيه summary جاهز من الكود — استخدمه
  if (log.summary && log.actor_name) return log.summary

  const tm = TABLE_META[log.table_name] || { label: log.table_name }

  // OTP — نحاول نستخرج رقم الجوال واسم العضو
  if (log.table_name === 'otp_codes') {
    const phone = log.changes?.phone || ''
    // ابحث عن العضو بالجوال
    let memberName = ''
    if (phone) {
      const clean = phone.replace(/^\+/, '')
      const local = clean.startsWith('966') ? '0' + clean.slice(3) : clean
      // نبحث بكل الصيغ
      for (const m of (memberById ? Object.values(memberById) : [])) {
        const mp = (m?.phone || '').replace(/^\+/, '')
        if (mp === clean || mp === local || mp === phone) {
          memberName = m.full_name || m.first_name || ''
          break
        }
      }
    }
    if (memberName) return `طلب رمز تحقق: ${memberName} (${phone})`
    if (phone) return `طلب رمز تحقق: ${phone}`
    return 'طلب رمز تحقق'
  }

  // باقي الجداول — الملخص الافتراضي من الـ trigger
  if (log.summary) return log.summary
  return `${ACTION_META[log.action]?.label || log.action} في ${tm.label}`
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60)    return 'الآن'
  if (diff < 3600)  return `قبل ${Math.floor(diff/60)} د`
  if (diff < 86400) return `قبل ${Math.floor(diff/3600)} س`
  if (diff < 604800) return `قبل ${Math.floor(diff/86400)} يوم`
  return new Date(dateStr).toLocaleDateString('ar-SA', { year:'numeric', month:'short', day:'numeric' })
}

function fullDate(dateStr) {
  return new Date(dateStr).toLocaleString('ar-SA', {
    year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit',
  })
}

export default function AuditLog() {
  const { toast, members } = useStore()

  // بناء map للأعضاء بالجوال
  const memberByPhone = {}
  members.forEach(m => { if (m.phone) memberByPhone[m.phone] = m; if (m.phone) memberByPhone[m.phone.replace(/^\+/,'')] = m })

  const [logs, setLogs]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [hasMore, setHasMore]   = useState(true)
  const [page, setPage]         = useState(0)
  const [fTable, setFTable]     = useState('all')
  const [fAction, setFAction]   = useState('all')
  const [fSource, setFSource]   = useState('all')
  const [fSearch, setFSearch]   = useState('')
  const [expanded, setExpanded] = useState(null)

  const fetchLogs = useCallback(async (reset = false) => {
    const p = reset ? 0 : page
    if (reset) { setPage(0); setLogs([]) }
    setLoading(true)
    try {
      let q = sb.from('audit_logs').select('*').order('created_at', { ascending: false }).range(p * PAGE_SIZE, (p + 1) * PAGE_SIZE - 1)
      if (fTable  !== 'all') q = q.eq('table_name', fTable)
      if (fAction !== 'all') q = q.eq('action', fAction)
      if (fSource !== 'all') q = q.eq('source', fSource)
      if (fSearch.trim()) q = q.or(`summary.ilike.%${fSearch.trim()}%,actor_name.ilike.%${fSearch.trim()}%`)
      const { data, error } = await q
      if (error) throw error
      if (reset) setLogs(data || []); else setLogs(prev => [...prev, ...(data || [])])
      setHasMore((data || []).length === PAGE_SIZE)
    } catch (e) { toast('خطأ في تحميل السجل: ' + e.message, 'er') }
    setLoading(false)
  }, [page, fTable, fAction, fSource, fSearch, toast])

  useEffect(() => { fetchLogs(true) }, [fTable, fAction, fSource])
  function doSearch(e) { e.preventDefault(); fetchLogs(true) }
  function loadMore() { setPage(p => p + 1) }
  useEffect(() => { if (page > 0) fetchLogs() }, [page])

  return (
    <div>
      <div className="sh">
        <span className="sh-t">📋 سجل التغييرات</span>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <span style={{ fontSize:11, color:'var(--mu)', background:'var(--bg)', padding:'4px 10px', borderRadius:8 }}>
            {logs.length > 0 ? `${logs.length} سجل` : ''}
          </span>
          <button className="btn btn-bl btn-sm" onClick={() => fetchLogs(true)}>🔄 تحديث</button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:10, padding:'12px 0', borderBottom:'1px solid var(--br)', marginBottom:16 }}>
        <form onSubmit={doSearch} style={{ display:'flex', gap:6, flex:'1 1 250px', minWidth:200 }}>
          <div className="s-wrap" style={{ flex:1, marginBottom:0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input value={fSearch} onChange={e => setFSearch(e.target.value)} placeholder="بحث بالملخص أو اسم المعدّل..." style={{ fontSize:12.5 }} />
          </div>
          <button type="submit" className="btn btn-ok btn-sm">بحث</button>
        </form>
        <select value={fTable} onChange={e => setFTable(e.target.value)} style={{ padding:'6px 10px', borderRadius:8, border:'1px solid var(--br)', fontSize:12, fontFamily:'inherit', background:'var(--white)' }}>
          <option value="all">كل الجداول</option>
          {Object.entries(TABLE_META).map(([k,v]) => <option key={k} value={k}>{v.ico} {v.label}</option>)}
        </select>
        <select value={fAction} onChange={e => setFAction(e.target.value)} style={{ padding:'6px 10px', borderRadius:8, border:'1px solid var(--br)', fontSize:12, fontFamily:'inherit', background:'var(--white)' }}>
          <option value="all">كل العمليات</option>
          {Object.entries(ACTION_META).map(([k,v]) => <option key={k} value={k}>{v.ico} {v.label}</option>)}
        </select>
        <select value={fSource} onChange={e => setFSource(e.target.value)} style={{ padding:'6px 10px', borderRadius:8, border:'1px solid var(--br)', fontSize:12, fontFamily:'inherit', background:'var(--white)' }}>
          <option value="all">كل المصادر</option>
          {Object.entries(SOURCE_META).map(([k,v]) => <option key={k} value={k}>{v.ico} {v.label}</option>)}
        </select>
      </div>

      {/* Logs */}
      {loading && logs.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'var(--mu)' }}><div className="spinner" style={{ margin:'0 auto 12px' }} />جارٍ التحميل...</div>
      ) : logs.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'var(--mu2)' }}><div style={{ fontSize:48, marginBottom:8 }}>📋</div><div style={{ fontSize:14 }}>لا توجد سجلات</div></div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {logs.map(log => {
            const am = smartAction(log)
            const sm = SOURCE_META[log.source] || SOURCE_META.system
            const tm = TABLE_META[log.table_name] || { label: log.table_name, ico: '📄' }
            const isExp = expanded === log.id
            const changes = log.changes || {}
            const changedFields = log.action === 'update' ? Object.entries(changes) : []
            const summary = smartSummary(log, memberByPhone)

            return (
              <div key={log.id} style={{ background:'var(--white)', border:'1px solid var(--br)', borderRadius:10, overflow:'hidden', borderColor: isExp ? am.color : undefined }}>
                <div onClick={() => setExpanded(isExp ? null : log.id)}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', cursor:'pointer', transition:'background .1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

                  {/* Action */}
                  <div style={{ padding:'3px 8px', borderRadius:6, background:am.bg, color:am.color, fontSize:10.5, fontWeight:700, whiteSpace:'nowrap', minWidth:55, textAlign:'center' }}>
                    {am.ico} {am.label}
                  </div>

                  {/* Table */}
                  <div style={{ padding:'3px 8px', borderRadius:6, background:'var(--bg)', color:'var(--tx)', fontSize:10.5, fontWeight:600, whiteSpace:'nowrap' }}>
                    {tm.ico} {tm.label}
                  </div>

                  {/* Summary */}
                  <div style={{ flex:1, fontSize:12.5, fontWeight:500, color:'var(--tx)', lineHeight:1.6 }}>
                    {summary}
                  </div>

                  {/* Actor + Source */}
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2, minWidth:100 }}>
                    {log.actor_name ? (
                      <div style={{ padding:'3px 8px', borderRadius:6, background:'rgba(37,99,235,.08)', color:'#2563eb', fontSize:10.5, fontWeight:700, whiteSpace:'nowrap' }}>
                        👤 {log.actor_name}
                      </div>
                    ) : (
                      <div style={{ padding:'3px 8px', borderRadius:6, background:'rgba(100,100,100,.06)', color:'var(--mu)', fontSize:10.5, fontWeight:600, whiteSpace:'nowrap' }}>
                        ⚙️ تلقائي
                      </div>
                    )}
                    <div style={{ padding:'2px 7px', borderRadius:5, background:sm.bg, color:sm.color, fontSize:9.5, whiteSpace:'nowrap' }}>
                      {sm.ico} {sm.label}
                    </div>
                  </div>

                  {/* Time */}
                  <div style={{ fontSize:10.5, color:'var(--mu2)', whiteSpace:'nowrap', minWidth:65, textAlign:'left' }} title={fullDate(log.created_at)}>
                    {timeAgo(log.created_at)}
                  </div>

                  <div style={{ fontSize:11, color:'var(--mu)', transition:'transform .2s', transform: isExp ? 'rotate(180deg)' : '' }}>▼</div>
                </div>

                {/* Expanded */}
                {isExp && (
                  <div style={{ padding:'12px 14px 14px', borderTop:'1px solid var(--br)', background:'var(--bg)', fontSize:12 }}>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:16, marginBottom:12, color:'var(--mu)' }}>
                      <div>📅 {fullDate(log.created_at)}</div>
                      {log.actor_name && <div>👤 المعدّل: <strong style={{ color:'var(--tx)' }}>{log.actor_name}</strong></div>}
                      <div>📍 المصدر: <strong style={{ color:'var(--tx)' }}>{sm.label}</strong></div>
                      <div style={{ fontSize:10, color:'var(--mu2)', fontFamily:'monospace' }}>ID: {log.record_id?.substring(0,8)}...</div>
                    </div>

                    {log.action === 'update' && changedFields.length > 0 && (
                      <div>
                        <div style={{ fontSize:11, fontWeight:700, color:'var(--mu)', marginBottom:8 }}>التغييرات:</div>
                        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                          {changedFields.map(([field, vals]) => (
                            <div key={field} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:8, background:'var(--white)', border:'1px solid var(--br)' }}>
                              <div style={{ fontWeight:700, color:'var(--tx)', minWidth:90, fontSize:11.5 }}>{fieldLabel(field)}</div>
                              <div style={{ padding:'2px 8px', borderRadius:5, background:'rgba(220,38,38,.06)', color:'#dc2626', fontSize:11, textDecoration:'line-through', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis' }}>
                                {vals.old === 'null' || vals.old === null ? '—' : String(vals.old)}
                              </div>
                              <div style={{ color:'var(--mu)', fontSize:13 }}>→</div>
                              <div style={{ padding:'2px 8px', borderRadius:5, background:'rgba(22,163,74,.06)', color:'#16a34a', fontSize:11, fontWeight:600, maxWidth:200, overflow:'hidden', textOverflow:'ellipsis' }}>
                                {vals.new === 'null' || vals.new === null ? '—' : String(vals.new)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {log.action === 'insert' && log.table_name !== 'otp_codes' && (
                      <div>
                        <div style={{ fontSize:11, fontWeight:700, color:'var(--mu)', marginBottom:8 }}>البيانات المضافة:</div>
                        <pre style={{ padding:10, borderRadius:8, background:'var(--white)', border:'1px solid var(--br)', fontSize:10.5, lineHeight:1.6, direction:'ltr', textAlign:'left', maxHeight:200, overflow:'auto', whiteSpace:'pre-wrap' }}>
                          {JSON.stringify(changes, null, 2)}
                        </pre>
                      </div>
                    )}

                    {log.action === 'insert' && log.table_name === 'otp_codes' && (
                      <div style={{ display:'flex', gap:16, color:'var(--mu)' }}>
                        <div>📱 الجوال: <strong style={{ color:'var(--tx)' }}>{changes.phone || '—'}</strong></div>
                        <div>⏰ الصلاحية: <strong style={{ color:'var(--tx)' }}>{changes.expires_at ? new Date(changes.expires_at).toLocaleTimeString('ar-SA') : '—'}</strong></div>
                      </div>
                    )}

                    {log.action === 'delete' && (
                      <div>
                        <div style={{ fontSize:11, fontWeight:700, color:'#dc2626', marginBottom:8 }}>البيانات المحذوفة:</div>
                        <pre style={{ padding:10, borderRadius:8, background:'rgba(220,38,38,.03)', border:'1px solid rgba(220,38,38,.12)', fontSize:10.5, lineHeight:1.6, direction:'ltr', textAlign:'left', maxHeight:200, overflow:'auto', whiteSpace:'pre-wrap' }}>
                          {JSON.stringify(changes, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          {hasMore && (
            <div style={{ textAlign:'center', padding:16 }}>
              <button className="btn btn-bl" onClick={loadMore} disabled={loading}>
                {loading ? '⏳ جارٍ التحميل...' : '📄 تحميل المزيد'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// مكوّن سجل العضو — يُستخدم داخل MemberProfile
// ══════════════════════════════════════════════════════════════
export function MemberAuditLog({ memberId }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    if (!memberId) return
    setLoading(true)
    sb.from('audit_logs')
      .select('*')
      .eq('record_id', memberId)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => { setLogs(data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [memberId])

  if (loading) return <div style={{ padding:16, textAlign:'center', color:'var(--mu)', fontSize:12 }}>جارٍ التحميل...</div>
  if (logs.length === 0) return <div style={{ padding:16, textAlign:'center', color:'var(--mu2)', fontSize:12 }}>لا توجد سجلات لهذا العضو</div>

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
      {logs.map(log => {
        const am = smartAction(log)
        const sm = SOURCE_META[log.source] || SOURCE_META.system
        const isExp = expanded === log.id
        const changes = log.changes || {}
        const changedFields = log.action === 'update' ? Object.entries(changes) : []

        return (
          <div key={log.id} style={{ background:'var(--bg)', borderRadius:8, overflow:'hidden', border: isExp ? `1px solid ${am.color}` : '1px solid transparent' }}>
            <div onClick={() => setExpanded(isExp ? null : log.id)}
              style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', cursor:'pointer', fontSize:11.5 }}>
              <span style={{ color:am.color, fontWeight:700, fontSize:10 }}>{am.ico} {am.label}</span>
              <span style={{ flex:1, color:'var(--tx)' }}>{log.summary || `${am.label}`}</span>
              {log.actor_name && <span style={{ color:'#2563eb', fontSize:10, fontWeight:600 }}>👤 {log.actor_name}</span>}
              <span style={{ color:sm.color, fontSize:9.5 }}>{sm.ico}</span>
              <span style={{ color:'var(--mu2)', fontSize:10 }}>{timeAgo(log.created_at)}</span>
              <span style={{ fontSize:9, color:'var(--mu)', transform: isExp?'rotate(180deg)':'', transition:'transform .2s' }}>▼</span>
            </div>
            {isExp && changedFields.length > 0 && (
              <div style={{ padding:'6px 10px 10px', borderTop:'1px solid var(--br)' }}>
                {changedFields.map(([field, vals]) => (
                  <div key={field} style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 0', fontSize:11 }}>
                    <strong style={{ minWidth:80 }}>{fieldLabel(field)}</strong>
                    <span style={{ color:'#dc2626', textDecoration:'line-through' }}>{vals.old === 'null' || vals.old === null ? '—' : String(vals.old)}</span>
                    <span style={{ color:'var(--mu)' }}>→</span>
                    <span style={{ color:'#16a34a', fontWeight:600 }}>{vals.new === 'null' || vals.new === null ? '—' : String(vals.new)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
