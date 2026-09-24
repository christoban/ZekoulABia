import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { renderAssistantText } from '@/app/admin/dashboard/_components/AssistantWidget'

describe('rendu des réponses de l’assistant', () => {
  it('rend le Markdown sans afficher les astérisques', () => {
    const html = renderToStaticMarkup(renderAssistantText('**Nom** : salle\n- capacité\n- type'))

    expect(html).toContain('<strong>Nom</strong>')
    expect(html).toContain('•')
    expect(html).not.toContain('**')
  })
})
