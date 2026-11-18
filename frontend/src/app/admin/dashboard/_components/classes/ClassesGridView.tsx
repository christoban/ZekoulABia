'use client'
import React from 'react'
import { GraduationCap, Armchair, UserCheck, Trash2 } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { isSixthForm, isLV2Level } from '@/features/classes/classesShared'
import { btnSecSm, getLevelBadge, type ClassItem, type SchoolInfo } from './classesUi'

interface Props {
  classes: ClassItem[]
  schoolInfo: SchoolInfo | null
  onOpenPP: (cls: ClassItem) => void
  onOpenEdit: (cls: ClassItem) => void
  onOpenSubgroups: (cls: ClassItem) => void
  onOpenLV2: (cls: ClassItem) => void
  onOpenPEBS: (cls: ClassItem) => void
  onOpenALevel: (cls: ClassItem) => void
  onDelete: (cls: ClassItem) => void
}

function renderFiliereBadge(cls: ClassItem, t: ReturnType<typeof useT>, mobile: boolean) {
  const badge = cls.pebsBadge ?? null
  const isPEBSFiliere = cls.filiere === 'FR_PEBS' || cls.filiere === 'EN_PEBS'
  const pad = '3.5px 9.5px'
  const deskPad = '2.5px 9.5px'
  const borderRadius = mobile ? 8 : 20
  const padding = mobile ? pad : deskPad

  if (badge === 'PEBS' || isPEBSFiliere) {
    const label = cls.filiere === 'EN_PEBS' ? 'PEBS EN' : 'PEBS FR'
    return (
      <span style={{ background: mobile ? 'var(--green-light)' : 'rgba(22,163,74,0.12)', color: 'var(--green)', padding, borderRadius, fontSize: 12, fontWeight: 800 }}>
        {label}
      </span>
    )
  }
  if (badge === 'MIXTE') {
    return (
      <span style={{ background: 'rgba(234,179,8,0.12)', color: '#b45309', padding, borderRadius, fontSize: 12, fontWeight: 800 }}>
        {t('classes.filiere_labels.MIXTE')}
      </span>
    )
  }
  if (badge === 'GENERAL') {
    return (
      <span style={{ background: 'var(--blue-light)', color: 'var(--blue)', padding, borderRadius, fontSize: 12, fontWeight: 800 }}>
        {t('classes.filiere_labels.GENERAL')}
      </span>
    )
  }
  if (cls.filiere && !['FR_PEBS', 'EN_PEBS', 'FR_GENERAL', 'EN_GENERAL'].includes(cls.filiere)) {
    return (
      <span style={{ background: 'var(--blue-light)', color: 'var(--blue)', padding, borderRadius, fontSize: 12, fontWeight: mobile ? 700 : 800 }}>
        {cls.filiere}
      </span>
    )
  }
  return null
}

export default function ClassesGridView({
  classes,
  schoolInfo,
  onOpenPP,
  onOpenEdit,
  onOpenSubgroups,
  onOpenLV2,
  onOpenPEBS,
  onOpenALevel,
  onDelete,
}: Props) {
  const t = useT('admin')
  const hasPebs = Boolean(schoolInfo?.hasPEBSFrancophone || schoolInfo?.hasPEBSAnglophone)
  const cardBtnMobile: React.CSSProperties = {
    flex: 1, minHeight: '38px', fontSize: 13, fontWeight: 800, color: 'var(--text2)',
    background: 'var(--bg2)', border: 'none', borderRadius: 9, padding: '9px 0', cursor: 'pointer',
    fontFamily: 'inherit', whiteSpace: 'nowrap',
  }

  return (
    <>
      {/* ── Cartes empilées — mobile ── */}
      <div className="md:hidden flex flex-col" style={{ gap: 10 }}>
        {classes.map(cls => {
          const badge = getLevelBadge(cls.name, t)
          const ppName = cls.professorPrincipal
            ? `${cls.professorPrincipal.firstName} ${cls.professorPrincipal.lastName}`
            : t('classes.pp_not_assigned')
          return (
            <div key={cls.id} className="rounded-[16px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)]" style={{ background: 'var(--surface)', padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{cls.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: badge.color, background: badge.bg, borderRadius: 8, padding: '3px 9px' }}>{badge.label}</span>
                  <button
                    onClick={() => onDelete(cls)}
                    style={{ width: 28, height: 28, borderRadius: 8, background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--red)', flexShrink: 0, cursor: 'pointer' }}
                  >
                    <Trash2 size={14} strokeWidth={2} />
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 10 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text2)' }}>
                  <GraduationCap size={15} strokeWidth={2} color="var(--text3)" /> {t('classes.student_count').replace('{count}', String(cls._count.students))}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text2)' }}>
                  <Armchair size={15} strokeWidth={2} color="var(--text3)" /> {t('classes.capacity_label').replace('{capacity}', String(cls.capacity))}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 13, color: 'var(--text2)' }}>
                <UserCheck size={15} strokeWidth={2} color="var(--text3)" /> {t('classes.pp_label')}{' '}
                <span style={{ fontStyle: cls.professorPrincipal ? 'normal' : 'italic', color: cls.professorPrincipal ? 'var(--text2)' : 'var(--text3)' }}>{ppName}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                {renderFiliereBadge(cls, t, true)}
                {cls.serie && (
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text2)', background: 'var(--bg2)', borderRadius: 8, padding: '3.5px 9.5px' }}>
                    {t('classes.serie_label').replace('{serie}', cls.serie)}
                  </span>
                )}
                {isLV2Level(cls) && (
                  <button
                    onClick={() => onOpenLV2(cls)}
                    style={{ fontSize: 12, fontWeight: 800, color: 'var(--blue)', background: 'var(--blue-light)', border: 'none', borderRadius: 8, padding: '3.5px 9.5px', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    {t('classes.btn_lv2')}
                  </button>
                )}
                {hasPebs && (
                  <button
                    onClick={() => onOpenPEBS(cls)}
                    style={{ fontSize: 12, fontWeight: 800, color: 'var(--green)', background: 'var(--green-light)', border: 'none', borderRadius: 8, padding: '3.5px 9.5px', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    {t('classes.btn_pebs')}
                  </button>
                )}
                {isSixthForm(cls) && (
                  <button
                    onClick={() => onOpenALevel(cls)}
                    style={{ fontSize: 12, fontWeight: 700, color: 'var(--purple)', background: 'var(--purple-light)', border: 'none', borderRadius: 8, padding: '3.5px 9.5px', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    {t('classes.btn_alevel')}
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--bg2)' }}>
                <button onClick={() => onOpenPP(cls)} style={cardBtnMobile}>{t('classes.btn_pp')}</button>
                <button onClick={() => onOpenEdit(cls)} style={cardBtnMobile}>{t('classes.btn_edit')}</button>
                <button onClick={() => onOpenSubgroups(cls)} style={{ ...cardBtnMobile, flex: 1.4 }}>{t('classes.btn_subgroups')}</button>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Grille — desktop ── */}
      <div className="hidden md:grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 16 }}>
        {classes.map(cls => {
          const badge = getLevelBadge(cls.name, t)
          const ppName = cls.professorPrincipal
            ? `${cls.professorPrincipal.firstName} ${cls.professorPrincipal.lastName}`
            : t('classes.pp_not_assigned')
          return (
            <div
              key={cls.id}
              style={{ background: 'var(--surface)', borderRadius: 14, border: '1.5px solid var(--border)', padding: '16px 18px', transition: 'all 0.15s' }}
              onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(0,0,0,0.07)', borderColor: 'var(--border2)' })}
              onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'none', boxShadow: 'none', borderColor: 'var(--border)' })}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>{cls.name}</div>
                <span style={{ background: badge.bg, color: badge.color, padding: '2.5px 9px', borderRadius: 20, fontSize: 11.5, fontWeight: 800 }}>{badge.label}</span>
              </div>
              <div style={{ display: 'flex', gap: 14, fontSize: 13, color: 'var(--text2)', fontWeight: 600, marginBottom: 9 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <GraduationCap size={15} color="var(--text3)" /> {t('classes.student_count').replace('{count}', String(cls._count.students))}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Armchair size={15} color="var(--text3)" /> {t('classes.capacity_label').replace('{capacity}', String(cls.capacity))}
                </span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text3)', fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                <UserCheck size={15} color="var(--text3)" /> {t('classes.pp_label')}{' '}
                <strong style={{ color: cls.professorPrincipal ? 'var(--text2)' : 'var(--text3)', fontStyle: cls.professorPrincipal ? 'normal' : 'italic' }}>{ppName}</strong>
              </div>
              <div style={{ marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {renderFiliereBadge(cls, t, false)}
                {cls.serie && (
                  <span style={{ background: 'var(--bg2)', color: 'var(--text2)', padding: '2.5px 9.5px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                    {t('classes.serie_label').replace('{serie}', cls.serie)}
                  </span>
                )}
              </div>
              <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <button onClick={() => onOpenPP(cls)} style={btnSecSm}>{t('classes.btn_pp')}</button>
                <button onClick={() => onOpenEdit(cls)} style={btnSecSm}>{t('classes.btn_edit')}</button>
                <button onClick={() => onOpenSubgroups(cls)} style={btnSecSm}>{t('classes.btn_subgroups')}</button>
                {isLV2Level(cls) && (
                  <button onClick={() => onOpenLV2(cls)} style={{ ...btnSecSm, color: 'var(--blue)', borderColor: 'rgba(3,105,161,0.3)' }}>{t('classes.btn_lv2')}</button>
                )}
                {hasPebs && (
                  <button onClick={() => onOpenPEBS(cls)} style={{ ...btnSecSm, color: 'var(--green)', borderColor: 'rgba(22,163,74,0.3)' }}>{t('classes.btn_pebs')}</button>
                )}
                {isSixthForm(cls) && (
                  <button onClick={() => onOpenALevel(cls)} style={{ ...btnSecSm, color: 'var(--purple)', borderColor: 'rgba(124,58,237,0.3)' }}>{t('classes.btn_alevel')}</button>
                )}
                <button onClick={() => onDelete(cls)} style={{ ...btnSecSm, color: 'var(--red)', borderColor: 'rgba(220,38,38,0.3)', display: 'inline-flex', alignItems: 'center' }}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
