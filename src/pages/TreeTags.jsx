import { useState, useEffect, useCallback } from 'react'
import { useStore } from '../store'
import { sb } from '../lib/supabase'
import { Modal, AutoComplete } from '../components/UI'

/* ─────────────── helpers ─────────────── */
function slugify(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\u0621-\u064Aa-z0-9\-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/* ─────────────── main ─────────────── */
export default function TreeTags() {
  const { members, marriages, toast, showLoad, hideLoad, showConfirm } = useStore()

  /* ── state ── */
  const [tags, setTags]           = useState([])
  const [memberTags, setMemberTags] = useState([])  // { id, tag_id, member_id }
  const [loading, setLoading]     = useState(true)

  // Create / Edit tag modal
  const [modal, setModal]         = useState(null)  // null | 'new' | tag obj
  const [fName, setFName]         = useState('')
  const [fSlug, setFSlug]         = useState('')
  const [fDesc, setFDesc]         = useState('')
  const [fColor, setFColor]       = useState('#2563eb')
  const [autoSlug, setAutoSlug]   = useState(true)
  // Settings
  const [fAncestorId, setFAncestorId]     = useState(null)
  const [fAncestorName, setFAncestorName] = useState('')
  const [fAutoDesc, setFAutoDesc]         = useState(false)
  const [fAutoSpouse, setFAutoSpouse]     = useState(false)
  const [fAutoDaughter, setFAutoDaughter] = useState(false)
  // Privacy settings
  const [fHideMembers, setFHideMembers]       = useState(false)
  const [fHidePhone, setFHidePhone]           = useState(false)
  const [fHideCity, setFHideCity]             = useState(false)
  const [fHideJob, setFHideJob]               = useState(false)
  const [fHideMarriages, setFHideMarriages]   = useState(false)
  const [fHideChildren, setFHideChildren]     = useState(false)
  const [fHideDaughterLineage, setFHideDaughterLineage] = useState(false)

  // Assign member modal
  const [assignTag, setAssignTag] = useState(null)

  // Assign descendants modal
  const [descendantTag, setDescendantTag] = useState(null)
  const [descendantPreview, setDescendantPreview] = useState(null) // { ancestor, descendants[], alreadyLinked[], newOnes[] }

  // Expanded tag (show members)
  const [expanded, setExpanded]   = useState(null)

  // Search
  const [search, setSearch]       = useState('')

  /* ── load ── */
  const loadTags = useCallback(async () => {
    const { data: t, error: e1 } = await sb.from('tree_tags').select('*').order('name')
    if (e1) { toast('خطأ في تحميل التاقات: ' + e1.message, 'er'); return }
    setTags(t || [])

    const { data: mt, error: e2 } = await sb.from('member_tags').select('*')
    if (e2) { toast('خطأ في تحميل ربط الأعضاء: ' + e2.message, 'er'); return }
    // Deduplicate: keep only first occurrence of each tag_id+member_id pair
    const seen = new Set()
    const dupeIds = []
    const unique = []
    for (const row of (mt || [])) {
      const key = `${row.tag_id}__${row.member_id}`
      if (seen.has(key)) { dupeIds.push(row.id) } 
      else { seen.add(key); unique.push(row) }
    }
    // Clean up duplicates in DB silently
    if (dupeIds.length > 0) {
      sb.from('member_tags').delete().in('id', dupeIds).then(() => {})
    }
    setMemberTags(unique)
    setLoading(false)
  }, [toast])

  useEffect(() => { loadTags() }, [loadTags])

  /* ── filtered ── */
  const filtered = search.trim()
    ? tags.filter(t => t.name.includes(search) || (t.slug || '').includes(search))
    : tags

  /* ── tag CRUD ── */
  function openNew() {
    setModal('new'); setFName(''); setFSlug(''); setFDesc(''); setFColor('#2563eb'); setAutoSlug(true)
    setFAncestorId(null); setFAncestorName(''); setFAutoDesc(false); setFAutoSpouse(false); setFAutoDaughter(false)
    setFHideMembers(false); setFHidePhone(false); setFHideCity(false); setFHideJob(false); setFHideMarriages(false); setFHideChildren(false); setFHideDaughterLineage(false)
  }
  function openEdit(tag) {
    setModal(tag); setFName(tag.name); setFSlug(tag.slug || ''); setFDesc(tag.description || ''); setFColor(tag.color || '#2563eb'); setAutoSlug(false)
    setFAncestorId(tag.ancestor_id || null)
    setFAncestorName(tag.ancestor_id ? (members.find(m => m.id === tag.ancestor_id)?.full_name || members.find(m => m.id === tag.ancestor_id)?.first_name || '') : '')
    setFAutoDesc(!!tag.auto_add_descendants); setFAutoSpouse(!!tag.auto_add_spouses); setFAutoDaughter(!!tag.auto_add_daughter_children)
    setFHideMembers(!!tag.hide_members); setFHidePhone(!!tag.hide_phone); setFHideCity(!!tag.hide_city); setFHideJob(!!tag.hide_job); setFHideMarriages(!!tag.hide_marriages); setFHideChildren(!!tag.hide_children); setFHideDaughterLineage(!!tag.hide_daughter_lineage)
  }

  async function saveTag() {
    const name = fName.trim()
    if (!name) { toast('أدخل اسم التاق', 'er'); return }
    const slug = fSlug.trim() || slugify(name)
    const payload = {
      name, slug, description: fDesc.trim() || null, color: fColor,
      ancestor_id: fAncestorId || null,
      auto_add_descendants: fAutoDesc,
      auto_add_spouses: fAutoSpouse,
      auto_add_daughter_children: fAutoDaughter,
      hide_members: fHideMembers,
      hide_phone: fHidePhone,
      hide_city: fHideCity,
      hide_job: fHideJob,
      hide_marriages: fHideMarriages,
      hide_children: fHideChildren,
      hide_daughter_lineage: fHideDaughterLineage,
    }

    showLoad('جارٍ الحفظ...')
    try {
      if (modal === 'new') {
        const { data, error } = await sb.from('tree_tags').insert(payload).select().single()
        if (error) throw error
        setTags(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name, 'ar')))
        toast('✅ تم إنشاء التاق', 'ok')
      } else {
        const { data, error } = await sb.from('tree_tags').update(payload).eq('id', modal.id).select().single()
        if (error) throw error
        setTags(prev => prev.map(t => t.id === modal.id ? data : t))
        toast('✅ تم التحديث', 'ok')
      }
      setModal(null)
    } catch (e) {
      toast('خطأ: ' + e.message, 'er')
    } finally { hideLoad() }
  }

  function deleteTag(tag) {
    showConfirm('🗑️', 'حذف التاق', `هل تريد حذف "${tag.name}"؟ سيتم إزالة كل الربط أيضاً.`, async () => {
      showLoad('جارٍ الحذف...')
      try {
        await sb.from('member_tags').delete().eq('tag_id', tag.id)
        const { error } = await sb.from('tree_tags').delete().eq('id', tag.id)
        if (error) throw error
        setTags(prev => prev.filter(t => t.id !== tag.id))
        setMemberTags(prev => prev.filter(mt => mt.tag_id !== tag.id))
        if (expanded === tag.id) setExpanded(null)
        toast('✅ تم الحذف', 'ok')
      } catch (e) { toast('خطأ: ' + e.message, 'er') }
      finally { hideLoad() }
    })
  }

  /* ── member assign / remove ── */
  async function assignMember(memberId, memberName) {
    if (!memberId || !assignTag) return
    // Check if already assigned
    const exists = memberTags.find(mt => mt.tag_id === assignTag.id && mt.member_id === memberId)
    if (exists) { toast('العضو مربوط بالفعل', 'er'); return }

    showLoad('جارٍ الربط...')
    try {
      const { data, error } = await sb.from('member_tags').insert({ tag_id: assignTag.id, member_id: memberId }).select().single()
      if (error) throw error
      setMemberTags(prev => [...prev, data])
      toast(`✅ تم ربط "${memberName}" بـ "${assignTag.name}"`, 'ok')
      setAssignTag(null)
    } catch (e) { toast('خطأ: ' + e.message, 'er') }
    finally { hideLoad() }
  }

  async function assignById(inputId) {
    if (!assignTag) return
    const trimmed = inputId.trim()
    // Try finding by id directly
    let m = members.find(x => x.id === trimmed)
    // Try by wp_id
    if (!m) m = members.find(x => x.wp_id != null && String(x.wp_id) === trimmed)
    if (!m) { toast('لم يتم العثور على عضو بهذا الـ ID', 'er'); return }

    const exists = memberTags.find(mt => mt.tag_id === assignTag.id && mt.member_id === m.id)
    if (exists) { toast('العضو مربوط بالفعل', 'er'); return }

    await assignMember(m.id, memberName(m))
  }

  async function removeMemberTag(mtId, memberName, tagName) {
    showConfirm('🔗', 'إلغاء الربط', `إزالة "${memberName}" من تاق "${tagName}"؟`, async () => {
      showLoad('جارٍ الإزالة...')
      try {
        const { error } = await sb.from('member_tags').delete().eq('id', mtId)
        if (error) throw error
        setMemberTags(prev => prev.filter(mt => mt.id !== mtId))
        toast('✅ تم إلغاء الربط', 'ok')
      } catch (e) { toast('خطأ: ' + e.message, 'er') }
      finally { hideLoad() }
    })
  }

  /* ── descendants (recursive: children via father_id + mother_id for daughters' kids, spouses via marriages) ── */
  function getFullLineage(ancestorId) {
    const collected = new Set()
    const queue = [ancestorId]

    while (queue.length) {
      const personId = queue.shift()
      if (collected.has(personId)) continue
      collected.add(personId)

      const person = members.find(m => m.id === personId)
      if (!person) continue

      // 1) أبناء مباشرين (عبر father_id)
      const childrenByFather = members.filter(m => m.father_id === personId)
      for (const child of childrenByFather) {
        queue.push(child.id)
      }

      // 2) أبناء البنات (عبر mother_id) — لو هذا الشخص أنثى أو أي شخص في السلسلة
      const childrenByMother = members.filter(m => m.mother_id === personId)
      for (const child of childrenByMother) {
        queue.push(child.id)
      }

      // 3) الأزواج/الزوجات (عبر marriages)
      const personMarriages = marriages.filter(m => m.husband_id === personId || m.wife_id === personId)
      for (const mar of personMarriages) {
        const spouseId = mar.husband_id === personId ? mar.wife_id : mar.husband_id
        if (spouseId && !collected.has(spouseId)) {
          collected.add(spouseId) // أضف الزوج/ة لكن لا تتبع ذريته هو (فقط ذرية الجد)
        }
      }
    }

    // أزل الجد نفسه من النتيجة (سيُضاف يدوياً بعدين)
    collected.delete(ancestorId)
    return [...collected].map(id => members.find(m => m.id === id)).filter(Boolean)
  }

  function previewDescendants(ancestorId, ancestorName) {
    if (!ancestorId || !descendantTag) return
    const ancestor = members.find(m => m.id === ancestorId)
    const descendants = getFullLineage(ancestorId)
    // include the ancestor themselves
    const allToAdd = ancestor ? [ancestor, ...descendants] : descendants
    const existingIds = new Set(memberTags.filter(mt => mt.tag_id === descendantTag.id).map(mt => mt.member_id))
    const alreadyLinked = allToAdd.filter(m => existingIds.has(m.id))
    const newOnes = allToAdd.filter(m => !existingIds.has(m.id))
    setDescendantPreview({ ancestor: ancestor || { id: ancestorId, full_name: ancestorName }, descendants: allToAdd, alreadyLinked, newOnes })
  }

  async function confirmAssignDescendants() {
    if (!descendantPreview || !descendantTag) return
    const { newOnes } = descendantPreview
    if (newOnes.length === 0) { toast('كل الأعضاء مربوطين بالفعل', 'er'); return }

    showLoad(`جارٍ ربط ${newOnes.length} عضو...`)
    try {
      const rows = newOnes.map(m => ({ tag_id: descendantTag.id, member_id: m.id }))
      // Use upsert to prevent duplicate errors if somehow a record exists
      const { data, error } = await sb.from('member_tags').upsert(rows, { onConflict: 'tag_id,member_id', ignoreDuplicates: true }).select()
      if (error) throw error
      // Only add truly new ones to state
      const existingKeys = new Set(memberTags.map(mt => `${mt.tag_id}__${mt.member_id}`))
      const added = (data || []).filter(d => !existingKeys.has(`${d.tag_id}__${d.member_id}`))
      setMemberTags(prev => [...prev, ...added])
      toast(`✅ تم ربط ${added.length} عضو بـ "${descendantTag.name}"`, 'ok')
      setDescendantTag(null)
      setDescendantPreview(null)
    } catch (e) { toast('خطأ: ' + e.message, 'er') }
    finally { hideLoad() }
  }

  /* ── get members for a tag ── */
  function tagMembers(tagId) {
    const mIds = memberTags.filter(mt => mt.tag_id === tagId).map(mt => mt.member_id)
    return mIds.map(id => members.find(m => m.id === id)).filter(Boolean)
  }

  function memberName(m) { return m?.full_name || m?.first_name || '—' }

  /* ── render ── */
  if (loading) return (
    <div style={{ textAlign: 'center', padding: 60, color: 'var(--mu)' }}>
      <div className="spinner" style={{ margin: '0 auto 16px' }} />
      جارٍ تحميل التاقات...
    </div>
  )

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '20px 16px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div className="sh" style={{ margin: 0 }}>
          <span className="sh-t">🏷️ تاقات الشجرة</span>
          <span style={{ fontSize: 12, color: 'var(--mu)', marginRight: 8 }}>{tags.length} تاق</span>
        </div>
        <button className="btn btn-ok" onClick={openNew}>➕ تاق جديد</button>
      </div>

      {/* Search */}
      {tags.length > 0 && (
        <div className="s-wrap" style={{ marginBottom: 20 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--mu2)" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث في التاقات..."
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--mu2)', padding: '0 4px', fontSize: 16 }}>✕</button>
          )}
        </div>
      )}

      {/* Tags list */}
      {filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-ico">🏷️</div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            {tags.length === 0 ? 'لا توجد تاقات بعد' : 'لا توجد نتائج'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--mu2)' }}>
            {tags.length === 0 ? 'أنشئ أول تاق لتصنيف الأعضاء في الشجرة' : 'جرّب كلمة بحث أخرى'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(tag => {
            const tMembers = tagMembers(tag.id)
            const isOpen = expanded === tag.id
            return (
              <div key={tag.id} style={{
                background: 'var(--card, #fff)',
                border: '1px solid var(--bd, #e2e8f0)',
                borderRadius: 12,
                overflow: 'hidden',
                borderRight: `4px solid ${tag.color || '#2563eb'}`,
              }}>
                {/* Tag header */}
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 16px', cursor: 'pointer',
                    transition: 'background .15s',
                  }}
                  onClick={() => setExpanded(isOpen ? null : tag.id)}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2, #f8fafc)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {/* Color dot */}
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: tag.color || '#2563eb', flexShrink: 0,
                  }} />

                  {/* Name + slug */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{tag.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--mu)', direction: 'ltr', textAlign: 'right' }}>
                      {tag.slug && <code style={{ background: 'var(--bg2, #f1f5f9)', padding: '1px 6px', borderRadius: 4, fontSize: 10 }}>{tag.slug}</code>}
                      {tag.description && <span style={{ marginRight: 8 }}> — {tag.description}</span>}
                    </div>
                    {/* Auto-settings indicators */}
                    {(tag.auto_add_descendants || tag.auto_add_spouses || tag.auto_add_daughter_children) && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                        {tag.auto_add_descendants && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: '#dbeafe', color: '#1d4ed8' }}>👨‍👧‍👦 ذرية تلقائي</span>}
                        {tag.auto_add_spouses && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: '#fce7f3', color: '#be185d' }}>💑 أزواج تلقائي</span>}
                        {tag.auto_add_daughter_children && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: '#d1fae5', color: '#065f46' }}>👨‍👩‍👧 أبناء بنات تلقائي</span>}
                      </div>
                    )}
                    {/* Privacy indicators */}
                    {(tag.hide_members || tag.hide_phone || tag.hide_city || tag.hide_job || tag.hide_marriages || tag.hide_children || tag.hide_daughter_lineage) && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 3, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: '#fef2f2', color: '#dc2626' }}>
                          🔒 يخفي: {[
                            tag.hide_members && 'الأعضاء',
                            tag.hide_phone && 'الجوال',
                            tag.hide_city && 'المدينة',
                            tag.hide_job && 'الوظيفة',
                            tag.hide_marriages && 'الزيجات',
                            tag.hide_children && 'الأبناء',
                            tag.hide_daughter_lineage && 'أبناء البنات وذريتهم',
                          ].filter(Boolean).join('، ')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Members count badge */}
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 10px',
                    borderRadius: 20, background: 'var(--bg2, #f1f5f9)', color: 'var(--mu)',
                    whiteSpace: 'nowrap',
                  }}>
                    {tMembers.length} عضو
                  </span>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <button className="btn btn-gh btn-sm" title="إضافة عضو" onClick={() => setAssignTag(tag)}
                      style={{ fontSize: 14, padding: '4px 8px' }}>👤+</button>
                    <button className="btn btn-gh btn-sm" title="إضافة ذرية" onClick={() => { setDescendantTag(tag); setDescendantPreview(null) }}
                      style={{ fontSize: 14, padding: '4px 8px' }}>🌳+</button>
                    <button className="btn btn-gh btn-sm" title="تعديل" onClick={() => openEdit(tag)}
                      style={{ fontSize: 14, padding: '4px 8px' }}>✏️</button>
                    <button className="btn btn-gh btn-sm" title="حذف" onClick={() => deleteTag(tag)}
                      style={{ fontSize: 14, padding: '4px 8px', color: 'var(--rd, #ef4444)' }}>🗑️</button>
                  </div>

                  {/* Expand arrow */}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--mu2)" strokeWidth="2"
                    style={{ transition: 'transform .2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0)' }}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>

                {/* Expanded: member list */}
                {isOpen && (
                  <div style={{
                    borderTop: '1px solid var(--bd, #e2e8f0)',
                    padding: '12px 16px',
                    background: 'var(--bg2, #fafbfc)',
                  }}>
                    {tMembers.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 16, color: 'var(--mu)', fontSize: 13 }}>
                        لا يوجد أعضاء مربوطين — اضغط 👤+ لإضافة
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {tMembers.map(m => {
                          const mt = memberTags.find(x => x.tag_id === tag.id && x.member_id === m.id)
                          return (
                            <div key={m.id} style={{
                              display: 'flex', alignItems: 'center', gap: 6,
                              background: 'var(--card, #fff)', border: '1px solid var(--bd, #e2e8f0)',
                              borderRadius: 8, padding: '6px 10px', fontSize: 13,
                            }}>
                              <span>{m.gender === 'F' ? '👩' : '👨'}</span>
                              <span style={{ fontWeight: 600 }}>{memberName(m)}</span>
                              {m.is_deceased && <small style={{ color: 'var(--mu)', fontSize: 10 }}>رحمه الله</small>}
                              <button
                                onClick={() => removeMemberTag(mt?.id, memberName(m), tag.name)}
                                style={{
                                  border: 'none', background: 'none', cursor: 'pointer',
                                  color: 'var(--rd, #ef4444)', fontSize: 13, padding: '0 2px',
                                  lineHeight: 1,
                                }}
                                title="إلغاء الربط"
                              >✕</button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    <div style={{ marginTop: 10, textAlign: 'center', display: 'flex', justifyContent: 'center', gap: 8 }}>
                      <button className="btn btn-bl btn-sm" onClick={() => setAssignTag(tag)} style={{ fontSize: 12 }}>
                        👤+ إضافة عضو
                      </button>
                      <button className="btn btn-bl btn-sm" onClick={() => { setDescendantTag(tag); setDescendantPreview(null) }} style={{ fontSize: 12 }}>
                        🌳+ إضافة ذرية
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ─── Create / Edit Tag Modal ─── */}
      {modal && (
        <Modal
          title={modal === 'new' ? '🏷️ تاق جديد' : '✏️ تعديل التاق'}
          onClose={() => setModal(null)}
          sm
          footer={
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-gh" onClick={() => setModal(null)}>إلغاء</button>
              <button className="btn btn-ok" onClick={saveTag}>
                {modal === 'new' ? '➕ إنشاء' : '💾 حفظ'}
              </button>
            </div>
          }
        >
          <div className="fg">
            <label>اسم التاق *</label>
            <input
              className="fi"
              value={fName}
              onChange={e => {
                setFName(e.target.value)
                if (autoSlug) setFSlug(slugify(e.target.value))
              }}
              placeholder='مثال: ذرية صالح بن سالم'
              autoFocus
            />
          </div>
          <div className="fg">
            <label>Slug (معرّف فريد)</label>
            <input
              className="fi"
              value={fSlug}
              onChange={e => { setFSlug(e.target.value); setAutoSlug(false) }}
              placeholder="saleh-salem"
              dir="ltr"
              style={{ textAlign: 'left', fontFamily: 'monospace', fontSize: 13 }}
            />
          </div>
          <div className="fg">
            <label>وصف (اختياري)</label>
            <input
              className="fi"
              value={fDesc}
              onChange={e => setFDesc(e.target.value)}
              placeholder="وصف مختصر للتاق"
            />
          </div>
          <div className="fg">
            <label>اللون</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="color"
                value={fColor}
                onChange={e => setFColor(e.target.value)}
                style={{ width: 40, height: 34, padding: 2, border: '1px solid var(--bd)', borderRadius: 6, cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                {['#2563eb', '#16a34a', '#dc2626', '#f59e0b', '#8b5cf6', '#ec4899', '#0d9488', '#64748b'].map(c => (
                  <div
                    key={c}
                    onClick={() => setFColor(c)}
                    style={{
                      width: 24, height: 24, borderRadius: '50%', background: c,
                      cursor: 'pointer', border: fColor === c ? '2px solid var(--fg, #000)' : '2px solid transparent',
                      transition: 'border .15s',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* ── Settings Section ── */}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--bd, #e2e8f0)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mu)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              ⚙️ إعدادات الإضافة التلقائية
              <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--mu2)' }}>(اختياري)</span>
            </div>

            <div className="fg">
              <label>الجد / الأب الأساسي للتاق</label>
              <AutoComplete
                placeholder="اختر الجد أو الأب..."
                value={fAncestorId}
                displayValue={fAncestorName}
                onChange={(id, name) => { setFAncestorId(id); setFAncestorName(name) }}
              />
              {!fAncestorId && (fAutoDesc || fAutoSpouse || fAutoDaughter) && (
                <div style={{ fontSize: 11, color: 'var(--rd, #ef4444)', marginTop: 4 }}>
                  ⚠️ يجب اختيار الجد لتفعيل الإضافة التلقائية
                </div>
              )}
            </div>

            {[
              { key: 'desc', val: fAutoDesc, set: setFAutoDesc, label: 'إضافة الذرية تلقائياً', desc: 'أي عضو جديد أبوه/جده ينتمي لهذا التاق ينضاف تلقائي', icon: '👨‍👧‍👦' },
              { key: 'spouse', val: fAutoSpouse, set: setFAutoSpouse, label: 'إضافة الأزواج/الزوجات تلقائياً', desc: 'عند إضافة زواج لعضو في التاق، الزوج/ة ينضاف تلقائي', icon: '💑' },
              { key: 'daughter', val: fAutoDaughter, set: setFAutoDaughter, label: 'إضافة أبناء البنات وأزواجهم', desc: 'أبناء البنات + أزواج البنات + زوجات الأبناء وأحفادهم', icon: '👨‍👩‍👧' },
            ].map(opt => (
              <div
                key={opt.key}
                onClick={() => opt.set(!opt.val)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${opt.val ? 'var(--ac, #2563eb)' : 'var(--bd, #e2e8f0)'}`,
                  background: opt.val ? 'var(--acl, #eff6ff)' : 'transparent',
                  marginBottom: 8, transition: 'all .15s',
                }}
              >
                <span style={{ fontSize: 18 }}>{opt.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{opt.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>{opt.desc}</div>
                </div>
                <div style={{
                  width: 38, height: 22, borderRadius: 11, padding: 2,
                  background: opt.val ? 'var(--ac, #2563eb)' : '#cbd5e1',
                  transition: 'background .2s', flexShrink: 0,
                }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', background: '#fff',
                    transition: 'transform .2s',
                    transform: opt.val ? 'translateX(0px)' : 'translateX(16px)',
                    boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                  }} />
                </div>
              </div>
            ))}
          </div>

          {/* ── Privacy Section ── */}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--bd, #e2e8f0)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mu)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              🔒 إعدادات الخصوصية
              <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--mu2)' }}>(اختياري)</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 12 }}>
              اللي تفعّله هنا يُخفى عن المستخدمين اللي <b>مو</b> من أعضاء هذا التاق في تطبيق الشجرة.
            </div>

            {[
              { key: 'members',   val: fHideMembers,   set: setFHideMembers,   label: 'إخفاء الأعضاء بالكامل',  desc: 'أعضاء التاق ما يظهرون في الشجرة لغير أعضائه', icon: '👤' },
              { key: 'phone',     val: fHidePhone,     set: setFHidePhone,     label: 'إخفاء رقم الجوال',       desc: 'رقم الجوال ما يظهر لغير أعضاء التاق', icon: '📞' },
              { key: 'city',      val: fHideCity,      set: setFHideCity,      label: 'إخفاء المدينة',          desc: 'المدينة ما تظهر لغير أعضاء التاق', icon: '📍' },
              { key: 'job',       val: fHideJob,       set: setFHideJob,       label: 'إخفاء الوظيفة',          desc: 'الوظيفة ما تظهر لغير أعضاء التاق', icon: '💼' },
              { key: 'marriages', val: fHideMarriages, set: setFHideMarriages, label: 'إخفاء الزيجات',          desc: 'الزيجات ما تظهر لغير أعضاء التاق', icon: '💑' },
              { key: 'children',  val: fHideChildren,  set: setFHideChildren,  label: 'إخفاء الأبناء',          desc: 'الأبناء ما يظهرون لغير أعضاء التاق', icon: '👶' },
              { key: 'daughter_lineage', val: fHideDaughterLineage, set: setFHideDaughterLineage, label: 'إخفاء أبناء البنات وذريتهم', desc: 'يُخفي أبناء البنات وأحفادهم وزوجات الأبناء — يظهر فقط زوج البنت', icon: '🌿' },
            ].map(opt => (
              <div
                key={opt.key}
                onClick={() => opt.set(!opt.val)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${opt.val ? '#ef4444' : 'var(--bd, #e2e8f0)'}`,
                  background: opt.val ? '#fef2f2' : 'transparent',
                  marginBottom: 6, transition: 'all .15s',
                }}
              >
                <span style={{ fontSize: 16 }}>{opt.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{opt.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 1 }}>{opt.desc}</div>
                </div>
                <div style={{
                  width: 38, height: 22, borderRadius: 11, padding: 2,
                  background: opt.val ? '#ef4444' : '#cbd5e1',
                  transition: 'background .2s', flexShrink: 0,
                }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', background: '#fff',
                    transition: 'transform .2s',
                    transform: opt.val ? 'translateX(0px)' : 'translateX(16px)',
                    boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* ─── Assign Member Modal ─── */}
      {assignTag && (
        <Modal
          title={`👤+ ربط عضو بـ "${assignTag.name}"`}
          onClose={() => setAssignTag(null)}
          sm
        >
          <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--mu)' }}>
            ابحث عن العضو بالاسم أو رقم الجوال:
          </div>
          <AutoComplete
            placeholder="ابحث بالاسم أو الجوال..."
            value={null}
            displayValue=""
            onChange={(id, name) => { if (id) assignMember(id, name) }}
          />

          {/* Add by ID */}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--bd, #e2e8f0)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--mu)', marginBottom: 8 }}>
              أو أدخل رقم ID مباشرة:
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="fi"
                placeholder="UUID أو رقم العضو"
                id="assign-id-input"
                style={{ flex: 1, fontSize: 13, fontFamily: 'monospace' }}
                dir="ltr"
                onKeyDown={e => { if (e.key === 'Enter') { const v = e.target.value.trim(); if (v) assignById(v) } }}
              />
              <button className="btn btn-bl" onClick={() => {
                const v = document.getElementById('assign-id-input')?.value?.trim()
                if (v) assignById(v)
              }}>ربط</button>
            </div>
          </div>
          {/* Show already assigned */}
          {(() => {
            const assigned = tagMembers(assignTag.id)
            if (assigned.length === 0) return null
            return (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--mu)', marginBottom: 8 }}>
                  الأعضاء المربوطين ({assigned.length}):
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {assigned.map(m => (
                    <span key={m.id} style={{
                      fontSize: 12, padding: '3px 10px', borderRadius: 20,
                      background: 'var(--bg2, #f1f5f9)', fontWeight: 600,
                    }}>
                      {m.gender === 'F' ? '👩' : '👨'} {memberName(m)}
                    </span>
                  ))}
                </div>
              </div>
            )
          })()}
        </Modal>
      )}

      {/* ─── Assign Descendants Modal ─── */}
      {descendantTag && (
        <Modal
          title={`🌳 إضافة ذرية لتاق "${descendantTag.name}"`}
          onClose={() => { setDescendantTag(null); setDescendantPreview(null) }}
          footer={descendantPreview && descendantPreview.newOnes.length > 0 ? (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
              {descendantPreview.alreadyLinked.length > 0 && (
                <span style={{ fontSize: 12, color: 'var(--mu)', flex: 1 }}>
                  ⚠️ {descendantPreview.alreadyLinked.length} عضو مربوط مسبقاً (سيتم تجاهلهم)
                </span>
              )}
              <button className="btn btn-gh" onClick={() => { setDescendantTag(null); setDescendantPreview(null) }}>إلغاء</button>
              <button className="btn btn-ok" onClick={confirmAssignDescendants}>
                ✅ ربط {descendantPreview.newOnes.length} عضو
              </button>
            </div>
          ) : null}
        >
          {!descendantPreview ? (
            <>
              <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--mu)' }}>
                اختر الأب / الجد لإضافة ذريته كاملة (أبناء + أحفاد + ...):
              </div>
              <AutoComplete
                placeholder="ابحث بالاسم أو الجوال..."
                value={null}
                displayValue=""
                onChange={(id, name) => { if (id) previewDescendants(id, name) }}
              />
            </>
          ) : (
            <div>
              {/* Ancestor info */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderRadius: 10,
                background: 'var(--bg2, #f1f5f9)', marginBottom: 14,
              }}>
                <span style={{ fontSize: 22 }}>🌳</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{memberName(descendantPreview.ancestor)}</div>
                  <div style={{ fontSize: 12, color: 'var(--mu)' }}>
                    الذرية الكاملة: {descendantPreview.descendants.length} شخص
                  </div>
                </div>
                <button
                  className="btn btn-gh btn-sm"
                  style={{ marginRight: 'auto', fontSize: 11 }}
                  onClick={() => setDescendantPreview(null)}
                >تغيير</button>
              </div>

              {/* Summary */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <div style={{
                  flex: 1, padding: '10px 12px', borderRadius: 8, textAlign: 'center',
                  background: '#dcfce7', color: '#16a34a',
                }}>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{descendantPreview.newOnes.length}</div>
                  <div style={{ fontSize: 11, fontWeight: 600 }}>سيتم إضافتهم</div>
                </div>
                {descendantPreview.alreadyLinked.length > 0 && (
                  <div style={{
                    flex: 1, padding: '10px 12px', borderRadius: 8, textAlign: 'center',
                    background: '#fef3c7', color: '#b45309',
                  }}>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>{descendantPreview.alreadyLinked.length}</div>
                    <div style={{ fontSize: 11, fontWeight: 600 }}>مربوطين مسبقاً</div>
                  </div>
                )}
              </div>

              {/* Preview list */}
              {descendantPreview.newOnes.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--mu)', marginBottom: 6 }}>
                    الأعضاء الجدد ({descendantPreview.newOnes.length}):
                  </div>
                  <div style={{
                    maxHeight: 200, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: 6,
                    padding: 4,
                  }}>
                    {descendantPreview.newOnes.map(m => (
                      <span key={m.id} style={{
                        fontSize: 12, padding: '3px 10px', borderRadius: 20,
                        background: '#dcfce7', color: '#16a34a', fontWeight: 600,
                      }}>
                        {m.gender === 'F' ? '👩' : '👨'} {memberName(m)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {descendantPreview.newOnes.length === 0 && (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--mu)', fontSize: 13 }}>
                  كل ذرية {memberName(descendantPreview.ancestor)} مربوطين بالفعل بهذا التاق.
                </div>
              )}

              {/* Already linked list */}
              {descendantPreview.alreadyLinked.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--mu)', marginBottom: 6 }}>
                    مربوطين مسبقاً ({descendantPreview.alreadyLinked.length}):
                  </div>
                  <div style={{
                    maxHeight: 120, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: 6,
                    padding: 4,
                  }}>
                    {descendantPreview.alreadyLinked.map(m => (
                      <span key={m.id} style={{
                        fontSize: 12, padding: '3px 10px', borderRadius: 20,
                        background: '#fef3c7', color: '#b45309', fontWeight: 600,
                        textDecoration: 'line-through', opacity: 0.7,
                      }}>
                        {m.gender === 'F' ? '👩' : '👨'} {memberName(m)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
