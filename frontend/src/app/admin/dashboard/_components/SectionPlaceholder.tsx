import { useT } from '@/lib/i18n'

interface Props {
  title: string
  icon: string
  description: string
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export default function SectionPlaceholder({ title, icon, description, onToast }: Props) {
  const t = useT('admin')
  return (
    <div style={{ padding: '11px 11px', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>{description}</div>
      </div>
      <div style={{ background: 'var(--surface)', borderRadius: 8, border: '1.5px solid var(--border)', padding: 21, textAlign: 'center', maxWidth: 620 }}>
        <div style={{ fontSize: 20, marginBottom: 10 }}>{icon}</div>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500, marginBottom: 13, lineHeight: 1.7 }}>
          {t('placeholder.message')}
        </div>
        <button
          onClick={() => onToast(`Section ${title} bientôt disponible`, 'info')}
          style={{ padding: '10px 12px', borderRadius: 11, fontSize: 13, fontWeight: 800, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Accéder à {title} →
        </button>
      </div>
    </div>
  )
}
