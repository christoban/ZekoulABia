import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { renderAssistantText } from '@/app/admin/dashboard/_components/AssistantWidget'

describe('rendu des réponses de l’assistant', () => {
  it('rend les titres Markdown sans afficher les dièses', () => {
    const html = renderToStaticMarkup(renderAssistantText('### Prochaine étape\n- capacité'))

    expect(html).toContain('Prochaine étape')
    expect(html).toContain('•')
    expect(html).not.toContain('###')
  })
})
