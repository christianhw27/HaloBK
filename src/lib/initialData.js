// Inisialisasi awal sinkron dengan database Supabase
export const INITIAL_ALUMNI_DATA = [];

export const INITIAL_PENDING_DATA = [];

// Palet warna resmi Portal BK (Trust Blue, Warm Magenta, Hope Amber, Growth Emerald - WCAG AA)
export const CATEGORY_COLORS = {
  'PTN': {
    badge: 'bg-[#E0F2FE] text-[#0369A1] border-sky-200 dark:bg-sky-950/60 dark:text-sky-200 dark:border-sky-800',
    avatar: 'bg-gradient-to-br from-sky-100 to-sky-200 text-[#0369A1] border-sky-200 dark:from-sky-900/70 dark:to-sky-800/70 dark:text-sky-200 dark:border-sky-700',
    cardAccent: 'border-t-4 border-t-[#0284C7]',
    dot: 'bg-[#0284C7]'
  },
  'PTS': {
    badge: 'bg-sky-50 text-[#0369A1] border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800',
    avatar: 'bg-sky-100 text-[#0369A1] border-sky-200 dark:bg-sky-900/60 dark:text-sky-200 dark:border-sky-700',
    cardAccent: 'border-t-4 border-t-sky-400',
    dot: 'bg-sky-500'
  },
  'Kedinasan': {
    badge: 'bg-[#D1FAE5] text-[#047857] border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800',
    avatar: 'bg-gradient-to-br from-emerald-100 to-emerald-200 text-[#047857] border-emerald-200 dark:from-emerald-900/70 dark:to-emerald-800/70 dark:text-emerald-200 dark:border-emerald-700',
    cardAccent: 'border-t-4 border-t-[#10B981]',
    dot: 'bg-[#10B981]'
  },
  'TNI/Polri': {
    badge: 'bg-emerald-50 text-[#047857] border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    avatar: 'bg-emerald-100 text-[#047857] border-emerald-200 dark:bg-emerald-900/60 dark:text-emerald-200 dark:border-emerald-700',
    cardAccent: 'border-t-4 border-t-emerald-600',
    dot: 'bg-emerald-600'
  },
  'Bekerja': {
    badge: 'bg-amber-50 text-[#92400E] border-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800',
    avatar: 'bg-gradient-to-br from-amber-100 to-amber-200 text-[#92400E] border-amber-200 dark:from-amber-900/70 dark:to-amber-800/70 dark:text-amber-200 dark:border-amber-700',
    cardAccent: 'border-t-4 border-t-amber-400',
    dot: 'bg-amber-500'
  },
  'Wirausaha': {
    badge: 'bg-[#FEF3C7] text-[#92400E] border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800',
    avatar: 'bg-gradient-to-br from-amber-100 to-orange-100 text-[#92400E] border-amber-200 dark:from-amber-900/70 dark:to-amber-800/70 dark:text-amber-200 dark:border-amber-700',
    cardAccent: 'border-t-4 border-t-[#F59E0B]',
    dot: 'bg-[#F59E0B]'
  },
  'Pelatihan / LPK': {
    badge: 'bg-[#FFE4E6] text-[#BE123C] border-rose-200 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800',
    avatar: 'bg-gradient-to-br from-rose-100 to-rose-200 text-[#BE123C] border-rose-200 dark:from-rose-900/70 dark:to-rose-800/70 dark:text-rose-200 dark:border-rose-700',
    cardAccent: 'border-t-4 border-t-[#E11D48]',
    dot: 'bg-[#E11D48]'
  },
  'Siswa Aktif': {
    badge: 'bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800',
    avatar: 'bg-gradient-to-br from-cyan-100 to-sky-100 text-cyan-800 border-cyan-200 dark:from-cyan-900/70 dark:to-sky-900/70 dark:text-cyan-200 dark:border-cyan-700',
    cardAccent: 'border-t-4 border-t-cyan-500',
    dot: 'bg-cyan-500'
  },
  'Belum Lapor Diri': {
    badge: 'bg-rose-50 text-[#BE123C] border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
    avatar: 'bg-rose-100 text-[#BE123C] border-rose-200 dark:bg-rose-900/60 dark:text-rose-200 dark:border-rose-700',
    cardAccent: 'border-t-4 border-t-rose-400',
    dot: 'bg-rose-500'
  },
  'Masa Tunggu': {
    badge: 'bg-rose-50 text-[#BE123C] border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
    avatar: 'bg-rose-100 text-[#BE123C] border-rose-200 dark:bg-rose-900/60 dark:text-rose-200 dark:border-rose-700',
    cardAccent: 'border-t-4 border-t-rose-400',
    dot: 'bg-rose-500'
  }
};
