import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://yhctwdgcxykzxfgeilgf.supabase.co'
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_1ySPTUjtVRIoxsLyy79QAQ_OQT0h1PM'

function slugify(text) {
  if (!text) return ''
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function escapeHtml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export default async function handler(req, res) {
  const { slug } = req.query
  const param = String(slug || '').trim().toLowerCase()

  let article = null

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    const { data: list } = await supabase
      .from('berita')
      .select('id, judul, ringkasan, gambar_url, created_at')
      .order('created_at', { ascending: false })

    if (list && list.length > 0) {
      // 1. Cocokkan ID persis
      article = list.find(item => String(item.id).toLowerCase() === param)

      // 2. Cocokkan slug dari judul
      if (!article) {
        article = list.find(item => slugify(item.judul) === param)
      }

      // 3. Cocokkan awalan
      if (!article) {
        article = list.find(item => {
          const s = slugify(item.judul)
          return s.startsWith(param) || param.startsWith(s)
        })
      }
    }
  } catch (err) {
    console.warn('Gagal mengambil data berita di serverless function:', err)
  }

  const siteUrl = 'https://ruangbksmada.my.id'
  const title = article ? `${article.judul} - Ruang BK Smada` : 'Ruang BK Smada - SMA Negeri 2 Ngawi'
  const description = article?.ringkasan || 'Portal Bimbingan Konseling dan Tracer Study SMA Negeri 2 Ngawi.'
  const canonicalSlug = article ? slugify(article.judul) || article.id : param
  const articleUrl = `${siteUrl}/berita/${canonicalSlug}`
  const imageUrl = article?.gambar_url || `${siteUrl}/logo.png`

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  
  <!-- Open Graph / WhatsApp / Facebook Preview -->
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="Ruang BK Smada" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(imageUrl)}" />
  <meta property="og:image:secure_url" content="${escapeHtml(imageUrl)}" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:url" content="${escapeHtml(articleUrl)}" />
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
  
  <meta http-equiv="refresh" content="0;url=${escapeHtml(articleUrl)}" />
</head>
<body style="font-family: system-ui, sans-serif; padding: 2rem; max-width: 600px; margin: auto;">
  <h2>${escapeHtml(title)}</h2>
  <p>${escapeHtml(description)}</p>
  <p><a href="${escapeHtml(articleUrl)}">Buka artikel di Ruang BK Smada &rarr;</a></p>
</body>
</html>`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
  return res.status(200).send(html)
}

