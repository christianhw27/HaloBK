import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './style.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.mount('#app')

// Registrasi Service Worker untuk Caching Gambar Lokal (Hemat Kuota & Bandwidth)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      // Dengarkan jika ada versi service worker terbaru
      registration.onupdatefound = () => {
        const installingWorker = registration.installing
        if (installingWorker) {
          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[Media Cache] Cache aset diperbarui ke versi terbaru.')
            }
          }
        }
      }
    }).catch((err) => {
      console.warn('[Media Cache] Registrasi Service Worker gagal:', err)
    })
  })
}
