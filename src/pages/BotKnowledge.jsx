import { useState, useEffect } from 'react'
import { sb } from '../lib/supabase'
import { useStore } from '../store'
import { Modal } from '../components/UI'

const CATEGORIES = [
  { value: 'عام', label: 'عام', icon: '📄' },
  { value: 'تاريخ', label: 'تاريخ', icon: '📜' },
  { value: 'شخصيات', label: 'شخصيات', icon: '👤' },
  { value: 'أماكن', label: 'أماكن', icon: '📍' },
  { value: 'مناسبات', label: 'مناسبات', icon: '🎉' },
  { value: 'مالية', label: 'مالية', icon: '💰' },
  { value: 'قواعد', label: 'قواعد', icon: '📋' },
]

export default function BotKnowledge() {
  const { toast, showLoad, hideLoad, showConfirm } = useStore()

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('الكل')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null) // null | 'new' | item

  // ── Form state ──
  const [fQuestion, setFQuestion] = useState('')
  const [fAnswer, setFAnswer] = useState('')
  const [fCategory, setFCategory] = useState('عام')
  const [fKeywords, setFKeywords] = useState('')
  const [fPriority, setFPriority] = useState(5)

  // ── Load ──
  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data, error } = await sb
      .from('bot_knowledge')
      .select('*')
      .eq('is_active', true)
      .order('priority')
      .order('created_at', { ascending: false })
    setLoading(false)
    if (error) return toast('خطأ: ' + error.message, 'er')
    setItems(data || [])
  }

  // ── Filter + Search ──
  const filtered = items.filter(k => {
    if (filter !== 'الكل' && k.category !== filter) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      return (k.question || '').toLowerCase().includes(q) ||
             (k.answer || '').toLowerCase().includes(q) ||
             (k.keywords || '').toLowerCase().includes(q)
    }
    return true
  })

  // ── Open Modal ──
  function openNew() {
    setFQuestion(''); setFAnswer(''); setFCategory('عام'); setFKeywords(''); setFPriority(5)
    setModal('new')
  }

  function openEdit(item) {
    setFQuestion(item.question || ''); setFAnswer(item.answer || '')
    setFCategory(item.category || 'عام'); setFKeywords(item.keywords || '')
    setFPriority(item.priority || 5)
    setModal(item)
  }

  // ── Save ──
  async function save() {
    if (!fAnswer.trim()) return toast('لازم تكتب الجواب/المعلومة', 'er')

    showLoad('جارٍ الحفظ...')
    const payload = {
      question: fQuestion.trim() || null,
      answer: fAnswer.trim(),
      category: fCategory,
      keywords: fKeywords.trim(),
      priority: fPriority,
    }

    try {
      if (modal === 'new') {
        payload.is_active = true
        const { error } = await sb.from('bot_knowledge').insert(payload)
        if (error) throw error
        toast('✅ تم إضافة المعلومة', 'ok')
      } else {
        payload.updated_at = new Date().toISOString()
        const { error } = await sb.from('bot_knowledge').update(payload).eq('id', modal.id)
        if (error) throw error
        toast('✅ تم التحديث', 'ok')
      }
      setModal(null)
      await loadData()
    } catch (e) {
      toast('خطأ: ' + e.message, 'er')
    } finally { hideLoad() }
  }

  // ── Delete ──
  function deleteItem(item) {
    const preview = item.question || item.answer.slice(0, 50)
    showConfirm('🗑️', 'حذف المعلومة', `حذف "${preview}"؟`, async () => {
      showLoad('جارٍ الحذف...')
      try {
        const { error } = await sb.from('bot_knowledge').update({ is_active: false }).eq('id', item.id)
        if (error) throw error
        setItems(prev => prev.filter(k => k.id !== item.id))
        toast('✅ تم الحذف', 'ok')
      } catch (e) { toast('خطأ: ' + e.message, 'er') }
      finally { hideLoad() }
    })
  }

  // ── Category badge ──
  const catInfo = (cat) => CATEGORIES.find(c => c.value === cat) || CATEGORIES[0]

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div className="sh" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="sh-t">🧠 ذاكرة البوت ({items.length} معلومة)</span>
        <button className="btn btn-ok" onClick={openNew}>➕ إضافة معلومة</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Category filter */}
        {['الكل', ...CATEGORIES.map(c => c.value)].map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            style={{
              padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: filter === cat ? '2px solid var(--ac)' : '1px solid var(--bg3)',
              background: filter === cat ? 'var(--pul)' : 'var(--bg)',
              color: filter === cat ? 'var(--ac)' : 'var(--mu)',
            }}
          >
            {cat === 'الكل' ? '📋 الكل' : `${catInfo(cat).icon} ${cat}`}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="s-wrap" style={{ marginBottom: 16 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--mu2)" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث في المعلومات..." />
        {search && <button onClick={() => setSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--mu2)', fontSize: 14 }}>✕</button>}
      </div>

      {/* Items */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--mu)', padding: 40 }}>جارٍ التحميل...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--mu)', padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🧠</div>
          {items.length === 0 ? 'ما فيه معلومات بعد. أضف أول معلومة!' : 'ما فيه نتائج للبحث.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(item => {
            const ci = catInfo(item.category)
            return (
              <div key={item.id} style={{
                background: 'var(--bg)', borderRadius: 12, padding: '14px 16px',
                border: '1px solid var(--bg3)', transition: 'all .15s',
              }}>
                {/* Top row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{
                      padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                      background: 'var(--pul)', color: 'var(--ac)',
                    }}>
                      {ci.icon} {item.category}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--mu2)' }}>
                      أولوية: {item.priority}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-bl btn-xs" onClick={() => openEdit(item)} title="تعديل">✏️</button>
                    <button className="btn btn-er btn-xs" onClick={() => deleteItem(item)} title="حذف">🗑️</button>
                  </div>
                </div>

                {/* Question */}
                {item.question && (
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)', marginBottom: 4 }}>
                    س: {item.question}
                  </div>
                )}

                {/* Answer */}
                <div style={{ fontSize: 13, color: 'var(--fg)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {item.answer}
                </div>

                {/* Keywords */}
                {item.keywords && (
                  <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {item.keywords.split(',').map((kw, i) => (
                      <span key={i} style={{
                        padding: '1px 8px', borderRadius: 10, fontSize: 10,
                        background: 'var(--bg2)', color: 'var(--mu)',
                      }}>
                        {kw.trim()}
                      </span>
                    ))}
                  </div>
                )}

                {/* Date */}
                <div style={{ fontSize: 10, color: 'var(--mu2)', marginTop: 6 }}>
                  {new Date(item.created_at).toLocaleDateString('ar-SA')}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <Modal
          title={modal === 'new' ? '➕ إضافة معلومة للبوت' : '✏️ تعديل المعلومة'}
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn btn-gh" onClick={() => setModal(null)}>إلغاء</button>
              <button className="btn btn-ok" style={{ fontWeight: 800 }} onClick={save}>
                {modal === 'new' ? '➕ إضافة' : '💾 حفظ'}
              </button>
            </>
          }
        >
          {/* Category */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--mu)', display: 'block', marginBottom: 6 }}>التصنيف</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  onClick={() => setFCategory(cat.value)}
                  style={{
                    padding: '5px 12px', borderRadius: 16, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: fCategory === cat.value ? '2px solid var(--ac)' : '1px solid var(--bg3)',
                    background: fCategory === cat.value ? 'var(--pul)' : 'var(--bg)',
                    color: fCategory === cat.value ? 'var(--ac)' : 'var(--mu)',
                  }}
                >
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Question */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--mu)', display: 'block', marginBottom: 6 }}>السؤال المتوقع (اختياري)</label>
            <input className="fi" value={fQuestion} onChange={e => setFQuestion(e.target.value)}
              placeholder='مثال: مين رئيس لجنة العائلة؟' />
          </div>

          {/* Answer */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--mu)', display: 'block', marginBottom: 6 }}>الجواب / المعلومة *</label>
            <textarea className="fi" value={fAnswer} onChange={e => setFAnswer(e.target.value)}
              placeholder='مثال: رئيس لجنة العائلة هو فهد بن عبدالله الوابل'
              rows={4} style={{ resize: 'vertical', minHeight: 80 }} />
          </div>

          {/* Keywords */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--mu)', display: 'block', marginBottom: 6 }}>كلمات مفتاحية (مفصولة بفاصلة)</label>
            <input className="fi" value={fKeywords} onChange={e => setFKeywords(e.target.value)}
              placeholder='مثال: رئيس، لجنة، مسؤول' />
            <div style={{ fontSize: 10, color: 'var(--mu2)', marginTop: 4 }}>
              كل ما زادت الكلمات المفتاحية، كل ما البوت لقى المعلومة أسرع
            </div>
          </div>

          {/* Priority */}
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--mu)', display: 'block', marginBottom: 6 }}>الأولوية (1 = الأعلى)</label>
            <input className="fi" type="number" min={1} max={10} value={fPriority}
              onChange={e => setFPriority(parseInt(e.target.value) || 5)}
              style={{ width: 80 }} />
          </div>
        </Modal>
      )}
    </div>
  )
}
