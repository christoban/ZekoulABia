import { useT } from '@/lib/i18n'

interface Props {
  title: string
  icon: string
  description: string
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export default function SectionTeacherPlaceholder({ title, icon, description, onToast }: Props) {
  const t = useT('teacher')
  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 26 }}>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
        <div style={{ fontSize: 17, color: 'var(--text3)', marginTop: 3 }}>{description}</div>
      </div>
      <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', padding: 52, textAlign: 'center', maxWidth: 580 }}>
        <div style={{ fontSize: 56, marginBottom: 20 }}>{icon}</div>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 24, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
          {title}
        </div>
        <div style={{ fontSize: 17, color: 'var(--text3)', fontWeight: 500, marginBottom: 28, lineHeight: 1.7 }}>
          {t('placeholder.dev_message')}
        </div>
        <button
          onClick={() => onToast(t('placeholder.toast_coming').replace('{title}', title), 'info')}
          style={{ padding: '10px 24px', borderRadius: 11, fontSize: 16, fontWeight: 800, background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
          {t('placeholder.access').replace('{title}', title)}
        </button>
      </div>
    </div>
  )
}
