'use client'

import type { MutableRefObject, RefObject } from 'react'
import { BookOpen, GraduationCap, School } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useT } from '@/lib/i18n'
import type { LevelFamily, OfferFlag, SchoolStructure, SecondarySpan } from '@/lib/onboarding/phase1Profile'
import type { TemplateCatalogEntry } from '@/lib/onboarding/templateCatalogTypes'
import { REGIONS, toSlug } from '../_helpers/constants'
import type { FormData } from '../_helpers/types'
import { CheckboxGroup, Field, INPUT, RadioCards, SubmitBtn } from './OnboardingPrimitives'
import TemplateDetectorSection from './TemplateDetectorSection'

interface Props {
  form: FormData
  set: (k: keyof FormData) => (v: string) => void
  setWithTemplateReset: (k: 'subsystem' | 'ownership') => (v: string) => void
  slRef: MutableRefObject<boolean>
  logoInputRef: RefObject<HTMLInputElement | null>
  subsystemOptions: { value: string; label: string; icon: LucideIcon }[]
  ownershipOptions: { value: string; label: string; icon: LucideIcon }[]
  structure: SchoolStructure | null
  setStructure: (v: SchoolStructure | null) => void
  levelFamily: LevelFamily | null
  setLevelFamily: (v: LevelFamily | null) => void
  offers: OfferFlag[]
  setOffers: (v: OfferFlag[]) => void
  secondarySpan: SecondarySpan
  setSecondarySpan: (v: SecondarySpan) => void
  template: TemplateCatalogEntry | null
  templateCatalog: TemplateCatalogEntry[]
  filteredTemplates: TemplateCatalogEntry[]
  selectedTemplateCode: string | null
  setSelectedTemplateCode: (code: string | null) => void
  effectiveCode: string | null
  suggestedCode: string | null
  currentLang: string
  handleLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onNext: () => void
}

export default function OnboardingStep1({
  form,
  set,
  setWithTemplateReset,
  slRef,
  logoInputRef,
  subsystemOptions,
  ownershipOptions,
  structure,
  setStructure,
  levelFamily,
  setLevelFamily,
  offers,
  setOffers,
  secondarySpan,
  setSecondarySpan,
  template,
  templateCatalog,
  filteredTemplates,
  selectedTemplateCode,
  setSelectedTemplateCode,
  effectiveCode,
  suggestedCode,
  currentLang,
  handleLogoUpload,
  onNext,
}: Props) {
  const t = useT('onboarding')

  const secondarySpanOptions = (
    offers.includes('GENERAL')
      ? form.subsystem === 'FRANCOPHONE'
        ? [
            { value: 'TO_3E', label: t('phase1.step1.secondarySpan.TO_3E') },
            { value: 'TO_TLE', label: t('phase1.step1.secondarySpan.TO_TLE') },
          ]
        : form.subsystem === 'ANGLOPHONE'
          ? [
              { value: 'TO_FORM5', label: t('phase1.step1.secondarySpan.TO_FORM5') },
              { value: 'TO_UPPER_SIXTH', label: t('phase1.step1.secondarySpan.TO_UPPER_SIXTH') },
            ]
          : [{ value: 'TO_TLE', label: t('phase1.step1.secondarySpan.TO_TLE') }]
      : []
  )
    .concat(
      offers.includes('TECHNICAL')
        ? [
            { value: 'TECH_1ER', label: t('phase1.step1.secondarySpan.TECH_1ER') },
            { value: 'TECH_FULL', label: t('phase1.step1.secondarySpan.TECH_FULL') },
          ]
        : []
    )
    .concat(
      offers.includes('PROFESSIONAL')
        ? [
            { value: 'PRO_SAR', label: t('phase1.step1.secondarySpan.PRO_SAR') },
            { value: 'PRO_CFM', label: t('phase1.step1.secondarySpan.PRO_CFM') },
          ]
        : []
    )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <Field label={t('phase1.step1.schoolName.label')} required>
        <input className="edu-field" value={form.nom} style={INPUT} onChange={(e) => set('nom')(e.target.value)} placeholder={t('phase1.step1.schoolName.placeholder')} />
      </Field>

      <Field label={t('phase1.step1.subdomain.label')} required>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 13, fontWeight: 700, color: 'var(--text3)' }}>{t('phase1.step1.subdomain.prefix')}</span>
          <input
            className="edu-field"
            value={form.subdomain}
            style={{ ...INPUT, paddingLeft: 106 }}
            onChange={(e) => {
              slRef.current = true
              set('subdomain')(toSlug(e.target.value))
            }}
            placeholder={t('phase1.step1.subdomain.placeholder')}
          />
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, fontWeight: 600 }}>{t('phase1.step1.subdomain.hint')}</div>
      </Field>

      <Field label={t('phase1.step1.subsystem.label')} required>
        <RadioCards
          options={subsystemOptions}
          value={form.subsystem}
          onChange={(value) => {
            setSelectedTemplateCode(null)
            setStructure(null)
            setLevelFamily(null)
            setOffers([])
            setSecondarySpan(null)
            setWithTemplateReset('subsystem')(value)
          }}
        />
      </Field>

      {form.subsystem && (
        <Field label={t('phase1.step1.structure.label')} required>
          <RadioCards
            options={[
              { value: 'MONO', label: t('phase1.step1.structure.options.MONO.label'), icon: School },
              { value: 'COMPLEX', label: t('phase1.step1.structure.options.COMPLEX.label'), icon: GraduationCap },
            ]}
            value={structure ?? ''}
            onChange={(value) => {
              const next = value as SchoolStructure
              setStructure(next)
              setSelectedTemplateCode(null)
              if (next === 'COMPLEX') {
                setLevelFamily(null)
                setSecondarySpan(null)
              }
            }}
          />
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 5, fontWeight: 600 }}>
            {structure === 'COMPLEX' ? t('phase1.step1.structure.options.COMPLEX.desc') : structure === 'MONO' ? t('phase1.step1.structure.options.MONO.desc') : ''}
          </div>
        </Field>
      )}

      {structure === 'MONO' && (
        <Field label={t('phase1.step1.levelFamily.label')} required>
          <RadioCards
            options={[
              { value: 'MATERNELLE_NURSERY', label: t('phase1.step1.levelFamily.options.MATERNELLE_NURSERY.label'), icon: School },
              { value: 'PRIMARY', label: t('phase1.step1.levelFamily.options.PRIMARY.label'), icon: BookOpen },
              { value: 'SECONDARY', label: t('phase1.step1.levelFamily.options.SECONDARY.label'), icon: GraduationCap },
            ]}
            value={levelFamily ?? ''}
            onChange={(value) => {
              setLevelFamily(value as LevelFamily)
              setSecondarySpan(null)
              setSelectedTemplateCode(null)
            }}
          />
        </Field>
      )}

      {(structure === 'MONO' || structure === 'COMPLEX') && (
        <Field label={t('phase1.step1.offers.label')} required>
          <CheckboxGroup
            options={(['GENERAL', 'TECHNICAL', 'PROFESSIONAL'] as OfferFlag[]).map((offer) => ({ value: offer, label: t(`phase1.step1.offers.${offer}`) }))}
            values={offers}
            onChange={(values) => {
              setOffers(values as OfferFlag[])
              setSecondarySpan(null)
              setSelectedTemplateCode(null)
            }}
            note={structure === 'COMPLEX' ? t('phase1.step1.offers.complexHint') : t('phase1.step1.offers.hint')}
          />
        </Field>
      )}

      {structure === 'MONO' && levelFamily === 'SECONDARY' && offers.length > 0 && (
        <Field label={t('phase1.step1.secondarySpan.label')} required>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {secondarySpanOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setSecondarySpan(option.value as SecondarySpan)
                  setSelectedTemplateCode(null)
                }}
                style={{
                  padding: '9px 12px',
                  border: `2px solid ${secondarySpan === option.value ? 'var(--primary)' : 'var(--border2)'}`,
                  borderRadius: 10,
                  background: secondarySpan === option.value ? 'rgba(180,83,42,0.07)' : 'white',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 13,
                  fontWeight: 700,
                  color: secondarySpan === option.value ? 'var(--green2)' : 'var(--text2)',
                  textAlign: 'left',
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </Field>
      )}

      <Field label={t('phase1.step1.ownership.label')} required>
        <RadioCards options={ownershipOptions} value={form.ownership} onChange={setWithTemplateReset('ownership')} />
      </Field>

      <TemplateDetectorSection
        form={form}
        template={template}
        templateCatalog={templateCatalog}
        filteredTemplates={filteredTemplates}
        selectedTemplateCode={selectedTemplateCode}
        setSelectedTemplateCode={setSelectedTemplateCode}
        effectiveCode={effectiveCode}
        suggestedCode={suggestedCode}
        currentLang={currentLang}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label={t('phase1.step1.city.label')}>
          <input className="edu-field" value={form.ville} style={INPUT} onChange={(e) => set('ville')(e.target.value)} placeholder={t('phase1.step1.city.placeholder')} />
        </Field>
        <Field label={t('phase1.step1.region.label')}>
          <select className="edu-field" value={form.region} style={{ ...INPUT, appearance: 'none', backgroundImage: 'none' }} onChange={(e) => set('region')(e.target.value)}>
            <option value="">{t('common.selectRegion')}</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label={t('phase1.step1.phone.label')}>
        <input className="edu-field" value={form.telephone} style={INPUT} onChange={(e) => set('telephone')(e.target.value)} placeholder={t('phase1.step1.phone.placeholder')} />
      </Field>

      <Field label={t('phase1.step1.logo.label')}>
        <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            onClick={() => logoInputRef.current?.click()}
            style={{
              width: 72,
              height: 72,
              borderRadius: 14,
              border: `2px dashed ${form.logoBase64 ? 'var(--primary)' : 'var(--border2)'}`,
              background: form.logoBase64 ? 'transparent' : 'var(--bg2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              overflow: 'hidden',
              flexShrink: 0,
              transition: 'all 0.15s',
            }}
          >
            {form.logoBase64 ? <img src={form.logoBase64} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <School size={28} strokeWidth={2} style={{ color: 'var(--text3)' }} />}
          </div>
          <div>
            <button type="button" onClick={() => logoInputRef.current?.click()} style={{ padding: '9px 16px', border: '1.5px solid var(--border2)', borderRadius: 9, background: 'var(--surface)', fontSize: 14, fontWeight: 700, color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 6 }}>
              {form.logoBase64 ? t('phase1.step1.logo.change') : t('phase1.step1.logo.upload')}
            </button>
            <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>{t('phase1.step1.logo.hint')}</div>
            {form.logoBase64 && (
              <button type="button" onClick={() => set('logoBase64')('')} style={{ marginTop: 4, fontSize: 12, fontWeight: 700, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                {t('phase1.step1.logo.remove')}
              </button>
            )}
          </div>
        </div>
      </Field>

      <SubmitBtn onClick={onNext}>{t('phase1.buttons.step1Submit')}</SubmitBtn>
    </div>
  )
}
