import { useState, useEffect, useCallback } from 'react'
import { useStore } from '../store'
import { sb, now } from '../lib/supabase'

// ═══════════════════════════════════════════════════════════════
// صفحة الخصوصية — لوحة تحكم الوابل
// 3 تبويبات: إعدادات عامة · إخفاء فردي · طبقات
// ═══════════════════════════════════════════════════════════════

const TABS = [
  { key: 'global',     label: 'إعدادات عامة',    ico: '⚙️' },
  { key: 'individual', label: 'إخفاء فردي',      ico: '👤' },
  { key: 'layers',     label: 'طبقات الخصوصية',  ico: '🛡️' },
]

const SETTING_META = {
  show_phone:            { label: 'إظهار رقم الجوال',       ico: '📱', desc: 'عرض رقم الجوال في بطاقة العضو' },
  show_email:            { label: 'إظهار البريد الإلكتروني', ico: '📧', desc: 'عرض البريد الإلكتروني' },
  show_city:             { label: 'إظهار المدينة',           ico: '🏙️', desc: 'عرض مدينة الإقامة' },
  show_job:              { label: 'إظهار الوظيفة',           ico: '💼', desc: 'عرض الوظيفة' },
  show_birth_date:       { label: 'إظهار تاريخ الميلاد',     ico: '🎂', desc: 'عرض تاريخ الميلاد' },
  show_photo:            { label: 'إظهار الصورة',            ico: '📷', desc: 'عرض الصورة الشخصية' },
  show_notes:            { label: 'إظهار الملاحظات',          ico: '📝', desc: 'عرض الملاحظات الإضافية' },
  hide_daughter_lineage: { label: 'إخفاء ذرية البنات',       ico: '👨‍👩‍👧', desc: 'إخفاء ذرية البنت المتزوجة خارج العائلة' },
  allow_self_hiding:     { label: 'السماح بالإخفاء الذاتي',  ico: '🙈', desc: 'السماح للأعضاء بإخفاء بياناتهم' },
}

const FIELD_DEFS = [
  { key: 'phone',      label: 'رقم الجوال',       ico: '📱' },
  { key: 'email',      label: 'البريد الإلكتروني', ico: '📧' },
  { key: 'city',       label: 'المدينة',           ico: '🏙️' },
  { key: 'job',        label: 'الوظيفة',           ico: '💼' },
  { key: 'birth_date', label: 'تاريخ الميلاد',     ico: '🎂' },
  { key: 'photo',      label: 'الصورة الشخصية',    ico: '📷' },
  { key: 'notes',      label: 'الملاحظات',          ico: '📝' },
]

const LAYERS = [
  { ico: '🌐', title: 'إعدادات عامة',      desc: 'تتحكم في إظهار/إخفاء الحقول لجميع الأعضاء',       clr: 'var(--bl)' },
  { ico: '👤', title: 'إخفاء فردي',        desc: 'الأدمن يخفي حقل معين لعضو محدد',                  clr: 'var(--or)' },
  { ico: '🙈', title: 'إخفاء ذاتي',        desc: 'العضو يخفي حقوله بنفسه من إعدادات التطبيق',        clr: 'var(--tl)' },
  { ico: '👨‍👩‍👧', title: 'إخفاء ذرية البنات', desc: 'إخفاء ذرية البنت المتزوجة خارج العائلة عبر tree_tags', clr: 'var(--rd)' },
]

const DB_TABLES = [
  { table: 'privacy_settings',          desc: 'الإعدادات العامة (show_phone, show_email...)' },
  { table: 'member_field_privacy',       desc: 'إخفاء فردي لحقول عضو معين' },
  { table: 'member_self_hidden_fields',  desc: 'الحقول اللي خفّاها العضو بنفسه' },
  { table: 'tree_tags',                  desc: 'تاقات الشجرة + hide_daughter_lineage' },
  { table: 'members_safe (View)',        desc: 'View يطبّق كل طبقات الإخفاء تلقائياً' },
]


// ─── Toggle ────────────────────────────────────────────────────
function Toggle({ on, onChange, busy }) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => onChange(!on)}
      className={busy ? 'toggle busy' : 'toggle'}
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none',
        background: on ? 'var(--gr)' : 'var(--br2)',
        position: 'relative', cursor: busy ? 'not-allowed' : 'pointer',
        transition: 'background .2s', opacity: busy ? .5 : 1,
      }}
    >
      <span style={{
        position: 'absolute', top: 3, width: 18, height: 18, borderRadius: 9,
        background: '#fff', boxShadow: 'var(--sh-xs)', transition: 'right .2s, left .2s',
        ...(on ? { left: 3, right: 'auto' } : { right: 3, left: 'auto' }),
      }} />
    </button>
  )
}


// ═══════════════════════════════════════════════════════════════
// Privacy Page (main)
// ═══════════════════════════════════════════════════════════════
export default function Privacy() {
  const { members, toast, user } = useStore()
  const [tab, setTab] = useState('global')

  // Global settings state
  const [settings, setSettings] = useState([])
  const [loading, setLoading]   = useState(true)
  const [busy, setBusy]         = useState(null)

  // Individual state
  const [selMember, setSelMember] = useState(null)
  const [memberFields, setMemberFields] = useState({})
  const [mfLoading, setMfLoading] = useState(false)
  const [search, setSearch] = useState('')

  // ─── Load Global Settings ────────────────────────────────────
  const loadSettings = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await sb.from('privacy_settings').select('*').order('setting_key')
      if (error) throw error
      setSettings(data || [])
    } catch (e) {
      toast('خطأ في تحميل الإعدادات: ' + e.message, 'er')
    }
    setLoading(false)
  }, [toast])

  useEffect(() => { loadSettings() }, [loadSettings])

  // ─── Toggle Global ───────────────────────────────────────────
  const toggleGlobal = async (key, enabled) => {
    setBusy(key)
    const prev = settings.map(s => ({ ...s }))
    setSettings(ss => ss.map(s => s.setting_key === key ? { ...s, enabled } : s))
    try {
      const { error } = await sb.from('privacy_settings')
        .update({ enabled, updated_by: user?.id, updated_at: now() })
        .eq('setting_key', key)
      if (error) throw error
      toast('✅ تم تحديث الإعداد', 'ok')
    } catch (e) {
      setSettings(prev)
      toast('فشل: ' + e.message, 'er')
    }
    setBusy(null)
  }

  // ─── Load Member Fields ──────────────────────────────────────
  const loadMemberFields = async (memberId) => {
    setMfLoading(true)
    try {
      const { data, error } = await sb.from('member_field_privacy')
        .select('field_name, hidden')
        .eq('member_id', memberId)
      if (error) throw error
      const map = {}
      ;(data || []).forEach(r => map[r.field_name] = r.hidden)
      setMemberFields(map)
    } catch (e) {
      toast('خطأ: ' + e.message, 'er')
    }
    setMfLoading(false)
  }

  const toggleMemberField = async (fieldName, hidden) => {
    if (!selMember) return
    const prev = { ...memberFields }
    setMemberFields(mf => {
      const next = { ...mf }
      if (hidden) next[fieldName] = true; else delete next[fieldName]
      return next
    })
    try {
      if (hidden) {
        const { error } = await sb.from('member_field_privacy').upsert({
          member_id: selMember.id, field_name: fieldName, hidden: true, hidden_by: user?.id,
        })
        if (error) throw error
      } else {
        const { error } = await sb.from('member_field_privacy')
          .delete().eq('member_id', selMember.id).eq('field_name', fieldName)
        if (error) throw error
      }
      toast(hidden ? '🔒 تم إخفاء الحقل' : '👁️ تم إظهار الحقل', 'ok')
    } catch (e) {
      setMemberFields(prev)
      toast('فشل: ' + e.message, 'er')
    }
  }

  const selectMember = (m) => {
    setSelMember(m)
    if (m) loadMemberFields(m.id)
    else setMemberFields({})
  }

  // ─── Filtered members for search ────────────────────────────
  const filtered = search.trim()
    ? members.filter(m => (m.full_name || m.first_name || '').includes(search.trim())).slice(0, 15)
    : []

  // ─── Stats ───────────────────────────────────────────────────
  const enabledCount  = settings.filter(s => s.enabled).length
  const disabledCount = settings.filter(s => !s.enabled).length
  const hiddenFieldCount = Object.values(memberFields).filter(Boolean).length

  return (
    <div>
      {/* Stat Cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card" style={{ '--stat-color': 'var(--gr)' }}>
          <div className="stat-icon" style={{ background: 'var(--grl)' }}>🟢</div>
          <div>
            <div className="stat-val">{enabledCount}</div>
            <div className="stat-lbl">مفعّل</div>
          </div>
        </div>
        <div className="stat-card" style={{ '--stat-color': 'var(--rd)' }}>
          <div className="stat-icon" style={{ background: 'var(--rdl)' }}>🔴</div>
          <div>
            <div className="stat-val">{disabledCount}</div>
            <div className="stat-lbl">معطّل</div>
          </div>
        </div>
        <div className="stat-card" style={{ '--stat-color': 'var(--ac)' }}>
          <div className="stat-icon" style={{ background: 'var(--ac-soft)' }}>🛡️</div>
          <div>
            <div className="stat-val">4</div>
            <div className="stat-lbl">طبقات حماية</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{
          display: 'flex', borderBottom: '1.5px solid var(--br)',
          background: 'var(--card2)',
        }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flex: 1, padding: '14px 0', fontSize: 13, fontWeight: tab === t.key ? 800 : 500,
                color: tab === t.key ? 'var(--ac)' : 'var(--mu)',
                background: 'transparent', border: 'none', cursor: 'pointer',
                borderBottom: tab === t.key ? '2.5px solid var(--ac)' : '2.5px solid transparent',
                transition: 'all .15s',
              }}
            >
              {t.ico} {t.label}
            </button>
          ))}
        </div>

        <div style={{ padding: 20 }}>
          {/* ═══ Tab: إعدادات عامة ═══ */}
          {tab === 'global' && (
            loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--mu)' }}>
                <div className="spinner" style={{ margin: '0 auto 12px' }} />
                جارٍ التحميل...
              </div>
            ) : settings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--mu2)' }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>🛡️</div>
                <div style={{ fontSize: 14 }}>لا توجد إعدادات — أضفها في <code>privacy_settings</code></div>
              </div>
            ) : (
              <div>
                {/* تنبيه */}
                <div style={{
                  background: 'var(--orl)', border: '1px solid rgba(217,119,6,.15)',
                  borderRadius: 'var(--r-sm)', padding: '10px 14px', marginBottom: 16,
                  display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--or2)',
                }}>
                  ⚠️ هذه الإعدادات تؤثر على <strong style={{ margin: '0 3px' }}>جميع المستخدمين</strong>. التغييرات تُطبّق فوراً.
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {settings.map(s => {
                    const meta = SETTING_META[s.setting_key] || { label: s.setting_key, ico: '⚙️', desc: '' }
                    return (
                      <div key={s.setting_key} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 14px', borderRadius: 'var(--r-sm)',
                        background: 'var(--white)', border: '1px solid var(--br)',
                        transition: 'border-color .15s',
                      }}>
                        <div style={{
                          width: 38, height: 38, borderRadius: 10,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 18, background: s.enabled ? 'var(--grl)' : 'var(--bg2)', flexShrink: 0,
                        }}>
                          {meta.ico}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--tx)' }}>{meta.label}</div>
                          <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 1 }}>{meta.desc}</div>
                        </div>
                        <Toggle on={s.enabled} busy={busy === s.setting_key} onChange={v => toggleGlobal(s.setting_key, v)} />
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          )}

          {/* ═══ Tab: إخفاء فردي ═══ */}
          {tab === 'individual' && (
            <div>
              {!selMember ? (
                <>
                  {/* بحث */}
                  <div className="fg" style={{ marginBottom: 12 }}>
                    <label>ابحث عن عضو</label>
                    <input
                      className="fi"
                      placeholder="اكتب اسم العضو..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />
                  </div>

                  {!search.trim() && (
                    <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--mu2)', fontSize: 13 }}>
                      👆 ابحث عن عضو لإدارة حقوله المخفية
                    </div>
                  )}

                  {filtered.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {filtered.map(m => (
                        <button
                          key={m.id}
                          onClick={() => { selectMember(m); setSearch('') }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 12px', borderRadius: 'var(--r-sm)',
                            background: 'var(--white)', border: '1px solid var(--br)',
                            cursor: 'pointer', transition: 'border-color .15s', textAlign: 'right',
                            width: '100%',
                          }}
                          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--ac)'}
                          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--br)'}
                        >
                          <div style={{
                            width: 36, height: 36, borderRadius: '50%',
                            background: m.gender === 'F' ? 'var(--pil)' : 'var(--bll)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 16, flexShrink: 0,
                          }}>
                            {m.gender === 'F' ? '👩' : '👨'}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)' }}>
                              {m.full_name || m.first_name}
                            </div>
                            <div style={{ fontSize: 10.5, color: 'var(--mu)' }}>
                              {[m.branch && `فرع ${m.branch}`, m.city].filter(Boolean).join(' · ')}
                            </div>
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--mu2)' }}>←</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {search.trim() && filtered.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 20, color: 'var(--mu2)', fontSize: 12 }}>
                      لا توجد نتائج لـ "{search}"
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* العضو المحدد */}
                  <div style={{
                    background: 'var(--sb)', color: '#fff', borderRadius: 'var(--r-sm)',
                    padding: '14px 16px', marginBottom: 16,
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%',
                      background: 'rgba(255,255,255,.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18,
                    }}>
                      {selMember.gender === 'F' ? '👩' : '👨'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{selMember.full_name || selMember.first_name}</div>
                      <div style={{ fontSize: 11, opacity: .6 }}>
                        {[selMember.branch && `فرع ${selMember.branch}`, selMember.city].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <button
                      className="btn btn-sm"
                      style={{ background: 'rgba(255,255,255,.12)', color: '#fff' }}
                      onClick={() => selectMember(null)}
                    >
                      ✕ تغيير
                    </button>
                  </div>

                  {/* إحصائية */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                    <div style={{
                      flex: 1, background: 'var(--grl)', borderRadius: 'var(--r-xs)',
                      padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--gr2)',
                    }}>
                      👁️ {FIELD_DEFS.length - hiddenFieldCount} مرئي
                    </div>
                    <div style={{
                      flex: 1, background: 'var(--rdl)', borderRadius: 'var(--r-xs)',
                      padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--rd2)',
                    }}>
                      🔒 {hiddenFieldCount} مخفي
                    </div>
                  </div>

                  {mfLoading ? (
                    <div style={{ textAlign: 'center', padding: 30, color: 'var(--mu)' }}>
                      <div className="spinner" style={{ margin: '0 auto 8px' }} />
                      جارٍ التحميل...
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {FIELD_DEFS.map(f => {
                        const isHidden = memberFields[f.key] === true
                        return (
                          <div key={f.key} style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 14px', borderRadius: 'var(--r-sm)',
                            background: isHidden ? 'var(--rdl)' : 'var(--white)',
                            border: `1px solid ${isHidden ? 'rgba(220,38,38,.15)' : 'var(--br)'}`,
                            transition: 'all .15s',
                          }}>
                            <span style={{ fontSize: 16 }}>{f.ico}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span style={{
                                fontSize: 13, fontWeight: 600,
                                color: isHidden ? 'var(--rd)' : 'var(--tx)',
                                textDecoration: isHidden ? 'line-through' : 'none',
                              }}>
                                {f.label}
                              </span>
                            </div>
                            {isHidden && (
                              <span className="badge b-rejected" style={{ fontSize: 9.5 }}>مخفي</span>
                            )}
                            <Toggle on={!isHidden} onChange={v => toggleMemberField(f.key, !v)} />
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ═══ Tab: طبقات الخصوصية ═══ */}
          {tab === 'layers' && (
            <div>
              <p style={{ fontSize: 13, color: 'var(--mu)', marginBottom: 16, lineHeight: 1.7 }}>
                نظام الخصوصية يعمل بـ <strong style={{ color: 'var(--tx)' }}>4 طبقات</strong> مرتبة حسب الأولوية. الطبقة الأعلى تتجاوز الأدنى.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                {LAYERS.map((l, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '14px 16px', borderRadius: 'var(--r-sm)',
                    background: 'var(--white)', border: '1px solid var(--br)',
                  }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 20, background: `color-mix(in srgb, ${l.clr} 10%, transparent)`,
                    }}>
                      {l.ico}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 6,
                          background: `color-mix(in srgb, ${l.clr} 12%, transparent)`,
                          color: l.clr,
                        }}>
                          طبقة {i + 1}
                        </span>
                        <span style={{ fontSize: 13.5, fontWeight: 800, color: l.clr }}>{l.title}</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--mu)', lineHeight: 1.6 }}>{l.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* جداول Supabase */}
              <div style={{
                borderRadius: 'var(--r-sm)', overflow: 'hidden',
                border: '1px solid var(--br)',
              }}>
                <div style={{
                  background: 'var(--sb)', color: '#fff',
                  padding: '10px 16px', fontSize: 13, fontWeight: 700,
                }}>
                  🗄️ جداول Supabase المرتبطة
                </div>
                {DB_TABLES.map((row, i) => (
                  <div key={i} style={{
                    padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10,
                    borderTop: i > 0 ? '1px solid var(--br)' : 'none',
                    background: i % 2 === 0 ? 'var(--white)' : 'var(--card2)',
                  }}>
                    <code style={{
                      fontSize: 11, background: 'var(--bg2)', color: 'var(--tx2)',
                      padding: '3px 8px', borderRadius: 6, fontWeight: 600,
                      whiteSpace: 'nowrap', flexShrink: 0,
                    }}>
                      {row.table}
                    </code>
                    <span style={{ fontSize: 11.5, color: 'var(--mu)' }}>{row.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
