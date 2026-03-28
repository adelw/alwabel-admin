import { sb } from './supabase'

// ══════════════════════════════════════════════════════════════
// Audit Log — src/lib/auditLog.js
// يضيف سجل مستقل مباشرة — لا يعتمد على الـ Trigger
// ══════════════════════════════════════════════════════════════

/**
 * سجّل عملية في audit_logs
 * @param {Object} opts
 * @param {'insert'|'update'|'delete'} opts.action
 * @param {string} opts.table      — اسم الجدول
 * @param {string} opts.recordId   — ID السجل المتأثر
 * @param {string} opts.actorId    — ID المعدّل
 * @param {string} opts.actorName  — اسم المعدّل
 * @param {string} opts.source     — 'dashboard' | 'app' | 'whatsapp_bot'
 * @param {string} opts.summary    — ملخص عربي
 * @param {Object} opts.changes    — التغييرات
 */
export async function logAction({
  action,
  table,
  recordId,
  actorId,
  actorName,
  source = 'dashboard',
  summary = '',
  changes = {},
}) {
  try {
    await sb.from('audit_logs').insert({
      action,
      table_name: table,
      record_id:  recordId || null,
      actor_id:   actorId || null,
      actor_name: actorName || null,
      source,
      summary,
      changes,
    })
  } catch (e) {
    console.warn('⚠️ Audit log failed:', e)
  }
}

// ── أسماء الحقول بالعربي ──
const FL = {
  first_name:'الاسم الأول', full_name:'الاسم الكامل', phone:'الجوال',
  email:'البريد', city:'المدينة', job:'الوظيفة', gender:'الجنس',
  birth_date:'تاريخ الميلاد', death_date:'تاريخ الوفاة', is_deceased:'متوفى',
  is_family_member:'من العائلة', family_name:'اسم العائلة', father_id:'الأب',
  mother_id:'الأم', branch:'الفرع', role:'الصلاحية', status:'الحالة',
  birth_order:'ترتيب الميلاد', photo_url:'الصورة', notes:'الملاحظات',
  husband_id:'الزوج', wife_id:'الزوجة', wife_order:'ترتيب الزوجة',
  is_divorced:'مطلقة', is_hidden:'مخفية', title:'العنوان', content:'المحتوى',
}
export const fieldLabel = k => FL[k] || k

/**
 * بناء ملخص عربي
 * مثال: "عادل عدّل المدينة والوظيفة لـ محمد بن أحمد"
 */
export function buildSummary(action, table, targetName, actorName, changes = {}) {
  const tl = { members:'عضو', marriages:'زيجة', events:'فعالية', posts:'منشور',
    post_comments:'تعليق', tree_tags:'تاق', member_tags:'ربط تاق' }[table] || table
  const a = actorName || 'مجهول'
  if (action === 'insert') return `${a} أضاف ${tl}: ${targetName}`
  if (action === 'delete') return `${a} حذف ${tl}: ${targetName}`
  const fields = Object.keys(changes)
  if (fields.length === 0) return `${a} عدّل ${tl}: ${targetName}`
  if (fields.length <= 3) return `${a} عدّل ${fields.map(f=>fieldLabel(f)).join('، ')} لـ ${targetName}`
  return `${a} عدّل ${fields.length} حقول لـ ${targetName}`
}

/**
 * حساب الفرق بين القديم والجديد
 */
export function diffChanges(oldObj, newObj, skip = ['updated_at','created_at']) {
  const ch = {}
  for (const k of Object.keys(newObj)) {
    if (skip.includes(k)) continue
    const ov = oldObj[k] ?? null
    const nv = newObj[k] ?? null
    if (JSON.stringify(ov) !== JSON.stringify(nv)) {
      ch[k] = { old: ov, new: nv }
    }
  }
  return ch
}
