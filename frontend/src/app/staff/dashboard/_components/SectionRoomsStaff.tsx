'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Building2, Edit2, Loader2, Plus, Search, Trash2 } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'

type RoomType = 'NORMAL' | 'LABORATORY' | 'WORKSHOP' | 'COMPUTER_LAB' | 'FIELD'
type RoomStatus = 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE'

type Room = {
  id: string
  name: string
  type: RoomType
  status: RoomStatus
  capacity: number
  equipment: string[]
}

type RoomForm = {
  name: string
  type: RoomType
  status: RoomStatus
  capacity: string
  equipment: string
}

type Props = {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

const ROOM_TYPES: RoomType[] = ['NORMAL', 'LABORATORY', 'WORKSHOP', 'COMPUTER_LAB', 'FIELD']
const ROOM_STATUSES: RoomStatus[] = ['ACTIVE', 'MAINTENANCE', 'INACTIVE']

const emptyForm: RoomForm = {
  name: '',
  type: 'NORMAL',
  status: 'ACTIVE',
  capacity: '30',
  equipment: '',
}

export function toRoomPayload(form: RoomForm) {
  const name = form.name.trim()
  const capacity = Number(form.capacity)
  if (!name || !Number.isInteger(capacity) || capacity < 1) {
    throw new Error('room-validation')
  }
  return {
    name,
    type: form.type,
    capacity,
    equipment: form.equipment.split(',').map(item => item.trim()).filter(Boolean),
  }
}

export default function SectionRoomsStaff({ onToast }: Props) {
  const t = useT('staff')
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<RoomForm>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadRooms = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchApi('/api/v2/rooms', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || t('rooms.loadError'))
      setRooms(Array.isArray(data.data) ? data.data : [])
    } catch (err) {
      const message = err instanceof Error ? err.message : t('rooms.loadError')
      setError(message)
      onToast(message, 'error')
    } finally {
      setLoading(false)
    }
  }, [onToast, t])

  useEffect(() => {
    loadRooms()
  }, [loadRooms])

  useEffect(() => {
    const onChanged = (event: Event) => {
      if ((event as CustomEvent<{ entity?: string }>).detail?.entity === 'room') loadRooms()
    }
    window.addEventListener('zekoulabia:data-changed', onChanged)
    return () => window.removeEventListener('zekoulabia:data-changed', onChanged)
  }, [loadRooms])

  const openCreate = () => {
    setForm(emptyForm)
    setEditingId(null)
    setModalOpen(true)
  }

  const openEdit = (room: Room) => {
    setForm({
      name: room.name,
      type: room.type,
      status: room.status,
      capacity: String(room.capacity),
      equipment: room.equipment.join(', '),
    })
    setEditingId(room.id)
    setModalOpen(true)
  }

  const closeModal = () => {
    if (!saving) setModalOpen(false)
  }

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()
    let payload
    try {
      payload = toRoomPayload(form)
    } catch {
      onToast(t('rooms.validationError'), 'error')
      return
    }

    setSaving(true)
    try {
      const res = await fetchApi(editingId ? `/api/v2/rooms/${encodeURIComponent(editingId)}` : '/api/v2/rooms', {
        method: editingId ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingId ? { ...payload, status: form.status } : payload),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || t('rooms.saveError'))
      onToast(t(editingId ? 'rooms.updateSuccess' : 'rooms.createSuccess'), 'success')
      setModalOpen(false)
      setEditingId(null)
      setForm(emptyForm)
      loadRooms()
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('rooms.saveError'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (room: Room) => {
    if (!confirm(t('rooms.deleteConfirm', { name: room.name }))) return
    setDeletingId(room.id)
    try {
      const res = await fetchApi(`/api/v2/rooms/${encodeURIComponent(room.id)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || t('rooms.deleteError'))
      onToast(t('rooms.deleteSuccess'), 'success')
      loadRooms()
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('rooms.deleteError'), 'error')
    } finally {
      setDeletingId(null)
    }
  }

  const typeLabel = (type: RoomType) => t(`rooms.types.${type.toLowerCase()}`)
  const statusLabel = (status: RoomStatus) => t(`rooms.statuses.${status.toLowerCase()}`)
  const filteredRooms = rooms.filter(room =>
    `${room.name} ${room.type} ${room.equipment.join(' ')}`.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="px-4 py-4 md:px-7 md:py-6" style={{ height: '100%', overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={headerStyle}>
        <div>
          <h1 style={titleStyle}><Building2 size={18} color="var(--amber)" />{t('rooms.title')}</h1>
          <p style={subtitleStyle}>{t('rooms.subtitle')}</p>
        </div>
        <button type="button" onClick={openCreate} style={primaryButton}><Plus size={15} />{t('rooms.add')}</button>
      </div>

      <div style={{ position: 'relative', maxWidth: 360, marginBottom: 16 }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text3)' }} />
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder={t('rooms.searchPlaceholder')} style={searchStyle} />
      </div>

      {loading ? (
        <div style={stateStyle}><Loader2 size={22} className="animate-spin" />{t('rooms.loading')}</div>
      ) : error ? (
        <div style={stateStyle}>
          <p style={{ color: 'var(--red)', margin: 0 }}>{error}</p>
          <button type="button" onClick={loadRooms} style={secondaryButton}>{t('rooms.retry')}</button>
        </div>
      ) : filteredRooms.length === 0 ? (
        <div style={emptyStyle}><Building2 size={30} /><p>{t('rooms.empty')}</p></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 12 }}>
          {filteredRooms.map(room => (
            <article key={room.id} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <h2 style={{ margin: 0, color: 'var(--text)', fontSize: 14, fontWeight: 700 }}>{room.name}</h2>
                  <span style={badgeStyle}>{typeLabel(room.type)}</span>
                </div>
                <span style={{ ...badgeStyle, background: room.status === 'ACTIVE' ? 'var(--green-light)' : room.status === 'MAINTENANCE' ? 'var(--amber-light)' : 'var(--red-light)', color: room.status === 'ACTIVE' ? 'var(--green)' : room.status === 'MAINTENANCE' ? 'var(--amber)' : 'var(--red)' }}>{statusLabel(room.status)}</span>
              </div>
              <div style={{ margin: '12px 0', color: 'var(--text2)', fontSize: 12 }}>
                <div>{t('rooms.capacity')}: <strong>{room.capacity}</strong></div>
                <div style={{ marginTop: 5 }}>{t('rooms.equipment')}: {room.equipment.length > 0 ? room.equipment.join(', ') : t('rooms.noEquipment')}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                <button type="button" onClick={() => openEdit(room)} aria-label={t('rooms.edit')} style={iconButton}><Edit2 size={14} /></button>
                <button type="button" onClick={() => handleDelete(room)} disabled={deletingId === room.id} aria-label={t('rooms.delete')} style={{ ...iconButton, color: 'var(--red)' }}><Trash2 size={14} /></button>
              </div>
            </article>
          ))}
        </div>
      )}

      {modalOpen && (
        <div style={modalBackdrop} onMouseDown={event => { if (event.target === event.currentTarget) closeModal() }}>
          <form onSubmit={handleSave} style={modalStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, color: 'var(--text)', fontSize: 16, fontWeight: 700 }}>{editingId ? t('rooms.editTitle') : t('rooms.createTitle')}</h2>
              <button type="button" onClick={closeModal} aria-label={t('rooms.cancel')} style={iconButton}><span aria-hidden="true">×</span></button>
            </div>
            <label style={labelStyle}>{t('rooms.nameLabel')}</label>
            <input required autoFocus value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} style={inputStyle} />
            <label style={labelStyle}>{t('rooms.typeLabel')}</label>
            <select value={form.type} onChange={event => setForm(current => ({ ...current, type: event.target.value as RoomType }))} style={inputStyle}>
              {ROOM_TYPES.map(type => <option key={type} value={type}>{typeLabel(type)}</option>)}
            </select>
            <label style={labelStyle}>{t('rooms.capacityLabel')}</label>
            <input required type="number" min="1" value={form.capacity} onChange={event => setForm(current => ({ ...current, capacity: event.target.value }))} style={inputStyle} />
            <label style={labelStyle}>{t('rooms.equipmentLabel')}</label>
            <input value={form.equipment} onChange={event => setForm(current => ({ ...current, equipment: event.target.value }))} placeholder={t('rooms.equipmentPlaceholder')} style={inputStyle} />
            {editingId && (
              <>
                <label style={labelStyle}>{t('rooms.statusLabel')}</label>
                <select value={form.status} onChange={event => setForm(current => ({ ...current, status: event.target.value as RoomStatus }))} style={inputStyle}>
                  {ROOM_STATUSES.map(status => <option key={status} value={status}>{statusLabel(status)}</option>)}
                </select>
              </>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <button type="button" onClick={closeModal} style={secondaryButton}>{t('rooms.cancel')}</button>
              <button type="submit" disabled={saving} style={{ ...primaryButton, opacity: saving ? 0.6 : 1 }}>{saving ? t('rooms.saving') : editingId ? t('rooms.update') : t('rooms.create')}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

const headerStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 } as const
const titleStyle = { display: 'flex', alignItems: 'center', gap: 7, margin: 0, color: 'var(--text)', fontSize: 18, fontWeight: 700 } as const
const subtitleStyle = { margin: '2px 0 0', color: 'var(--text3)', fontSize: 12 } as const
const primaryButton = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 7, background: 'var(--amber)', color: '#000', border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' } as const
const secondaryButton = { padding: '6px 12px', borderRadius: 6, background: 'var(--bg2)', border: '1px solid var(--border2)', color: 'var(--text)', fontSize: 12, cursor: 'pointer' } as const
const searchStyle = { width: '100%', padding: '6px 10px 6px 30px', borderRadius: 6, background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, outline: 'none' } as const
const stateStyle = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 180, color: 'var(--text3)', fontSize: 13, textAlign: 'center' } as const
const emptyStyle = { ...stateStyle, border: '1px dashed var(--border)', borderRadius: 10, background: 'var(--surface)' } as const
const cardStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 13 } as const
const badgeStyle = { display: 'inline-block', marginTop: 6, padding: '2px 7px', borderRadius: 5, background: 'var(--bg2)', color: 'var(--text2)', fontSize: 10.5, fontWeight: 600 } as const
const iconButton = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text2)', cursor: 'pointer' } as const
const modalBackdrop = { position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.7)' } as const
const modalStyle = { width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto', padding: '18px 20px', background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 12 } as const
const labelStyle = { display: 'block', margin: '10px 0 4px', color: 'var(--text2)', fontSize: 11, fontWeight: 600 } as const
const inputStyle = { width: '100%', padding: '8px 10px', borderRadius: 6, background: 'var(--bg2)', border: '1px solid var(--border2)', color: 'var(--text)', fontSize: 12, outline: 'none' } as const
