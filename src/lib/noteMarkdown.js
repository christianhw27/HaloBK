/**
 * Renderer Markdown ringan & aman (XSS-safe) khusus untuk Buku Catatan Siswa BK.
 * Meng-escape seluruh HTML mentah terlebih dahulu sebelum merender sintaks Markdown:
 * - Heading: # / ## / ###
 * - Bold: **teks**
 * - Italic: *teks*
 * - Underline: __teks__
 * - Strikethrough: ~~teks~~
 * - Inline code: `kode`
 * - Bullet list: - item / * item / • item
 * - Numbered list: 1. item
 * - Blockquote: > kutipan
 */

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatInline(escapedText) {
  return escapedText
    .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700/80 font-mono text-[12px] text-emerald-800 dark:text-emerald-300">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-slate-900 dark:text-white">$1</strong>')
    .replace(/__(.+?)__/g, '<span class="underline decoration-emerald-500/80 underline-offset-2">$1</span>')
    .replace(/~~(.+?)~~/g, '<del class="line-through text-slate-400">$1</del>')
    .replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em class="italic">$2</em>')
}

export function renderNoteMarkdown(rawText) {
  if (!rawText || !String(rawText).trim()) return ''

  const lines = escapeHtml(rawText).replace(/\r\n/g, '\n').split('\n')
  const html = []
  let listType = null // 'ul' | 'ol' | null
  let paragraphLines = []

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return
    html.push(`<p class="my-1.5 leading-relaxed">${paragraphLines.map(formatInline).join('<br>')}</p>`)
    paragraphLines = []
  }

  const closeList = () => {
    if (!listType) return
    html.push(listType === 'ul' ? '</ul>' : '</ol>')
    listType = null
  }

  for (const line of lines) {
    const trimmed = line.trim()

    if (!trimmed) {
      flushParagraph()
      closeList()
      continue
    }

    // Heading (#, ##, ###)
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/)
    if (headingMatch) {
      flushParagraph()
      closeList()
      const level = headingMatch[1].length
      const cls =
        level === 1
          ? 'text-base font-extrabold text-slate-900 dark:text-white mt-2.5 mb-1'
          : level === 2
            ? 'text-sm sm:text-[15px] font-bold text-slate-900 dark:text-white mt-2 mb-1'
            : 'text-xs sm:text-sm font-bold text-emerald-800 dark:text-emerald-300 mt-2 mb-0.5'
      html.push(`<h${level + 2} class="${cls}">${formatInline(headingMatch[2])}</h${level + 2}>`)
      continue
    }

    // Blockquote (> ...)
    const quoteMatch = trimmed.match(/^&gt;\s?(.*)$/)
    if (quoteMatch) {
      flushParagraph()
      closeList()
      html.push(
        `<blockquote class="my-1.5 pl-3 border-l-3 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 py-1 pr-2 rounded-r-lg text-slate-600 dark:text-slate-300 italic">${formatInline(quoteMatch[1])}</blockquote>`
      )
      continue
    }

    // Unordered list (- item, * item, • item)
    const ulMatch = trimmed.match(/^(?:[-*]|•)\s+(.+)$/)
    if (ulMatch) {
      flushParagraph()
      if (listType === 'ol') closeList()
      if (listType !== 'ul') {
        html.push('<ul class="list-disc pl-5 my-1.5 space-y-1">')
        listType = 'ul'
      }
      html.push(`<li>${formatInline(ulMatch[1])}</li>`)
      continue
    }

    // Ordered list (1. item)
    const olMatch = trimmed.match(/^\d+\.\s+(.+)$/)
    if (olMatch) {
      flushParagraph()
      if (listType === 'ul') closeList()
      if (listType !== 'ol') {
        html.push('<ol class="list-decimal pl-5 my-1.5 space-y-1">')
        listType = 'ol'
      }
      html.push(`<li>${formatInline(olMatch[1])}</li>`)
      continue
    }

    // Normal paragraph line
    closeList()
    paragraphLines.push(line)
  }

  flushParagraph()
  closeList()

  return html.join('')
}

/**
 * Konversi DOM contenteditable kembali ke Markdown standar Buku Catatan Siswa.
 */
export function htmlToNoteMarkdown(rootEl) {
  if (!rootEl) return ''

  const serializeChildren = (node) => {
    let out = ''
    node.childNodes.forEach((child) => {
      out += serializeNode(child)
    })
    return out
  }

  const serializeNode = (node) => {
    if (node.nodeType === 3) {
      // Text node: bersihkan non-breaking space
      return (node.textContent || '').replace(/\u00A0/g, ' ')
    }
    if (node.nodeType !== 1) return ''

    const tag = node.tagName.toLowerCase()
    const inner = serializeChildren(node)

    if (tag === 'br') return '\n'
    if (tag === 'strong' || tag === 'b') {
      return inner.trim() ? `**${inner}**` : inner
    }
    if (tag === 'em' || tag === 'i') {
      return inner.trim() ? `*${inner}*` : inner
    }
    if (tag === 'u' || (tag === 'span' && (node.classList?.contains('underline') || node.style?.textDecoration?.includes('underline')))) {
      return inner.trim() ? `__${inner}__` : inner
    }
    if (tag === 'del' || tag === 's') {
      return inner.trim() ? `~~${inner}~~` : inner
    }
    if (tag === 'code') {
      return inner.trim() ? `\`${inner}\`` : inner
    }
    if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'h5') {
      const clean = inner.replace(/\n+/g, ' ').trim()
      return clean ? `### ${clean}\n` : ''
    }
    if (tag === 'blockquote') {
      const lines = inner.trim().split('\n').filter(Boolean)
      return lines.map(l => `> ${l}`).join('\n') + '\n'
    }
    if (tag === 'ul') {
      const items = []
      node.childNodes.forEach((li) => {
        if (li.nodeType === 1 && li.tagName.toLowerCase() === 'li') {
          const text = serializeChildren(li).replace(/\n+$/, '').trim()
          if (text) items.push(`- ${text}`)
        }
      })
      return items.length ? items.join('\n') + '\n\n' : ''
    }
    if (tag === 'ol') {
      const items = []
      let num = 1
      node.childNodes.forEach((li) => {
        if (li.nodeType === 1 && li.tagName.toLowerCase() === 'li') {
          const text = serializeChildren(li).replace(/\n+$/, '').trim()
          if (text) {
            items.push(`${num}. ${text}`)
            num++
          }
        }
      })
      return items.length ? items.join('\n') + '\n\n' : ''
    }
    if (tag === 'li') {
      return `${inner.trim()}\n`
    }
    if (tag === 'p' || tag === 'div') {
      const trimmed = inner.replace(/\n+$/, '')
      return trimmed ? `${trimmed}\n\n` : '\n'
    }

    return inner
  }

  return serializeChildren(rootEl)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
