import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://bhjpyxmlzojdoziopmor.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoanB5eG1sem9qZG96aW9wbW9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0ODI2NjMsImV4cCI6MjEwMzA1ODY2M30.eag67t7Jbssnx-Skn1DkXqkvFm1zPSkzcDwsvB3cTfU'

export const supabase = createClient(supabaseUrl, supabaseKey)

// Offline-first storage. Data is kept in IndexedDB and mutations are queued
// until an internet connection is available again.
const DB_NAME = 'matayias-welfare-offline'
const DB_VERSION = 1
const DATA_STORE = 'data'
const QUEUE_STORE = 'queue'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(DATA_STORE)) db.createObjectStore(DATA_STORE)
      if (!db.objectStoreNames.contains(QUEUE_STORE)) db.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet(key) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DATA_STORE, 'readonly')
    const req = tx.objectStore(DATA_STORE).get(key)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbPut(key, value) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DATA_STORE, 'readwrite')
    tx.objectStore(DATA_STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function queueAdd(op) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite')
    const req = tx.objectStore(QUEUE_STORE).add({ ...op, createdAt: Date.now() })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function queueAll() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readonly')
    const req = tx.objectStore(QUEUE_STORE).getAll()
    req.onsuccess = () => resolve(req.result.sort((a, b) => a.id - b.id))
    req.onerror = () => reject(req.error)
  })
}

async function queueDelete(id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite')
    tx.objectStore(QUEUE_STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function cacheTable(table, rows) {
  await idbPut(`table:${table}`, Array.isArray(rows) ? rows : [])
}

async function getCachedTable(table) {
  return (await idbGet(`table:${table}`)) || []
}

function sortRows(rows, orderCol) {
  return [...rows].sort((a, b) => {
    const av = a?.[orderCol] ?? ''
    const bv = b?.[orderCol] ?? ''
    return String(av).localeCompare(String(bv))
  })
}

function localUpsert(table, row) {
  return getCachedTable(table).then(async rows => {
    const i = rows.findIndex(x => x.id === row.id)
    const next = i >= 0 ? rows.map((x, n) => n === i ? { ...x, ...row } : x) : [...rows, row]
    await cacheTable(table, next)
    return row
  })
}

function localUpdate(table, id, patch) {
  return getCachedTable(table).then(async rows => {
    const i = rows.findIndex(x => x.id === id)
    if (i < 0) throw new Error(`Record ${id} is not available offline.`)
    const updated = { ...rows[i], ...patch }
    rows[i] = updated
    await cacheTable(table, rows)
    return updated
  })
}

async function localDelete(table, id) {
  const rows = await getCachedTable(table)
  await cacheTable(table, rows.filter(x => x.id !== id))
}

async function applyQueuedOperation(op) {
  if (op.type === 'insert') {
    const { error } = await supabase.from(op.table).insert(op.row)
    if (error) throw error
  } else if (op.type === 'update') {
    const { error } = await supabase.from(op.table).update(op.patch).eq('id', op.id)
    if (error) throw error
  } else if (op.type === 'delete') {
    const { error } = await supabase.from(op.table).delete().eq('id', op.id)
    if (error) throw error
  } else if (op.type === 'settings_update') {
    const { error } = await supabase.from('settings').update(op.patch).eq('id', 1)
    if (error) throw error
  } else if (op.type === 'attendance_upsert') {
    const { error } = await supabase.from('attendance').upsert(op.rows, { onConflict: 'event_id,member_id' })
    if (error) throw error
  }
}

let syncing = null
export async function syncOfflineChanges() {
  if (!navigator.onLine) return { synced: 0, pending: (await queueAll()).length }
  if (syncing) return syncing
  syncing = (async () => {
    let synced = 0
    const ops = await queueAll()
    for (const op of ops) {
      try {
        await applyQueuedOperation(op)
        await queueDelete(op.id)
        synced++
      } catch (e) {
        // Keep the first failed operation and all following operations queued.
        // This preserves write order and avoids breaking foreign-key dependencies.
        console.warn('Offline sync paused:', e)
        break
      }
    }
    return { synced, pending: (await queueAll()).length }
  })().finally(() => { syncing = null })
  return syncing
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    syncOfflineChanges().then(() => window.dispatchEvent(new Event('offline-sync-complete'))).catch(console.warn)
  })
}

export async function listTable(table, orderCol = 'created_at') {
  try {
    if (navigator.onLine) {
      await syncOfflineChanges()
      const { data, error } = await supabase.from(table).select('*').order(orderCol, { ascending: true })
      if (error) throw error
      await cacheTable(table, data || [])
      return data || []
    }
  } catch (e) {
    console.warn(`Using offline cache for ${table}:`, e)
  }
  return sortRows(await getCachedTable(table), orderCol)
}

export async function addRow(table, row) {
  const localRow = { ...row }
  if (!localRow.id) localRow.id = crypto.randomUUID()
  if (!localRow.created_at) localRow.created_at = new Date().toISOString()
  await localUpsert(table, localRow)
  try {
    if (!navigator.onLine) throw new Error('offline')
    const { data, error } = await supabase.from(table).insert(localRow).select()
    if (error) throw error
    const saved = data?.[0] || localRow
    await localUpsert(table, saved)
    return saved
  } catch {
    await queueAdd({ type: 'insert', table, row: localRow })
    return localRow
  }
}

export async function updateRowById(table, id, patch) {
  const updated = await localUpdate(table, id, patch)
  try {
    if (!navigator.onLine) throw new Error('offline')
    const { data, error } = await supabase.from(table).update(patch).eq('id', id).select()
    if (error) throw error
    const saved = data?.[0] || updated
    await localUpsert(table, saved)
    return saved
  } catch {
    await queueAdd({ type: 'update', table, id, patch })
    return updated
  }
}

export async function deleteRowById(table, id) {
  await localDelete(table, id)
  try {
    if (!navigator.onLine) throw new Error('offline')
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) throw error
  } catch {
    await queueAdd({ type: 'delete', table, id })
  }
}

export async function deleteRepaymentsForLoan(loanId) {
  const rows = (await getCachedTable('loan_repayments')).filter(r => r.loan_id === loanId)
  for (const row of rows) await deleteRowById('loan_repayments', row.id)
}

export async function fetchSettings() {
  try {
    if (navigator.onLine) {
      await syncOfflineChanges()
      const { data, error } = await supabase.from('settings').select('*').eq('id', 1).single()
      if (error) throw error
      await idbPut('settings', data)
      return data
    }
  } catch (e) {
    console.warn('Using offline settings:', e)
  }
  return await idbGet('settings')
}

export async function updateSettings(patch) {
  const current = (await idbGet('settings')) || { id: 1 }
  const updated = { ...current, ...patch, id: 1 }
  await idbPut('settings', updated)
  try {
    if (!navigator.onLine) throw new Error('offline')
    const { data, error } = await supabase.from('settings').update(patch).eq('id', 1).select().single()
    if (error) throw error
    await idbPut('settings', data)
    return data
  } catch {
    await queueAdd({ type: 'settings_update', patch })
    return updated
  }
}

export async function fetchAttendance() {
  try {
    if (navigator.onLine) {
      await syncOfflineChanges()
      const { data, error } = await supabase.from('attendance').select('*')
      if (error) throw error
      await idbPut('attendance', data || [])
      const map = {}
      ;(data || []).forEach(r => {
        map[r.event_id] = map[r.event_id] || {}
        map[r.event_id][r.member_id] = r.present
      })
      return map
    }
  } catch (e) {
    console.warn('Using offline attendance:', e)
  }
  const data = (await idbGet('attendance')) || []
  const map = {}
  data.forEach(r => {
    map[r.event_id] = map[r.event_id] || {}
    map[r.event_id][r.member_id] = r.present
  })
  return map
}

export async function saveAttendanceForEvent(eventId, recMap) {
  const rows = Object.entries(recMap).map(([member_id, present]) => ({
    event_id: eventId, member_id, present,
  }))
  if (!rows.length) return
  const existing = (await idbGet('attendance')) || []
  const next = [...existing]
  for (const row of rows) {
    const i = next.findIndex(x => x.event_id === row.event_id && x.member_id === row.member_id)
    if (i >= 0) next[i] = { ...next[i], ...row }
    else next.push(row)
  }
  await idbPut('attendance', next)
  try {
    if (!navigator.onLine) throw new Error('offline')
    const { error } = await supabase.from('attendance').upsert(rows, { onConflict: 'event_id,member_id' })
    if (error) throw error
  } catch {
    await queueAdd({ type: 'attendance_upsert', rows })
  }
}
