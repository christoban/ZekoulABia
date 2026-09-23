'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, Link2, Unlink } from 'lucide-react';

interface Props {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  minHeight?: number;
}

/**
 * Nettoie le code HTML collé (Word, web, etc.) pour ne garder
 * que la liste blanche stricte : p, br, strong, em, u, ul, ol, li, a.
 */
function sanitizePastedHtml(html: string): string {
  // Supprimer les commentaires conditionnels Word et balises XML
  let clean = html
    .replace(/<!--[\s\S]*?-->/gi, '')
    .replace(/<xml[\s\S]*?<\/xml>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '');

  const parser = new DOMParser();
  const doc = parser.parseFromString(clean, 'text/html');

  const allowedTags = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'UL', 'OL', 'LI', 'A']);

  function cleanNode(node: Node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toUpperCase();

      if (!allowedTags.has(tag)) {
        // Remplacer par des enfants ou du texte
        const parent = el.parentNode;
        if (parent) {
          while (el.firstChild) {
            parent.insertBefore(el.firstChild, el);
          }
          parent.removeChild(el);
        }
        return;
      }

      // Supprimer tous les attributs sauf href pour <a>
      const attrs = Array.from(el.attributes);
      for (const attr of attrs) {
        if (tag === 'A' && attr.name.toLowerCase() === 'href') {
          const val = attr.value.trim();
          if (!/^(https?:\/\/|mailto:|tel:)/i.test(val)) {
            el.removeAttribute('href');
          } else {
            el.setAttribute('target', '_blank');
            el.setAttribute('rel', 'noopener noreferrer');
          }
        } else {
          el.removeAttribute(attr.name);
        }
      }

      // Convertir <b> en <strong>, <i> en <em> si besoin
      if (tag === 'B') {
        const strong = doc.createElement('strong');
        strong.innerHTML = el.innerHTML;
        el.replaceWith(strong);
      } else if (tag === 'I') {
        const em = doc.createElement('em');
        em.innerHTML = el.innerHTML;
        el.replaceWith(em);
      }
    }

    const children = Array.from(node.childNodes);
    for (const child of children) {
      cleanNode(child);
    }
  }

  cleanNode(doc.body);
  return doc.body.innerHTML;
}

export default function LightweightRichEditor({
  value,
  onChange,
  placeholder = 'Rédigez votre communiqué officiel...',
  minHeight = 180,
}: Props) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const isInternalChange = useRef(false);

  // États actifs pour les boutons de la barre d'outils
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    ul: false,
    ol: false,
    link: false,
  });

  // Met à jour l'indicateur d'état actif lors des déplacements du curseur
  const updateActiveStates = useCallback(() => {
    if (typeof document === 'undefined') return;
    try {
      setActiveFormats({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        ul: document.queryCommandState('insertUnorderedList'),
        ol: document.queryCommandState('insertOrderedList'),
        link: Boolean(
          window.getSelection()?.focusNode?.parentElement?.closest('a')
        ),
      });
    } catch {
      // Ignorer si la sélection n'est pas dans le document
    }
  }, []);

  // Synchronisation initiale et lors des modifications externes
  useEffect(() => {
    if (editorRef.current && !isInternalChange.current) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || '';
      }
    }
    isInternalChange.current = false;
  }, [value]);

  // Exécution d'une commande de formatage native
  const executeCommand = (cmd: string, val: string | undefined = undefined) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    try {
      document.execCommand('styleWithCSS', false, 'false');
    } catch (_) {}
    document.execCommand(cmd, false, val);
    handleInput();
    updateActiveStates();
  };

  const handleInput = () => {
    if (!editorRef.current) return;
    isInternalChange.current = true;
    let html = editorRef.current.innerHTML;

    // Normaliser <b> -> <strong> et <i> -> <em> pour compatibilité universelle
    html = html.replace(/<b(\s[^>]*)?>/gi, '<strong>').replace(/<\/b>/gi, '</strong>');
    html = html.replace(/<i(\s[^>]*)?>/gi, '<em>').replace(/<\/i>/gi, '</em>');

    // Convertir les styles inline générés par certains navigateurs en balises sémantiques
    html = html
      .replace(/<span[^>]*style="[^"]*font-weight:\s*(bold|[7-9]00)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '<strong>$2</strong>')
      .replace(/<span[^>]*style="[^"]*font-style:\s*italic[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '<em>$2</em>')
      .replace(/<span[^>]*style="[^"]*text-decoration:\s*underline[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '<u>$2</u>');

    // Normaliser les conteneurs vides
    if (html === '<p><br></p>' || html === '<br>' || html === '<div><br></div>' || html === '<p></p>') {
      html = '';
    }
    onChange(html);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      const k = e.key.toLowerCase();
      if (k === 'b') {
        e.preventDefault();
        executeCommand('bold');
      } else if (k === 'i') {
        e.preventDefault();
        executeCommand('italic');
      } else if (k === 'u') {
        e.preventDefault();
        executeCommand('underline');
      }
    }
  };

  const handleLink = () => {
    if (activeFormats.link) {
      executeCommand('unlink');
      return;
    }

    const url = prompt('Adresse web du lien (ex: https://...) :');
    if (!url) return;
    const safeUrl = /^(https?:\/\/|mailto:|tel:)/i.test(url.trim())
      ? url.trim()
      : `https://${url.trim()}`;

    executeCommand('createLink', safeUrl);
    // Assurer target="_blank"
    if (editorRef.current) {
      const links = editorRef.current.querySelectorAll('a');
      links.forEach((a) => {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      });
      handleInput();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const clipboardData = e.clipboardData;
    const pastedHtml = clipboardData.getData('text/html');
    const pastedText = clipboardData.getData('text/plain');

    if (pastedHtml) {
      const clean = sanitizePastedHtml(pastedHtml);
      document.execCommand('insertHTML', false, clean);
    } else if (pastedText) {
      // Conversion des retours à la ligne en paragraphes propres
      const lines = pastedText.split(/\r?\n\r?\n/);
      const html = lines
        .map((p) => `<p>${p.replace(/\r?\n/g, '<br>')}</p>`)
        .join('');
      document.execCommand('insertHTML', false, html);
    }
    handleInput();
  };

  return (
    <div
      className="border rounded-lg bg-[var(--surface)] overflow-hidden transition-colors focus-within:border-primary focus-within:ring-1 focus-within:ring-primary"
      style={{
        borderColor: 'var(--border, #d8cfbe)',
      }}
    >
      {/* Barre d'outils de formatage visuel */}
      <div
        className="flex items-center gap-1 p-1.5 border-b bg-[var(--bg2, #f5f0e6)] flex-wrap"
        style={{ borderColor: 'var(--border, #d8cfbe)' }}
      >
        <button
          type="button"
          onClick={() => executeCommand('bold')}
          title="Gras (Ctrl+B)"
          className={`p-1.5 rounded transition-colors text-xs font-bold flex items-center justify-center ${
            activeFormats.bold
              ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs'
              : 'text-neutral-700 hover:bg-neutral-200/70 dark:text-neutral-300 dark:hover:bg-neutral-800'
          }`}
        >
          <Bold size={14} />
        </button>

        <button
          type="button"
          onClick={() => executeCommand('italic')}
          title="Italique (Ctrl+I)"
          className={`p-1.5 rounded transition-colors text-xs flex items-center justify-center ${
            activeFormats.italic
              ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs'
              : 'text-neutral-700 hover:bg-neutral-200/70 dark:text-neutral-300 dark:hover:bg-neutral-800'
          }`}
        >
          <Italic size={14} />
        </button>

        <button
          type="button"
          onClick={() => executeCommand('underline')}
          title="Souligné (Ctrl+U)"
          className={`p-1.5 rounded transition-colors text-xs flex items-center justify-center ${
            activeFormats.underline
              ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs'
              : 'text-neutral-700 hover:bg-neutral-200/70 dark:text-neutral-300 dark:hover:bg-neutral-800'
          }`}
        >
          <Underline size={14} />
        </button>

        <div className="w-px h-4 bg-neutral-300 dark:bg-neutral-700 mx-1" />

        <button
          type="button"
          onClick={() => executeCommand('insertUnorderedList')}
          title="Liste à puces"
          className={`p-1.5 rounded transition-colors text-xs flex items-center justify-center ${
            activeFormats.ul
              ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs'
              : 'text-neutral-700 hover:bg-neutral-200/70 dark:text-neutral-300 dark:hover:bg-neutral-800'
          }`}
        >
          <List size={14} />
        </button>

        <button
          type="button"
          onClick={() => executeCommand('insertOrderedList')}
          title="Liste numérotée"
          className={`p-1.5 rounded transition-colors text-xs flex items-center justify-center ${
            activeFormats.ol
              ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs'
              : 'text-neutral-700 hover:bg-neutral-200/70 dark:text-neutral-300 dark:hover:bg-neutral-800'
          }`}
        >
          <ListOrdered size={14} />
        </button>

        <button
          type="button"
          onClick={handleLink}
          title={activeFormats.link ? 'Retirer le lien' : 'Insérer un lien web'}
          className={`p-1.5 rounded transition-colors text-xs flex items-center justify-center ${
            activeFormats.link
              ? 'bg-success text-white shadow-xs'
              : 'text-neutral-700 hover:bg-neutral-200/70 dark:text-neutral-300 dark:hover:bg-neutral-800'
          }`}
        >
          {activeFormats.link ? <Unlink size={14} /> : <Link2 size={14} />}
        </button>
      </div>

      {/* Zone de saisie WYSIWYG éditée en direct */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onKeyUp={updateActiveStates}
        onMouseUp={updateActiveStates}
        onPaste={handlePaste}
        data-placeholder={placeholder}
        className="w-full p-3.5 text-sm text-[#1a1209] dark:text-neutral-100 outline-none leading-relaxed overflow-y-auto whitespace-pre-wrap babillard-rich-editor"
        style={{
          minHeight,
          fontFamily: 'inherit',
        }}
      />
    </div>
  );
}
