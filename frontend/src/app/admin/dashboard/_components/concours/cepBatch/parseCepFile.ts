import * as XLSX from 'xlsx'
import type { CepProposeItem } from './types'

export function parseCepSpreadsheet(file: File): Promise<CepProposeItem[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws)

        const items: CepProposeItem[] = []
        for (const row of rawRows) {
          const keys = Object.keys(row)
          const findKey = (candidates: string[]) =>
            keys.find((k) => candidates.some((c) => k.toLowerCase().includes(c)))

          const nomKey = findKey(['nom', 'name', 'last'])
          const prenomKey = findKey(['prenom', 'first'])
          const numKey = findKey(['matricule', 'num', 'candidat'])
          const resKey = findKey(['result', 'decision', 'cep', 'mention'])

          const resVal = String(row[resKey || ''] || '').toLowerCase()
          const isReussi =
            resVal.includes('reussi') ||
            resVal.includes('admis') ||
            resVal.includes('pass') ||
            resVal.includes('oui') ||
            resVal === '1'
          const isEchoue =
            resVal.includes('echou') ||
            resVal.includes('refus') ||
            resVal.includes('fail') ||
            resVal.includes('non') ||
            resVal === '0'

          if (isReussi || isEchoue) {
            items.push({
              lastName: nomKey ? String(row[nomKey]) : undefined,
              firstName: prenomKey ? String(row[prenomKey]) : undefined,
              candidateNumber: numKey ? String(row[numKey]) : undefined,
              cepResult: isReussi ? 'REUSSI' : 'ECHOUE',
            })
          }
        }
        resolve(items)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('File read error'))
    reader.readAsBinaryString(file)
  })
}
