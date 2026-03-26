import { useState, useEffect, useCallback } from 'react'
import { sb } from '../lib/supabase'
import { useStore } from '../store'

const FIELD_LABELS = {
  first_name: 'الاسم الأول',
  full_name: 'الاسم الكامل',
  phone: 'رقم الجوال',
  email: 'البريد الإلكتروني',
  city: 'المدينة',
  job: 'الوظيفة',
  birth_date: 'تاريخ الميلاد',
  notes: 'الملاحظات',
  add_child: 'إضافة ابن/بنت',
  add_sibling: 'إضافة أخ/أخت',
  add_mother: 'إضافة أم',
  add_spouse: 'إضافة زوج/زوجة',
  hide_field: 'إخفاء حقل',
  show_field: 'إظهار حقل',
}

const GENDER_LABELS = { M: 'ذكور', F: 'إناث', all: 'الكل' }
const GENDER_ICONS = { M: '♂️', F: '♀️', all: '👥' }
const GENDER_COLORS = { M: '#1B4332', F: '#C9A84C', all: '#3B82F6' }

const CATEGORIES = [
  { key: 'basic', label: 'البيانات الأساسية', fields: ['first_name', 'full_name'] },
  { key: 'extra', label: 'البيانات الإضافية', fields: ['phone', 'email', 'city', 'job', 'birth_date', 'notes'] },
  { key: 'ops', label: 'العمليات', fields: ['add_child', 'add_sibling', 'add_mother', 'add_spouse'] },
  { key: 'privacy', label: 'طلبات الخصوصية', fields: ['hide_field', 'show_field'] },
]

export default function ApprovalSettings() {
  const { toast } = useStore()
  const [settings, setSettings] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await sb.from('field_approval_settings').select().order('field_name')
      if (error) throw error
      setSettings(data || [])
    } catch (e) {
      toast('خطأ: ' + e.message, 'er')
    }
    setLoading(false)
  }, [toast])

  useEffect(() => { load() }, [load])

  const toggle = async (id, newVal) => {
    setBusy(id)
    const prev = [...settings]
    setSettings(s => s.map(r => r.id === id ? { ...r, requires_approval: newVal } : r))
    try {
      const { error } = await sb.from('field_approval_settings').update({
        requires_approval: newVal,
        updated_at: new Date().toISOString(),
      }).eq('id', id)
      if (error) throw error
      toast(newVal ? '🔒 تم تفعيل شرط الموافقة' : '✅ تم إلغاء شرط الموافقة — يتطبق تلقائي', 'ok')
    } catch (e) {
      setSettings(prev)
      toast('فشل: ' + e.message, 'er')
    }
    setBusy(null)
  }

  const getCategory = (fieldName) => {
    for (const cat of CATEGORIES) {
      if (cat.fields.includes(fieldName)) return cat.key
    }
    return 'other'
  }

  const grouped = {}
  for (const cat of CATEGORIES) grouped[cat.key] = []
  for (const s of settings) {
    const catKey = getCategory(s.field_name)
    if (grouped[catKey]) grouped[catKey].push(s)
  }

  // عدد المفعّلة
  const activeCount = settings.filter(s => s.requires_approval).length

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: '#1a1a2e' }}>
          ⚙️ إعدادات الموافقة على التعديلات
        </h2>
        <p style={{ fontSize: 13, color: '#6b7280', margin: '6px 0 0' }}>
          تحكّم بالحقول اللي تحتاج موافقتك قبل التطبيق
        </p>
      </div>

      {/* ملخص */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: 20,
        padding: 16, borderRadius: 14, background: '#f0fdf4', border: '1px solid #bbf7d0',
      }}>
        <div style={{ fontSize: 28 }}>📋</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#166534' }}>
            {activeCount === 0
              ? 'كل التعديلات تلقائية'
              : `${activeCount} إعداد يحتاج موافقتك`}
          </div>
          <div style={{ fontSize: 11, color: '#4ade80', marginTop: 2 }}>
            الافتراضي: تلقائي بدون موافقة — فعّل الموافقة للحقول اللي تبي تراجعها
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ width: 24, height: 24, border: '2px solid #C9A84C', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
        </div>
      ) : (
        CATEGORIES.map(cat => {
          const items = grouped[cat.key] || []
          if (items.length === 0) return null
          const catActive = items.filter(s => s.requires_approval).length

          return (
            <div key={cat.key} style={{ marginBottom: 24 }}>
              {/* عنوان الفئة */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                marginBottom: 10, paddingBottom: 6,
                borderBottom: '2px solid #e5e7eb',
              }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#1a1a2e' }}>{cat.label}</span>
                {catActive > 0 && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px',
                    borderRadius: 10, background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa',
                  }}>
                    {catActive} يحتاج موافقة
                  </span>
                )}
              </div>

              {/* الإعدادات */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {items.map(s => {
                  const isActive = s.requires_approval
                  const isBusy = busy === s.id
                  return (
                    <div key={s.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 14px', borderRadius: 12,
                      background: isActive ? '#fff7ed' : '#fff',
                      border: `1px solid ${isActive ? '#fed7aa' : '#e5e7eb'}`,
                      transition: 'all 0.2s',
                    }}>
                      {/* أيقونة الجنس */}
                      <span style={{
                        width: 32, height: 32, borderRadius: 8,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 16, flexShrink: 0,
                        background: GENDER_COLORS[s.gender] + '15',
                      }}>
                        {GENDER_ICONS[s.gender]}
                      </span>

                      {/* النص */}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>
                          {FIELD_LABELS[s.field_name] || s.field_name}
                        </div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>
                          {GENDER_LABELS[s.gender]} — {isActive ? '🔒 يحتاج موافقة' : '✅ تلقائي'}
                        </div>
                      </div>

                      {/* Toggle */}
                      <button
                        disabled={isBusy}
                        onClick={() => toggle(s.id, !isActive)}
                        style={{
                          width: 44, height: 24, borderRadius: 12, border: 'none',
                          background: isActive ? '#f97316' : '#d1d5db',
                          position: 'relative', cursor: isBusy ? 'not-allowed' : 'pointer',
                          transition: 'background 0.2s', opacity: isBusy ? 0.5 : 1,
                        }}
                      >
                        <span style={{
                          position: 'absolute', top: 3,
                          width: 18, height: 18, borderRadius: 9,
                          background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                          transition: 'right 0.2s, left 0.2s',
                          ...(isActive
                            ? { right: 3, left: 'auto' }
                            : { left: 3, right: 'auto' }),
                        }} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
