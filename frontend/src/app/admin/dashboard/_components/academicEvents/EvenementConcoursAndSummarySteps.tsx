'use client'

import { CheckCircle2, Plus, Trash2 } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { ALL_ROLES, type EventCategory, type SubjectItem } from './types'

interface EvenementConcoursAndSummaryStepsProps {
  currentStep: number
  isConcours: boolean
  type: string
  category: EventCategory
  title: string
  availableSeats: number
  admissionThreshold: number
  subjects: SubjectItem[]
  onAddSubject: () => void
  onRemoveSubject: (idx: number) => void
  onUpdateSubject: (idx: number, patch: Partial<SubjectItem>) => void
  concoursFees: number
  setConcoursFees: (v: number) => void
  requireCepForAdmission: boolean
  setRequireCepForAdmission: (v: boolean) => void
  docsChecklist: string[]
  targetRoles: string[]
  onToggleRole: (role: string) => void
}

export default function EvenementConcoursAndSummarySteps(props: EvenementConcoursAndSummaryStepsProps) {
  const t = useT('admin')

  return (
    <>
      {props.isConcours && props.currentStep === 4 && (
        <div className="flex flex-col gap-3.5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-xs text-[var(--text)]">
                {t('academicEvents.wizard.subjectsTitle')}
              </p>
              <p className="text-[11px] text-[var(--text3)]">
                Matières soumises à notation avec coefficients et barèmes.
              </p>
            </div>
            <button
              type="button"
              onClick={props.onAddSubject}
              className="px-2.5 py-1 rounded-lg bg-purple-600 text-white text-xs font-bold flex items-center gap-1 hover:bg-purple-700"
            >
              <Plus size={13} /> {t('academicEvents.wizard.addSubject')}
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {props.subjects.map((sub, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl border border-[var(--border)] bg-[var(--bg)]/50 flex flex-wrap items-center gap-2"
              >
                <div className="flex-1 min-w-[130px]">
                  <input
                    value={sub.name}
                    onChange={e => props.onUpdateSubject(idx, { name: e.target.value })}
                    className="w-full px-2 py-1 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-xs font-bold text-[var(--text)] outline-none"
                    placeholder="Matière"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-[var(--text3)]">Coef.</span>
                  <input
                    type="number"
                    min="1"
                    value={sub.coefficient}
                    onChange={e => props.onUpdateSubject(idx, { coefficient: Number(e.target.value) || 1 })}
                    className="w-12 px-1.5 py-1 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-xs text-center text-[var(--text)] outline-none"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-[var(--text3)]">Max</span>
                  <input
                    type="number"
                    min="1"
                    value={sub.maxScore}
                    onChange={e => props.onUpdateSubject(idx, { maxScore: Number(e.target.value) || 20 })}
                    className="w-12 px-1.5 py-1 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-xs text-center text-[var(--text)] outline-none"
                  />
                </div>
                {props.subjects.length > 1 && (
                  <button
                    type="button"
                    onClick={() => props.onRemoveSubject(idx)}
                    className="p-1 text-red-500 hover:bg-red-500/10 rounded-md"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {props.isConcours && props.currentStep === 5 && (
        <div className="flex flex-col gap-3.5">
          <div>
            <label className="font-bold text-[11.5px] text-[var(--text2)] block mb-1">
              {t('academicEvents.wizard.concoursFees')}
            </label>
            <input
              type="number"
              value={props.concoursFees}
              onChange={e => props.setConcoursFees(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border2)] bg-[var(--bg2)] text-xs text-[var(--text)] outline-none"
              placeholder="5000"
            />
          </div>

          <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--bg2)]/60">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={props.requireCepForAdmission}
                onChange={e => props.setRequireCepForAdmission(e.target.checked)}
                className="mt-0.5"
              />
              <div>
                <span className="font-bold text-xs text-[var(--text)] block">
                  {t('academicEvents.wizard.requireCep')}
                </span>
                <span className="text-[10.5px] text-[var(--text3)] block mt-0.5">
                  {t('academicEvents.wizard.requireCepHint')}
                </span>
              </div>
            </label>
          </div>

          <div>
            <label className="font-bold text-[11.5px] text-[var(--text2)] block mb-1">
              {t('academicEvents.wizard.requiredDocs')}
            </label>
            <div className="flex flex-col gap-1.5">
              {props.docsChecklist.map((doc, idx) => (
                <div
                  key={idx}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)]/50 text-xs flex items-center justify-between"
                >
                  <span>{doc}</span>
                  <CheckCircle2 size={14} className="text-success" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {((props.isConcours && props.currentStep === 6) || (!props.isConcours && props.currentStep === 3)) && (
        <div className="flex flex-col gap-3.5">
          <div>
            <label className="font-bold text-[11.5px] text-[var(--text2)] block mb-1">
              {t('academicEvents.formRoles')}
            </label>
            <p className="text-[11px] text-[var(--text3)] mb-3">
              {props.isConcours
                ? t('academicEvents.wizard.rolesHint')
                : "Sélectionnez les personnes de l'établissement informées par la cloche in-app."}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ALL_ROLES.map((r) => {
                const isSelected = props.targetRoles.includes(r)
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => props.onToggleRole(r)}
                    className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                      isSelected
                        ? 'border-purple-600 bg-purple-500/10 text-purple-700 font-bold'
                        : 'border-[var(--border)] hover:bg-[var(--bg2)] text-[var(--text2)]'
                    }`}
                  >
                    <span className="text-xs">{t(`academicEvents.roleNames.${r}`) ?? r}</span>
                    {isSelected && <CheckCircle2 size={15} />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {((props.isConcours && props.currentStep === 7) || (!props.isConcours && props.currentStep === 4)) && (
        <div className="flex flex-col gap-3">
          <div className="p-3.5 rounded-xl border border-purple-500/20 bg-purple-500/5">
            <h4 className="font-bold text-xs text-purple-700 mb-2">
              {t('academicEvents.wizard.summaryTitle')}
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[10.5px] text-[var(--text3)] block">Type</span>
                <span className="font-bold">{t(`academicEvents.type.${props.type}`)}</span>
              </div>
              <div>
                <span className="text-[10.5px] text-[var(--text3)] block">Mode</span>
                <span className="font-bold">{t(`academicEvents.category.${props.category}`)}</span>
              </div>
              <div className="col-span-2">
                <span className="text-[10.5px] text-[var(--text3)] block">Titre</span>
                <span className="font-bold">{props.title}</span>
              </div>
              {props.isConcours && (
                <>
                  <div>
                    <span className="text-[10.5px] text-[var(--text3)] block">Places</span>
                    <span className="font-bold">{props.availableSeats}</span>
                  </div>
                  <div>
                    <span className="text-[10.5px] text-[var(--text3)] block">Seuil</span>
                    <span className="font-bold">{props.admissionThreshold} / 20</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[10.5px] text-[var(--text3)] block">Épreuves</span>
                    <span className="font-bold">
                      {props.subjects.map(s => `${s.name} (×${s.coefficient})`).join(', ')}
                    </span>
                  </div>
                </>
              )}
              <div className="col-span-2">
                <span className="text-[10.5px] text-[var(--text3)] block">Rôles notifiés</span>
                <span className="font-bold">
                  {props.targetRoles.map(r => t(`academicEvents.roleNames.${r}`) ?? r).join(', ')}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
