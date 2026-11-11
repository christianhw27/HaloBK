import { createRouter, createWebHistory } from 'vue-router'

import BeritaView from '@/views/BeritaView.vue'
import DashboardView from '@/views/DashboardView.vue'
import DataAlumniView from '@/views/DataAlumniView.vue'
import FormLaporView from '@/views/FormLaporView.vue'
import VerifikasiView from '@/views/VerifikasiView.vue'
import ImportExportView from '@/views/ImportExportView.vue'
import KelolaBeritaView from '@/views/KelolaBeritaView.vue'
import LoginView from '@/views/LoginView.vue'

const routes = [
  {
    path: '/',
    name: 'berita',
    component: BeritaView,
    meta: { layout: 'public' }
  },
  {
    path: '/berita',
    redirect: '/'
  },
  {
    path: '/login',
    name: 'login',
    component: LoginView,
    meta: { layout: 'public' }
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: DashboardView
  },
  {
    path: '/data',
    name: 'data-alumni',
    component: DataAlumniView
  },
  {
    path: '/lapor',
    name: 'form-lapor',
    component: FormLaporView
  },
  {
    path: '/verifikasi',
    name: 'verifikasi',
    component: VerifikasiView
  },
  {
    path: '/import-export',
    name: 'import-export',
    component: ImportExportView
  },
  {
    path: '/kelola-berita',
    name: 'kelola-berita',
    component: KelolaBeritaView
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

export default router
