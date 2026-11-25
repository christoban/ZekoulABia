'use client'

import type React from 'react'
import { useT } from '@/lib/i18n'
import {
  fmtRhDateTime,
  rhChipStyle,
  rhInputStyle,
  rhLabelStyle,
  type DocFormState,
  type EmployeeDetail,
  type EmployeeItem,
  type RhDocType,
} from './types'

interface RhDocumentsTabProps {
  employees: EmployeeItem[]
  currentEmployee: EmployeeItem | null
  selectedDetail: EmployeeDetail | null
  docEmployeeId: string
  setDocEmployeeId: (id: string) => void
  docType: RhDocType
  setDocType: (type: RhDocType) => void
  docForm: DocFormState
  setDocForm: React.Dispatch<React.SetStateAction<DocFormState>>
  onGenerateDoc: () => void
}

export default function RhDocumentsTab({
  employees,
  currentEmployee,
  selectedDetail,
  docEmployeeId,
  setDocEmployeeId,
  docType,
  setDocType,
  docForm,
  setDocForm,
  onGenerateDoc,
}: RhDocumentsTabProps) {
  const t = useT('admin')

  return (
    <div className="grid grid-cols-1 md:[grid-template-columns:1fr_1fr] gap-3 md:gap-3.5">
      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div className="text-[13px] md:text-[14px] px-[12px] py-[10px] md:px-[16px] md:py-[11px]" style={{ borderBottom: '1px solid var(--border)', fontWeight: 800, color: 'var(--text)' }}>{t('rh.generateDoc')}</div>
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div style={rhLabelStyle}>{t('rh.employee')}</div>
            <select value={docEmployeeId} onChange={e => setDocEmployeeId(e.target.value)} style={rhInputStyle}>
              <option value="">{t('rh.choose')}</option>
              {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.fullName}</option>)}
            </select>
          </div>
          <div>
            <div style={rhLabelStyle}>{t('rh.document')}</div>
            <select value={docType} onChange={e => setDocType(e.target.value as RhDocType)} style={rhInputStyle}>
              <option value="attestation">{t('rh.docAttestation')}</option>
              <option value="certificat">{t('rh.docCertificat')}</option>
              <option value="mission">{t('rh.docMission')}</option>
            </select>
          </div>
          {docType === 'mission' && (
            <>
              <div>
                <div style={rhLabelStyle}>{t('rh.motif')}</div>
                <input value={docForm.motif} onChange={e => setDocForm(prev => ({ ...prev, motif: e.target.value }))} style={rhInputStyle} placeholder={t('rh.motifPlaceholder')} />
              </div>
              <div>
                <div style={rhLabelStyle}>{t('rh.place')}</div>
                <input value={docForm.lieu} onChange={e => setDocForm(prev => ({ ...prev, lieu: e.target.value }))} style={rhInputStyle} placeholder={t('rh.placePlaceholder')} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <div style={rhLabelStyle}>{t('rh.startDate')}</div>
                  <input type="date" value={docForm.dateDebut} onChange={e => setDocForm(prev => ({ ...prev, dateDebut: e.target.value }))} style={rhInputStyle} />
                </div>
                <div>
                  <div style={rhLabelStyle}>{t('rh.endDate')}</div>
                  <input type="date" value={docForm.dateFin} onChange={e => setDocForm(prev => ({ ...prev, dateFin: e.target.value }))} style={rhInputStyle} />
                </div>
              </div>
              <div>
                <div style={rhLabelStyle}>{t('rh.signatory')}</div>
                <input value={docForm.signataire} onChange={e => setDocForm(prev => ({ ...prev, signataire: e.target.value }))} style={rhInputStyle} placeholder={t('rh.signatoryPlaceholder')} />
              </div>
            </>
          )}
          <button className="min-h-[38px] px-4" onClick={onGenerateDoc} style={{ ...rhChipStyle('var(--sidebar)', 'white'), border: 'none', cursor: 'pointer', justifyContent: 'center' }}>{t('rh.generate')}</button>
        </div>
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div className="text-[13px] md:text-[14px] px-[12px] py-[10px] md:px-[16px] md:py-[11px]" style={{ borderBottom: '1px solid var(--border)', fontWeight: 800, color: 'var(--text)' }}>{t('rh.preview')}</div>
        <div style={{ padding: '12px 14px', color: 'var(--text2)', lineHeight: 1.6, fontSize: 12.5 }}>
          {docType === 'attestation' && t('rh.previewAttestation')}
          {docType === 'certificat' && t('rh.previewCertificat')}
          {docType === 'mission' && t('rh.previewMission')}
          <div style={{ marginTop: 12, fontSize: 11.5, color: 'var(--text3)' }}>
            {t('rh.selectedEmployee')} <strong>{currentEmployee?.fullName ?? '—'}</strong>
            <br />{t('rh.lastFileUpdate')} <strong>{selectedDetail ? fmtRhDateTime(selectedDetail.employee.file ? (selectedDetail.employee.file.dateEmbauche ?? null) : null) : '—'}</strong>
          </div>
        </div>
      </div>
    </div>
  )
}
