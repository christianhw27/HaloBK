import { createRouter, createWebHistory } from 'vue-router'

import DashboardView from '@/views/DashboardView.vue'
import DataAlumniView from '@/views/DataAlumniView.vue'
import FormLaporView from '@/views/FormLaporView.vue'
import VerifikasiView from '@/views/VerifikasiView.vue'
import ImportExportView from '@/views/ImportExportView.vue'

const routes = [
  {
    path: '/',
    redirect: '/dashboard'
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
    path: '/:pathMatch(.*)*',
    redirect: '/dashboard'
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
