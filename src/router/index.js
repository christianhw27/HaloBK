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
    path: '/dashboard',
    name: 'dashboard',
    component: DashboardView,
    meta: { requiresAuth: true }
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

// Middleware / Navigation Guard Keamanan Rute Tracer Study
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()

  // 1. Cek rute yang membutuhkan login (Akses Tracer Study)
  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    return next({
      path: '/login',
      query: { redirect: to.fullPath }
    })
  }

  // 2. Jika sudah login dan membuka halaman /login, alihkan langsung ke halaman tujuan
  if (to.path === '/login' && authStore.isLoggedIn) {
    if (authStore.userRole === 'siswa') {
      return next({ path: '/profil' })
    }
    return next({ path: '/dashboard' })
  }

  // 3. Rute khusus admin
  if (to.meta.requiresAdmin && authStore.userRole !== 'admin') {
    return next({ path: '/dashboard' })
  }

  next()
})

export default router
