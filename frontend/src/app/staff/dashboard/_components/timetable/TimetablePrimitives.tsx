'use client'
import type React from 'react'

export function TimetableEmptyState({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: '40px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 38, marginBottom: 10, display: 'flex', justifyContent: 'center', color: 'var(--text3)' }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>{sub}</div>
    </div>
  )
}

export function TimetableSpinner() {
  return (
    <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite', verticalAlign: 'middle', marginRight: 5 }} />
  )
}
