import { createClient } from '@supabase/supabase-js'

// The Supabase anon key is designed to be public (it's the client-side key,
// gated by row-level security policies on the database) so it's safe to
// ship in the built app. Falls back to these defaults if env vars aren't set.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://bhjpyxmlzojdoziopmor.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoanB5eG1sem9qZG96aW9wbW9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0ODI2NjMsImV4cCI6MjEwMzA1ODY2M30.eag67t7Jbssnx-Skn1DkXqkvFm1zPSkzcDwsvB3cTfU'

export const supabase = createClient(supabaseUrl, supabaseKey)

export async function listTable(table, orderCol = 'created_at') {
  const { data, error } = await supabase.from(table).select('*').order(orderCol, { ascending: true })
  if (error) throw error
  return data
}

export async function addRow(table, row) {
  const { data, error } = await supabase.from(table).insert(row).select()
  if (error) throw error
  return data[0]
}

export async function updateRowById(table, id, patch) {
  const { data, error } = await supabase.from(table).update(patch).eq('id', id).select()
  if (error) throw error
  return data[0]
}

export async function deleteRowById(table, id) {
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) throw error
}


export async function deleteRepaymentsForLoan(loanId) {
  const { error } = await supabase.from('loan_repayments').delete().eq('loan_id', loanId)
  if (error) throw error
}

export async function fetchSettings() {
  const { data, error } = await supabase.from('settings').select('*').eq('id', 1).single()
  if (error) throw error
  return data
}

export async function updateSettings(patch) {
  const { data, error } = await supabase.from('settings').update(patch).eq('id', 1).select().single()
  if (error) throw error
  return data
}

export async function fetchAttendance() {
  const { data, error } = await supabase.from('attendance').select('*')
  if (error) throw error
  const map = {}
  ;(data || []).forEach((r) => {
    map[r.event_id] = map[r.event_id] || {}
    map[r.event_id][r.member_id] = r.present
  })
  return map
}

export async function saveAttendanceForEvent(eventId, recMap) {
  const rows = Object.entries(recMap).map(([member_id, present]) => ({
    event_id: eventId,
    member_id,
    present,
  }))
  if (rows.length === 0) return
  const { error } = await supabase.from('attendance').upsert(rows, { onConflict: 'event_id,member_id' })
  if (error) throw error
}
