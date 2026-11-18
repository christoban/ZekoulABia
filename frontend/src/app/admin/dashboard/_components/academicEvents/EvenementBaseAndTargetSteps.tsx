'use client'

import { useT } from '@/lib/i18n'
import { EVENT_TYPES, type ClassOption, type EventCategory } from './types'

interface EvenementBaseAndTargetStepsProps {
  currentStep: number
  isConcours: boolean
  type: string
  onTypeChange: (newType: string) => void
  category: EventCategory
  setCategory: (c: EventCategory) => void
  title: string
  setTitle: (v: string) => void
  description: string
  setDescription: (v: string) => void
  level: string
  setLevel: (v: string) => void
  niveaux: string[]
  targetClassId: string
  setTargetClassId: (v: string) => void
  classes: ClassOption[]
  availableSeats: number
  setAvailableSeats: (v: number) => void
  admissionThreshold: number
  setAdmissionThreshold: (v: number) => void
  openDate: string
  setOpenDate: (v: string) => void
  closeDate: string
  setCloseDate: (v: string) => void
  officialExamExpectedDate: string
  setOfficialExamExpectedDate: (v: string) => void
}

export default function EvenementBaseAndTargetSteps(props: EvenementBaseAndTargetStepsProps) {
  const t = useT('admin')

  return (
    <>
      {props.currentStep === 1 && (
        <div className="flex flex-col gap-3.5">
          <div>
            <label className="font-bold text-[11.5px] text-[var(--text2)] block mb-1">
              {t('academicEvents.formType')}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {EVENT_TYPES.map((ty) => (
                <button
                  key={ty}
                  type="button"
                  onClick={() => props.onTypeChange(ty)}
                  className={`text-left p-2.5 rounded-xl border transition-all flex items-center justify-between ${
                    props.type === ty
                      ? 'border-purple-600 bg-purple-500/10 text-purple-700 font-bold'
                      : 'border-[var(--border)] hover:bg-[var(--bg2)] text-[var(--text)]'
                  }`}
                >
                  <span className="text-xs">{t(`academicEvents.type.${ty}`)}</span>
                  {ty === 'CONCOURS_ENTREE' && (
                    <span className="text-[9.5px] px-1.5 py-0.5 rounded-md bg-purple-600 text-white font-bold">
                      Standard
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="font-bold text-[11.5px] text-[var(--text2)] block mb-1">
              {t('academicEvents.formTitle')} *
            </label>
            <input
              value={props.title}
              onChange={e => props.setTitle(e.target.value)}
              placeholder={t('academicEvents.formTitlePlaceholder')}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border2)] bg-[var(--bg2)] text-xs text-[var(--text)] outline-none focus:border-purple-600"
            />
          </div>

          <div>
            <label className="font-bold text-[11.5px] text-[var(--text2)] block mb-1">
              {t('academicEvents.formCategory')}
            </label>
            <select
              value={props.category}
              onChange={e => props.setCategory(e.target.value as EventCategory)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border2)] bg-[var(--bg2)] text-xs text-[var(--text)] outline-none"
            >
              <option value="FIXED_DATE">{t('academicEvents.category.FIXED_DATE')}</option>
              <option value="MANUAL_TRIGGER">{t('academicEvents.category.MANUAL_TRIGGER')}</option>
              <option value="SLIDING_WINDOW">{t('academicEvents.category.SLIDING_WINDOW')}</option>
            </select>
            <p className="text-[10.5px] text-[var(--text3)] mt-1">
              {t(`academicEvents.categoryHint.${props.category}`)}
            </p>
          </div>

          <div>
            <label className="font-bold text-[11.5px] text-[var(--text2)] block mb-1">
              {t('academicEvents.formDescription')}
            </label>
            <textarea
              value={props.description}
              onChange={e => props.setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border2)] bg-[var(--bg2)] text-xs text-[var(--text)] outline-none resize-none"
            />
          </div>
        </div>
      )}

      {props.isConcours && props.currentStep === 2 && (
        <div className="flex flex-col gap-3.5">
          <div className="p-3 rounded-xl border border-purple-500/20 bg-purple-500/5 text-xs text-[var(--text)]">
            <p className="font-bold text-xs text-purple-700 mb-0.5">Configuration des cibles du concours</p>
            <p className="text-[11px] text-[var(--text2)]">
              Le concours s&apos;adresse principalement aux élèves entrant en 6e. Les admis rejoindront la voie concours sans validation supplémentaire de la direction.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-[11.5px] text-[var(--text2)] block mb-1">
                {t('academicEvents.wizard.targetLevel')}
              </label>
              <select
                value={props.level}
                onChange={e => props.setLevel(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border2)] bg-[var(--bg2)] text-xs text-[var(--text)] outline-none"
              >
                <option value="6e">6e (Par défaut)</option>
                {props.niveaux.filter(n => n !== '6e').map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-[11.5px] text-[var(--text2)] block mb-1">
                {t('academicEvents.wizard.targetClass')}
              </label>
              <select
                value={props.targetClassId}
                onChange={e => props.setTargetClassId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border2)] bg-[var(--bg2)] text-xs text-[var(--text)] outline-none"
              >
                <option value="">{t('academicEvents.wizard.selectClassPlaceholder')}</option>
                {props.classes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.level})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-[11.5px] text-[var(--text2)] block mb-1">
                {t('academicEvents.wizard.availableSeats')}
              </label>
              <input
                type="number"
                value={props.availableSeats}
                onChange={e => props.setAvailableSeats(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border2)] bg-[var(--bg2)] text-xs text-[var(--text)] outline-none"
                placeholder="120"
              />
            </div>

            <div>
              <label className="font-bold text-[11.5px] text-[var(--text2)] block mb-1">
                {t('academicEvents.wizard.admissionThreshold')}
              </label>
              <input
                type="number"
                step="0.5"
                value={props.admissionThreshold}
                onChange={e => props.setAdmissionThreshold(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border2)] bg-[var(--bg2)] text-xs text-[var(--text)] outline-none"
                placeholder="10.0"
              />
            </div>
          </div>
        </div>
      )}

      {((props.isConcours && props.currentStep === 3) || (!props.isConcours && props.currentStep === 2)) && (
        <div className="flex flex-col gap-3.5">
          <div className="p-3 rounded-xl border border-blue-500/20 bg-blue-500/5 text-xs text-[var(--text)]">
            <p className="font-bold text-xs text-blue-700 mb-0.5">Calendrier avec heures précises</p>
            <p className="text-[11px] text-[var(--text2)]">
              Définissez les dates et heures de début et de fin. La session liée synchronisera sa période d&apos;inscription.
            </p>
          </div>

          {props.category !== 'MANUAL_TRIGGER' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-[11.5px] text-[var(--text2)] block mb-1">
                  {t('academicEvents.formOpenDate')} *
                </label>
                <input
                  type="datetime-local"
                  value={props.openDate}
                  onChange={e => props.setOpenDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border2)] bg-[var(--bg2)] text-xs text-[var(--text)] outline-none"
                />
              </div>
              <div>
                <label className="font-bold text-[11.5px] text-[var(--text2)] block mb-1">
                  {t('academicEvents.formCloseDate')} *
                </label>
                <input
                  type="datetime-local"
                  value={props.closeDate}
                  onChange={e => props.setCloseDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border2)] bg-[var(--bg2)] text-xs text-[var(--text)] outline-none"
                />
              </div>
            </div>
          )}

          {props.isConcours && (
            <div>
              <label className="font-bold text-[11.5px] text-[var(--text2)] block mb-1">
                {t('academicEvents.wizard.officialExamDate')}
              </label>
              <input
                type="date"
                value={props.officialExamExpectedDate}
                onChange={e => props.setOfficialExamExpectedDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border2)] bg-[var(--bg2)] text-xs text-[var(--text)] outline-none"
              />
              <p className="text-[10.5px] text-[var(--text3)] mt-1">
                Date estimée de proclamation des résultats nationaux pour rappel de vérification.
              </p>
            </div>
          )}

          {!props.isConcours && props.type === 'CHOIX_LV2' && (
            <div>
              <label className="font-bold text-[11.5px] text-[var(--text2)] block mb-1">
                {t('academicEvents.formLevel')} *
              </label>
              <select
                value={props.level}
                onChange={e => props.setLevel(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border2)] bg-[var(--bg2)] text-xs text-[var(--text)] outline-none"
              >
                <option value="">{t('academicEvents.formLevelPlaceholder')}</option>
                {props.niveaux.map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </>
  )
}
