import { sb } from './supabase'

/**
 * Auto-assign tags to a member based on tag settings.
 * Call after: creating a member, editing father/mother, adding a marriage.
 *
 * Tag settings columns on tree_tags:
 *   ancestor_id             – UUID of the root ancestor for this tag
 *   auto_add_descendants    – boolean: auto-add children/grandchildren
 *   auto_add_spouses        – boolean: auto-add spouses of tagged members
 *   auto_add_daughter_children – boolean: auto-add daughters' kids + their spouses
 *
 * @param {string} memberId – the member who was just created/edited
 * @param {object[]} allMembers – full members array from store
 * @param {object[]} allMarriages – full marriages array from store
 * @returns {object[]} – newly inserted member_tags rows (or [])
 */
export async function autoAssignTags(memberId, allMembers, allMarriages) {
  // 1) Load all tags that have auto settings enabled
  const { data: tags, error: e1 } = await sb
    .from('tree_tags')
    .select('*')
    .not('ancestor_id', 'is', null)
    .or('auto_add_descendants.eq.true,auto_add_spouses.eq.true,auto_add_daughter_children.eq.true')

  if (e1 || !tags || tags.length === 0) return []

  // 2) Load existing member_tags for this member to avoid duplicates
  const { data: existing } = await sb.from('member_tags').select('tag_id').eq('member_id', memberId)
  const existingTagIds = new Set((existing || []).map(r => r.tag_id))

  const member = allMembers.find(m => m.id === memberId)
  if (!member) return []

  const toInsert = []

  for (const tag of tags) {
    if (existingTagIds.has(tag.id)) continue

    let shouldAdd = false

    // Check if this member belongs to the tag's lineage
    if (tag.auto_add_descendants) {
      // Walk up via father_id to see if ancestor_id is in the chain
      if (isDescendantOf(memberId, tag.ancestor_id, allMembers, 'father_id')) {
        shouldAdd = true
      }
    }

    if (!shouldAdd && tag.auto_add_daughter_children) {
      // Walk up via mother_id too (daughters' children)
      if (isDescendantOf(memberId, tag.ancestor_id, allMembers, 'mother_id')) {
        shouldAdd = true
      }
      // Also check father → mother chain (e.g. mother is daughter of ancestor)
      if (!shouldAdd && member.mother_id) {
        if (isDescendantOf(member.mother_id, tag.ancestor_id, allMembers, 'father_id')) {
          shouldAdd = true
        }
      }
      // Check if member is spouse of a daughter's child
      if (!shouldAdd && tag.auto_add_spouses) {
        const spouseIds = getSpouseIds(memberId, allMarriages)
        for (const sid of spouseIds) {
          if (isDescendantOf(sid, tag.ancestor_id, allMembers, 'mother_id') ||
              isDescendantOfViaAny(sid, tag.ancestor_id, allMembers)) {
            shouldAdd = true
            break
          }
        }
      }
    }

    if (!shouldAdd && tag.auto_add_spouses) {
      // Check if this member is a spouse of someone already in the tag
      const spouseIds = getSpouseIds(memberId, allMarriages)
      for (const sid of spouseIds) {
        // Check if spouse is descendant of ancestor
        if (isDescendantOfViaAny(sid, tag.ancestor_id, allMembers)) {
          shouldAdd = true
          break
        }
        // Check if spouse already has this tag
        const { data: spouseTag } = await sb.from('member_tags').select('id').eq('tag_id', tag.id).eq('member_id', sid).maybeSingle()
        if (spouseTag) {
          shouldAdd = true
          break
        }
      }
    }

    if (shouldAdd) {
      toInsert.push({ tag_id: tag.id, member_id: memberId })
    }
  }

  if (toInsert.length === 0) return []

  const { data: inserted, error: e2 } = await sb
    .from('member_tags')
    .upsert(toInsert, { onConflict: 'tag_id,member_id', ignoreDuplicates: true })
    .select()

  return inserted || []
}

/**
 * Auto-assign tags when a marriage is created.
 * Checks both husband and wife for auto-tag eligibility.
 */
export async function autoAssignTagsForMarriage(husbandId, wifeId, allMembers, allMarriages) {
  const r1 = await autoAssignTags(husbandId, allMembers, allMarriages)
  const r2 = await autoAssignTags(wifeId, allMembers, allMarriages)
  return [...r1, ...r2]
}

/* ── helpers ── */

function isDescendantOf(memberId, ancestorId, allMembers, parentField) {
  if (!memberId || !ancestorId) return false
  const visited = new Set()
  let current = memberId
  while (current) {
    if (current === ancestorId) return true
    if (visited.has(current)) return false
    visited.add(current)
    const m = allMembers.find(x => x.id === current)
    current = m ? m[parentField] : null
  }
  return false
}

function isDescendantOfViaAny(memberId, ancestorId, allMembers) {
  if (!memberId || !ancestorId) return false
  // Check both father_id and mother_id chains
  return isDescendantOf(memberId, ancestorId, allMembers, 'father_id') ||
         isDescendantOf(memberId, ancestorId, allMembers, 'mother_id')
}

function getSpouseIds(memberId, allMarriages) {
  return allMarriages
    .filter(m => m.husband_id === memberId || m.wife_id === memberId)
    .map(m => m.husband_id === memberId ? m.wife_id : m.husband_id)
    .filter(Boolean)
}
