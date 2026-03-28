import { createClient } from '@supabase/supabase-js'

const SB_URL = 'https://hwdqdtatppdgbymovwpk.supabase.co'
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3ZHFkdGF0cHBkZ2J5bW92d3BrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NTMwNjYsImV4cCI6MjA4NzMyOTA2Nn0.PVu_km1Ue1Gcbl8Po2SwLNvPgOcayytIbAgVfiVbOtk'

export const sb = createClient(SB_URL, SB_KEY)

export const now = () => new Date().toISOString()

export function fmtPhone(p = '') {
  p = p.replace(/[\s\-()+ ]/g, '')
  if (p.startsWith('05')) p = '966' + p.slice(1)
  else if (/^5\d{8}$/.test(p)) p = '966' + p
  return '+' + p.replace(/^\+/, '')
}

// ✅ تم التغيير من @family.app إلى @alwabil.info
export const phoneToEmail = p => fmtPhone(p).replace('+', '') + '@alwabil.info'

export function phoneVariants(raw = '') {
  try {
    const f = fmtPhone(raw)
    const d = f.replace(/^\+966/, '')
    return [f, '+966' + d, '0' + d, d, raw.trim()]
  } catch { return [raw.trim()] }
}

export async function loadAllMembers() {
  let all = [], off = 0
  while (true) {
    const { data, error } = await sb
      .from('members')
      .select('id,wp_id,ref_id,first_name,full_name,gender,phone,email,city,job,branch,status,role,is_deceased,birth_date,birth_order,father_id,mother_id,photo_url,notes,created_at,auth_id,is_verified,is_family_member,family_name,display_family_name')
      .order('full_name')
      .range(off, off + 999)
    if (error) throw error
    all.push(...data)
    if (data.length < 1000) break
    off += 1000
  }
  return all
}
