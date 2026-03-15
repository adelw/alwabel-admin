import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { sb, loadAllMembers } from './lib/supabase'

const Ctx = createContext(null)
export const useStore = () => useContext(Ctx)

export function StoreProvider({ children }) {
  const [members,   setMembers]   = useState([])
  const [marriages, setMarriages] = useState([])
  const [user,      setUser]      = useState(null)
  const [loaded,    setLoaded]    = useState(false)

  // Toast
  const [toasts, setToasts] = useState([])
  const tid = useRef(0)
  const toast = useCallback((msg, type = 'inf') => {
    const id = ++tid.current
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000)
  }, [])

  // Loading
  const [loading, setLoading] = useState(false)
  const [loadMsg, setLoadMsg] = useState('')
  const showLoad = useCallback(msg => { setLoading(true); setLoadMsg(msg || '') }, [])
  const hideLoad = useCallback(() => setLoading(false), [])

  // Confirm
  const [confirm, setConfirm] = useState(null)
  const showConfirm = useCallback((ico, title, msg, cb) => setConfirm({ ico, title, msg, cb }), [])
  const doConfirm   = useCallback(() => { confirm?.cb?.(); setConfirm(null) }, [confirm])
  const cancelConfirm = useCallback(() => setConfirm(null), [])

  // Data
  const loadAll = useCallback(async () => {
    const all = await loadAllMembers()
    setMembers(all)
    const { data } = await sb.from('marriages').select('*')
    setMarriages(data || [])
    setLoaded(true)
  }, [])

  const memberById    = useCallback(id => members.find(m => m.id === id), [members])
  const updateMember  = useCallback((id, data) => setMembers(ms => ms.map(m => m.id === id ? { ...m, ...data } : m)), [])
  const addMember     = useCallback(m => setMembers(ms => [...ms, m].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'ar'))), [])
  const removeMember  = useCallback(id => {
    setMembers(ms => ms.filter(m => m.id !== id))
    setMarriages(mr => mr.filter(m => m.husband_id !== id && m.wife_id !== id))
  }, [])
  const addMarriage    = useCallback(m => setMarriages(mr => [...mr, m]), [])
  const removeMarriage = useCallback(id => setMarriages(mr => mr.filter(m => m.id !== id)), [])
  const updateMarriage = useCallback((id, data) => setMarriages(mr => mr.map(m => m.id === id ? { ...m, ...data } : m)), [])

  return (
    <Ctx.Provider value={{
      members, marriages, user, setUser, loaded, setLoaded,
      loadAll, memberById, updateMember, addMember, removeMember,
      addMarriage, removeMarriage, updateMarriage,
      toast, toasts,
      loading, loadMsg, showLoad, hideLoad,
      confirm, showConfirm, doConfirm, cancelConfirm,
    }}>
      {children}
    </Ctx.Provider>
  )
}
