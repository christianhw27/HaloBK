import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

import BeritaView from '@/views/BeritaView.vue'
import DetailBeritaView from '@/views/DetailBeritaView.vue'
import DashboardView from '@/views/DashboardView.vue'
import DataAlumniView from '@/views/DataAlumniView.vue'
import FormLaporView from '@/views/FormLaporView.vue'
import VerifikasiView from '@/views/VerifikasiView.vue'
import ImportExportView from '@/views/ImportExportView.vue'
import KelolaBeritaView from '@/views/KelolaBeritaView.vue'
import LoginView from '@/views/LoginView.vue'
import ProfileView from '@/views/ProfileView.vue'
import EditSiswaView from '@/views/EditSiswaView.vue'
import EligibleSiswaView from '@/views/EligibleSiswaView.vue'
import AdminEligibleView from '@/views/AdminEligibleView.vue'
import { useEligibleStore } from '@/stores/eligible'

const routes = [
  {
    path: '/',
    name: 'berita',
    component: BeritaView,
    meta: { layout: 'public', requiresAuth: false }
  },
  {
    path: '/berita',
    redirect: '/'
  },
  {
    path: '/berita/:slug',
    name: 'detail-berita',
    component: DetailBeritaView,
    meta: { layout: 'public', requiresAuth: false }
  },
  {
    path: '/login',
    name: 'login',
    component: LoginView,
    meta: { layout: 'public', requiresAuth: false }
  },
  {
    path: '/tracer-study',
    name: 'tracer-study',
    component: DashboardView,
    meta: { requiresAuth: true }
  },
  {
    path: '/dashboard',
    redirect: '/tracer-study'
  },
  {
    path: '/data',
    name: 'data-alumni',
    component: DataAlumniView,
    meta: { requiresAuth: true }
  },
  {
    path: '/lapor',
    name: 'form-lapor',
    component: FormLaporView,
    meta: { requiresAuth: true }
  },
  {
    path: '/verifikasi',
    name: 'verifikasi',
    component: VerifikasiView,
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/profil',
    name: 'profile',
    component: ProfileView,
    meta: { layout: 'public', requiresAuth: true }
  },
  {
    path: '/profile',
    redirect: '/profil'
  },
  {
    path: '/import-export',
    name: 'import-export',
    component: ImportExportView,
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/kelola-akun',
    redirect: '/import-export?tab=users'
  },
  {
    path: '/kelola-berita',
    name: 'kelola-berita',
    component: KelolaBeritaView,
    meta: { layout: 'public', requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/edit-siswa/:id',
    name: 'edit-siswa',
    component: EditSiswaView,
    meta: { layout: 'public', requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/eligible',
    name: 'eligible-siswa',
    component: EligibleSiswaView,
    meta: { layout: 'public', requiresAuth: true, requiresEligible: true }
  },
  {
    path: '/admin/eligible',
    name: 'admin-eligible',
    component: AdminEligibleView,
    meta: { layout: 'public', requiresAuth: true, requiresAdmin: true }
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
