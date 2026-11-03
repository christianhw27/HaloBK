// Layanan Unggah & Optimasi Foto Cloudinary
// Menggunakan direct client-side unsigned upload (tanpa backend proxy)

import { compressImage } from './imageHelper'

/**
 * Cek apakah kredensial Cloudinary sudah terkonfigurasi di environment
 */
export function isCloudinaryConfigured() {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

  if (!cloudName || !uploadPreset) return false

  const placeholders = [
    'YOUR_CLOUDINARY_CLOUD_NAME',
    'isi_cloud_name_disini',
    'YOUR_UPLOAD_PRESET',
    'isi_preset_disini'
  ]

  return !placeholders.includes(cloudName) && !placeholders.includes(uploadPreset)
}

/**
 * Unggah berkas gambar langsung ke Cloudinary menggunakan Unsigned Upload Preset
 * @param {File|Blob|string} fileOrDataUrl - Berkas gambar atau base64 data URI
 * @param {Object} options - Pengaturan tambahan (folder, tags)
 * @returns {Promise<string>} secure_url dari Cloudinary
 */
export async function uploadToCloudinary(fileOrDataUrl, options = {}) {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
  const folder = options.folder || import.meta.env.VITE_CLOUDINARY_FOLDER || 'halobk_alumni'

  if (!isCloudinaryConfigured()) {
    throw new Error(
      'Kredensial Cloudinary belum diatur. Harap masukkan VITE_CLOUDINARY_CLOUD_NAME dan VITE_CLOUDINARY_UPLOAD_PRESET pada berkas .env'
    )
  }

  const formData = new FormData()
  formData.append('file', fileOrDataUrl)
  formData.append('upload_preset', uploadPreset)
  if (folder) {
    formData.append('folder', folder)
  }

  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData
    })

    const data = await response.json()

    if (!response.ok) {
      const msg = data?.error?.message || `Gagal unggah foto (HTTP ${response.status})`
      
      // Terjemahan pesan error umum Cloudinary agar mudah dipahami
      if (msg.toLowerCase().includes('preset not found')) {
        throw new Error(`Upload Preset "${uploadPreset}" tidak ditemukan di akun Cloudinary "${cloudName}".`)
      }
      if (msg.toLowerCase().includes('unsigned')) {
        throw new Error(`Upload Preset "${uploadPreset}" harus berstatus 'Unsigned'. Ubah Signing Mode ke Unsigned di console Cloudinary.`)
      }
      if (msg.toLowerCase().includes('cloud_name')) {
        throw new Error(`Cloud Name "${cloudName}" tidak valid atau salah ketik.`)
      }

      throw new Error(`Cloudinary Error: ${msg}`)
    }

    return data.secure_url
  } catch (err) {
    console.error('[Cloudinary Upload Error]', err)
    throw err
  }
}

/**
 * Alur lengkap upload foto alumni:
 * 1. Kompresi lokal cepat di peramban (agar upload ke Cloudinary secepat kilat, <100KB)
 * 2. Unggah ke Cloudinary via direct unsigned upload
 * 3. Mengembalikan URL HTTPS publik CDN Cloudinary
 * 
 * @param {File} file - Berkas file foto mentah dari input file
 * @returns {Promise<string>} URL gambar Cloudinary (HTTPS)
 */
export async function processAndUploadPhoto(file) {
  if (!file) {
    throw new Error('Pilih berkas foto terlebih dahulu.')
  }

  if (!file.type.startsWith('image/')) {
    throw new Error('Berkas harus berupa gambar valid (.jpg, .jpeg, .png, .webp).')
  }

  // 1. Kompresi gambar terlebih dahulu ke max 600px 80% JPEG
  // Ini menghemat kuota Cloudinary dan membuat upload selesai dalam 1 detik
  const compressedDataUrl = await compressImage(file, 600, 0.82)

  // 2. Unggah ke Cloudinary
  const secureUrl = await uploadToCloudinary(compressedDataUrl)

  return secureUrl
}

/**
 * Optimasi URL Cloudinary dengan auto-format (WebP/AVIF) dan smart-crop
 * @param {string} url - URL foto
 * @param {Object} opts - Dimensi w, h, crop
 */
export function getOptimizedImageUrl(url, { width = 300, height = 300, crop = 'fill' } = {}) {
  if (!url || typeof url !== 'string') return url
  if (!url.includes('res.cloudinary.com')) return url

  // Sisipkan transformasi /f_auto,q_auto,c_fill,g_face,w_...,h_... setelah /upload/
  const transform = `f_auto,q_auto,c_${crop},g_face,w_${width},h_${height}`
  return url.replace('/upload/', `/upload/${transform}/`)
}

