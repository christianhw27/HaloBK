// Inisialisasi awal sinkron dengan database Supabase
export const INITIAL_ALUMNI_DATA = [];

export const INITIAL_PENDING_DATA = [];

// Palet warna resmi terstandarisasi untuk kategori alumni (Bebas warna ungu, Memenuhi WCAG AA)
export const CATEGORY_COLORS = {
  'PTN': {
    badge: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
    dot: 'bg-blue-600'
  },
  'PTS': {
    badge: 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800',
    dot: 'bg-sky-600'
  },
  'Kedinasan': {
    badge: 'bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800',
    dot: 'bg-cyan-600'
  },
  'TNI/Polri': {
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    dot: 'bg-emerald-600'
  },
  'Bekerja': {
    badge: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
    dot: 'bg-slate-600'
  },
  'Wirausaha': {
    badge: 'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
    dot: 'bg-amber-600'
  },
  'Pelatihan / LPK': {
    badge: 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800',
    dot: 'bg-teal-600'
  },
  'Masa Tunggu': {
    badge: 'bg-stone-100 text-stone-800 border-stone-300 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700',
    dot: 'bg-stone-500'
  }
};
