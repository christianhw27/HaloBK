import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { STARTER_NEWS } from '@/lib/starterNews'

export const useNewsStore = defineStore('news', () => {
  const STORAGE_KEY = 'hallo_berita_smada_v1'
  const SEEDED_KEY = 'hallo_berita_seeded_v1'
  const TICKER_STORAGE_KEY = 'ruangbk_ticker_text_v1'
  const DEFAULT_TICKER_TEXT = '📢 Selamat datang di Portal Ruang BK SMA Negeri 2 Ngawi • Pendataan Tracer Study Alumni Angkatan 60 Resmi Dibuka • Kunjungi ruang Bimbingan Konseling untuk layanan konsultasi karir & perguruan tinggi • Maju Bersama, Hebat Semua!'

  const newsList = ref([])
  const isLoading = ref(false)
  const errorMessage = ref('')
  const isTableMissing = ref(false)

  // Running Text / Info Terkini Marquee
  const tickerText = ref(localStorage.getItem(TICKER_STORAGE_KEY) || DEFAULT_TICKER_TEXT)
  const isSavingTicker = ref(false)

  // Filter untuk Portal Berita Publik
  const selectedCategory = ref('ALL')
  const searchQuery = ref('')

  function mapDbToNews(row) {
    return {
      id: row.id,
      title: row.judul || row.title || '',
      category: row.kategori || row.category || 'Pengumuman BK',
      summary: row.ringkasan || row.summary || '',
      content: row.isi || row.content || '',
      imageUrl: row.gambar_url || row.imageUrl || '',
      author: row.penulis || row.author || 'Tim BK SMADA Ngawi',
      isFeatured: Boolean(row.is_featured ?? row.isFeatured),
      isPublished: row.is_published !== undefined ? Boolean(row.is_published) : (row.isPublished !== undefined ? Boolean(row.isPublished) : true),
      views: Number(row.views || 0),
      createdAt: row.created_at || row.createdAt || new Date().toISOString(),
      updatedAt: row.updated_at || row.updatedAt || row.created_at || new Date().toISOString()
    }
  }

  function formatNewsDate(isoString) {
    if (!isoString) return 'Baru saja'
    try {
      return new Date(isoString).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    } catch {
      return 'Baru saja'
    }
  }

  function estimateReadTime(text) {
    if (!text) return '1 mnt baca'
    const words = text.trim().split(/\s+/).length
    const minutes = Math.max(1, Math.ceil(words / 180))
    return `${minutes} mnt baca`
  }

  function loadFromLocalStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          newsList.value = parsed.map(mapDbToNews)
          return
        }
      }

      // Pertama kali dibuka tanpa database cloud: tampilkan berita awal agar portal langsung informatif
      if (!localStorage.getItem(SEEDED_KEY)) {
        newsList.value = [...STARTER_NEWS]
        localStorage.setItem(SEEDED_KEY, 'true')
        saveToLocalStorage()
      } else {
        newsList.value = []
      }
    } catch {
      newsList.value = []
    }
  }

  function saveToLocalStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newsList.value))
    } catch (e) {
      console.warn('Gagal menyimpan berita ke penyimpanan lokal:', e)
    }
  }

  function isMissingTableError(error) {
    if (!error) return false
    const msg = (error.message || '').toLowerCase()
    const code = error.code || ''
    return (
      code === '42P01' ||
      code === 'PGRST205' ||
      msg.includes('does not exist') ||
      msg.includes('could not find the table') ||
      msg.includes('schema cache')
    )
  }

  // Ambil seluruh berita (Supabase + fallback LocalStorage jika tabel belum dibuat)
  async function fetchNews() {
    isLoading.value = true
    errorMessage.value = ''

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('berita')
          .select('*')
          .order('is_featured', { ascending: false })
          .order('created_at', { ascending: false })

        if (error) {
          if (isMissingTableError(error)) {
            isTableMissing.value = true
            loadFromLocalStorage()
            isLoading.value = false
            return
          }
          throw error
        }

        isTableMissing.value = false
        // Filter out system configuration records from public/admin news list
        newsList.value = (data || [])
          .filter(item => item.kategori !== 'SYSTEM_SETTINGS' && item.judul !== '__TICKER_TEXT__')
          .map(mapDbToNews)
      } catch (err) {
        errorMessage.value = err.message || 'Gagal memuat daftar berita dari server.'
        loadFromLocalStorage()
      }
    } else {
      loadFromLocalStorage()
    }

    // Ambil juga teks berjalan terkini
    await fetchTickerText()

    isLoading.value = false
  }

  // Daftar berita yang berstatus Tayang (Published)
  const publishedNews = computed(() => {
    return newsList.value
      .filter(n => n.isPublished)
      .sort((a, b) => {
        if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1
        return new Date(b.createdAt) - new Date(a.createdAt)
      })
  })

  // Berita Utama / Sorotan Headline
  const featuredNews = computed(() => {
    if (publishedNews.value.length === 0) return null
    return publishedNews.value.find(n => n.isFeatured) || publishedNews.value[0]
  })

  // Sorotan Sekunder (maksimal 3 berita terbaru selain headline utama)
  const secondaryHighlights = computed(() => {
    const leadId = featuredNews.value?.id
    return publishedNews.value.filter(n => n.id !== leadId).slice(0, 3)
  })

  // Berita terfilter untuk Grid Arsip di Portal Berita
  const filteredPublishedNews = computed(() => {
    let list = publishedNews.value

    // Saat belum memfilter kategori/pencarian, jangan duplikasi headline utama di grid bawah
    if (selectedCategory.value === 'ALL' && !searchQuery.value.trim() && featuredNews.value) {
      list = list.filter(item => item.id !== featuredNews.value.id)
    }

    if (selectedCategory.value !== 'ALL') {
      list = list.filter(item => item.category === selectedCategory.value)
    }

    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase().trim()
      list = list.filter(item =>
        item.title.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.author.toLowerCase().includes(q)
      )
    }

    return list
  })

  // Statistik Berita untuk Panel Admin CRUD
  const newsStats = computed(() => {
    return {
      total: newsList.value.length,
      published: newsList.value.filter(n => n.isPublished).length,
      draft: newsList.value.filter(n => !n.isPublished).length,
      featured: newsList.value.filter(n => n.isFeatured).length
    }
  })

  // CREATE: Tambah Berita Baru
  async function createNews(form) {
    if (isSupabaseConfigured && supabase && !isTableMissing.value) {
      try {
        // Jika dijadikan berita utama, lepaskan status featured pada berita lain
        if (form.isFeatured) {
          await supabase.from('berita').update({ is_featured: false }).eq('is_featured', true)
        }

        const payload = {
          judul: form.title.trim(),
          kategori: form.category,
          ringkasan: form.summary.trim(),
          isi: form.content.trim(),
          gambar_url: form.imageUrl ? form.imageUrl.trim() : null,
          penulis: form.author ? form.author.trim() : 'Tim BK SMADA Ngawi',
          is_featured: Boolean(form.isFeatured),
          is_published: Boolean(form.isPublished),
          views: 0
        }

        const { data, error } = await supabase
          .from('berita')
          .insert(payload)
          .select()
          .single()

        if (error) throw error
        await fetchNews()
        return { success: true, data: mapDbToNews(data) }
      } catch (err) {
        return { success: false, message: err.message || 'Gagal menyimpan berita.' }
      }
    } else {
      if (form.isFeatured) {
        newsList.value.forEach(n => { n.isFeatured = false })
      }
      const newItem = {
        id: 'BERITA-' + Date.now().toString().slice(-5),
        title: form.title.trim(),
        category: form.category,
        summary: form.summary.trim(),
        content: form.content.trim(),
        imageUrl: form.imageUrl ? form.imageUrl.trim() : '',
        author: form.author ? form.author.trim() : 'Tim BK SMADA Ngawi',
        isFeatured: Boolean(form.isFeatured),
        isPublished: Boolean(form.isPublished),
        views: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      newsList.value.unshift(newItem)
      saveToLocalStorage()
      return { success: true, data: newItem }
    }
  }

  // UPDATE: Perbarui Berita
  async function updateNews(id, form) {
    if (isSupabaseConfigured && supabase && !isTableMissing.value) {
      try {
        if (form.isFeatured) {
          await supabase.from('berita').update({ is_featured: false }).neq('id', id)
        }

        const payload = {
          judul: form.title.trim(),
          kategori: form.category,
          ringkasan: form.summary.trim(),
          isi: form.content.trim(),
          gambar_url: form.imageUrl ? form.imageUrl.trim() : null,
          penulis: form.author ? form.author.trim() : 'Tim BK SMADA Ngawi',
          is_featured: Boolean(form.isFeatured),
          is_published: Boolean(form.isPublished),
          updated_at: new Date().toISOString()
        }

        const { error } = await supabase
          .from('berita')
          .update(payload)
          .eq('id', id)

        if (error) throw error
        await fetchNews()
        return { success: true }
      } catch (err) {
        return { success: false, message: err.message || 'Gagal memperbarui berita.' }
      }
    } else {
      if (form.isFeatured) {
        newsList.value.forEach(n => {
          if (n.id !== id) n.isFeatured = false
        })
      }
      const idx = newsList.value.findIndex(n => n.id === id)
      if (idx !== -1) {
        newsList.value[idx] = {
          ...newsList.value[idx],
          title: form.title.trim(),
          category: form.category,
          summary: form.summary.trim(),
          content: form.content.trim(),
          imageUrl: form.imageUrl ? form.imageUrl.trim() : '',
          author: form.author ? form.author.trim() : 'Tim BK SMADA Ngawi',
          isFeatured: Boolean(form.isFeatured),
          isPublished: Boolean(form.isPublished),
          updatedAt: new Date().toISOString()
        }
        saveToLocalStorage()
        return { success: true }
      }
      return { success: false, message: 'Berita tidak ditemukan.' }
    }
  }

  // DELETE: Hapus Berita
  async function deleteNews(id) {
    if (isSupabaseConfigured && supabase && !isTableMissing.value) {
      try {
        const { error } = await supabase
          .from('berita')
          .delete()
          .eq('id', id)

        if (error) throw error
        await fetchNews()
        return { success: true }
      } catch (err) {
        return { success: false, message: err.message || 'Gagal menghapus berita.' }
      }
    } else {
      const idx = newsList.value.findIndex(n => n.id === id)
      if (idx !== -1) {
        newsList.value.splice(idx, 1)
        saveToLocalStorage()
        return { success: true }
      }
      return { success: false, message: 'Berita tidak ditemukan.' }
    }
  }

  // Toggle Cepat Status Tayang / Draft
  async function togglePublish(item) {
    return updateNews(item.id, {
      ...item,
      isPublished: !item.isPublished
    })
  }

  // Toggle Cepat Berita Utama (Headline)
  async function toggleFeatured(item) {
    return updateNews(item.id, {
      ...item,
      isFeatured: !item.isFeatured
    })
  }

  // Tambah jumlah pembaca
  async function incrementViews(id) {
    const item = newsList.value.find(n => n.id === id)
    if (!item) return

    item.views = (item.views || 0) + 1

    if (isSupabaseConfigured && supabase && !isTableMissing.value) {
      try {
        await supabase
          .from('berita')
          .update({ views: item.views })
          .eq('id', id)
      } catch {
        // Abaikan jika gagal update counter view
      }
    } else {
      saveToLocalStorage()
    }
  }

  // Muat 5 Artikel Contoh BK (Untuk Admin mengisi cepat bila tabel masih kosong)
  async function seedStarterNews() {
    if (isSupabaseConfigured && supabase && !isTableMissing.value) {
      try {
        const records = STARTER_NEWS.map(item => ({
          judul: item.title,
          kategori: item.category,
          ringkasan: item.summary,
          isi: item.content,
          gambar_url: item.imageUrl || null,
          penulis: item.author,
          is_featured: item.isFeatured,
          is_published: item.isPublished,
          views: 0
        }))

        const { error } = await supabase.from('berita').insert(records)
        if (error) throw error
        await fetchNews()
        return { success: true, count: records.length }
      } catch (err) {
        return { success: false, message: err.message }
      }
    } else {
      newsList.value = [...STARTER_NEWS]
      localStorage.setItem(SEEDED_KEY, 'true')
      saveToLocalStorage()
      return { success: true, count: STARTER_NEWS.length }
    }
  }

  // Mengambil teks berjalan (running text) dari Cloud Database Supabase (Global) / LocalStorage
  async function fetchTickerText() {
    if (isSupabaseConfigured && supabase) {
      try {
        // 1. Coba baca dari record konfigurasi sistem di tabel berita Supabase (Global Cloud)
        const { data: sysData, error: sysErr } = await supabase
          .from('berita')
          .select('isi')
          .eq('kategori', 'SYSTEM_SETTINGS')
          .eq('judul', '__TICKER_TEXT__')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!sysErr && sysData && sysData.isi) {
          tickerText.value = sysData.isi
          localStorage.setItem(TICKER_STORAGE_KEY, sysData.isi)
          return
        }

        // 2. Fallback cek tabel pengaturan jika ada
        const { data: configData } = await supabase
          .from('pengaturan')
          .select('value')
          .eq('key', 'ticker_text')
          .maybeSingle()

        if (configData && configData.value) {
          tickerText.value = configData.value
          localStorage.setItem(TICKER_STORAGE_KEY, configData.value)
        }
      } catch (err) {
        console.warn('Error saat fetch ticker text global dari Supabase:', err)
      }
    }
  }

  // Memperbarui teks berjalan secara GLOBAL di Supabase (Semua Pengunjung Melihat Teks Ini)
  async function updateTickerText(newText) {
    const cleaned = (newText || '').trim() || DEFAULT_TICKER_TEXT
    tickerText.value = cleaned
    localStorage.setItem(TICKER_STORAGE_KEY, cleaned)

    if (isSupabaseConfigured && supabase) {
      isSavingTicker.value = true
      try {
        // 1. Simpan ke record sistem di tabel berita Supabase (terbuka & tersinkronisasi global)
        const { data: existing } = await supabase
          .from('berita')
          .select('id')
          .eq('kategori', 'SYSTEM_SETTINGS')
          .eq('judul', '__TICKER_TEXT__')
          .limit(1)
          .maybeSingle()

        if (existing && existing.id) {
          await supabase
            .from('berita')
            .update({
              isi: cleaned,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id)
        } else {
          await supabase
            .from('berita')
            .insert({
              judul: '__TICKER_TEXT__',
              kategori: 'SYSTEM_SETTINGS',
              ringkasan: 'Ticker text pengumuman global portal',
              isi: cleaned,
              is_published: false,
              is_featured: false
            })
        }

        // 2. Simpan juga ke tabel pengaturan jika ada
        await supabase
          .from('pengaturan')
          .upsert(
            { key: 'ticker_text', value: cleaned, updated_at: new Date().toISOString() },
            { onConflict: 'key' }
          )
          .catch(() => {})
      } catch (err) {
        console.warn('Error menyimpan ticker secara global ke Supabase:', err)
      } finally {
        isSavingTicker.value = false
      }
    }

    return { success: true, text: cleaned }
  }

  return {
    newsList,
    isLoading,
    errorMessage,
    isTableMissing,
    tickerText,
    isSavingTicker,
    fetchTickerText,
    updateTickerText,
    selectedCategory,
    searchQuery,
    publishedNews,
    featuredNews,
    secondaryHighlights,
    filteredPublishedNews,
    newsStats,
    formatNewsDate,
    estimateReadTime,
    fetchNews,
    createNews,
    updateNews,
    deleteNews,
    togglePublish,
    toggleFeatured,
    incrementViews,
    seedStarterNews
  }
})

