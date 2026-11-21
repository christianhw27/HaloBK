import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useEligibleStore } from '@/stores/eligible'

const routes = [
  {
    path: '/',
    name: 'berita',
    component: () => import('@/views/BeritaView.vue'),
    meta: { layout: 'public', requiresAuth: false }
  },
  {
    path: '/berita',
    redirect: '/'
  },
  {
    path: '/berita/:slug',
    name: 'detail-berita',
    component: () => import('@/views/DetailBeritaView.vue'),
    meta: { layout: 'public', requiresAuth: false }
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { layout: 'public', requiresAuth: false }
  },
  {
    path: '/tracer-study',
    name: 'tracer-study',
    component: () => import('@/views/DashboardView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/dashboard',
    redirect: '/tracer-study'
  },
  {
    path: '/data',
    name: 'data-alumni',
    component: () => import('@/views/DataAlumniView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/lapor',
    name: 'form-lapor',
    component: () => import('@/views/FormLaporView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/verifikasi',
    name: 'verifikasi',
    component: () => import('@/views/VerifikasiView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/profil',
    name: 'profile',
    component: () => import('@/views/ProfileView.vue'),
    meta: { layout: 'public', requiresAuth: true }
  },
  {
    path: '/profile',
    redirect: '/profil'
  },
  {
    path: '/import-export',
    name: 'import-export',
    component: () => import('@/views/ImportExportView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/kelola-akun',
    redirect: '/import-export?tab=users'
  },
  {
    path: '/kelola-berita',
    name: 'kelola-berita',
    component: () => import('@/views/KelolaBeritaView.vue'),
    meta: { layout: 'public', requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/edit-siswa/:id',
    name: 'edit-siswa',
    component: () => import('@/views/EditSiswaView.vue'),
    meta: { layout: 'public', requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/eligible',
    name: 'eligible-siswa',
    component: () => import('@/views/EligibleSiswaView.vue'),
    meta: { layout: 'public', requiresAuth: true, requiresEligible: true }
  },
  {
    path: '/admin/eligible',
    name: 'admin-eligible',
    component: () => import('@/views/AdminEligibleView.vue'),
    meta: { layout: 'public', requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/admin/chat',
    name: 'admin-chat',
    component: () => import('@/views/AdminChatView.vue'),
    meta: { layout: 'public', requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/admin/catatan-siswa',
    name: 'admin-catatan-siswa',
    component: () => import('@/views/AdminStudentNotesView.vue'),
    meta: { layout: 'public', requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/halobk',
    name: 'halobk-siswa',
    component: () => import('@/views/HaloBKSiswaView.vue'),
    meta: { layout: 'public', requiresAuth: true }
  },
  {
    path: '/konsultasi',
    redirect: '/halobk'
  },
  {
    path: '/chat-bk',
    redirect: '/halobk'
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  }
})

// Middleware / Navigation Guard Keamanan Rute Tracer Study (Zero-Trust Server Verification)
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()

  // Tunggu verifikasi sesi resmi dari Supabase Auth selesai sebelum mengevaluasi rute
  if (!authStore.isAuthReady) {
    await authStore.initAuth()
  }

  // 1. Cek rute yang membutuhkan login (Akses Tracer Study)
  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    return next({
      path: '/login',
      query: { redirect: to.fullPath }
    })
  }

  // 2. Jika sudah login dan membuka halaman /login, alihkan langsung ke portal berita
  if (to.path === '/login' && authStore.isLoggedIn) {
    return next({ path: '/' })
  }

  // 3. Rute khusus admin (Wajib lulus verifikasi admin)
  if (to.meta.requiresAdmin && authStore.userRole !== 'admin') {
    return next({ path: '/tracer-study' })
  }

  // 4. Rute khusus siswa eligible (SNBP)
  if (to.meta.requiresEligible) {
    if (authStore.userRole === 'admin') {
      return next({ path: '/admin/eligible' })
    }
    const eligibleStore = useEligibleStore()
    const status = await eligibleStore.checkMyEligibleStatus()
    if (!status) {
      return next({ path: '/' })
    }
  }

  next()
})

export default router
