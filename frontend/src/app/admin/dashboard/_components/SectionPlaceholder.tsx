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
    <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto font-nunito" style={{ height: '100%', overflowY: 'auto' }}>
      <div>
        <h1 className="text-xl md:text-2xl font-bold font-spectral" style={{ color: 'var(--text)' }}>{title}</h1>
        <p className="text-xs md:text-sm font-medium mt-0.5" style={{ color: 'var(--text2)' }}>{description}</p>
      </div>
      <div className="rounded-xl p-8 text-center max-w-md mx-auto" style={{ background: 'var(--surface)', border: '1.5px solid var(--border)' }}>
        <div className="text-4xl mb-3">{icon}</div>
        <h2 className="text-base font-bold font-spectral mb-2" style={{ color: 'var(--text)' }}>
          {title}
        </h2>
        <p className="text-xs text-[var(--text2)] font-medium mb-5 leading-relaxed">
          {t('placeholder.message')}
        </p>
        <button
          onClick={() => onToast(`Section ${title} bientôt disponible`, 'info')}
          className="px-4 py-2 rounded-xl text-xs font-bold cursor-pointer border-none transition-all shadow-sm"
          style={{ background: 'var(--amber)', color: 'white' }}
        >
          Accéder à {title} →
        </button>
      </div>
    </div>
  )
}
