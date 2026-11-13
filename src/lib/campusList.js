// Direktori Lengkap Kampus, Politeknik, Kedinasan, & Perguruan Tinggi Indonesia (150+ Institusi)
// Menggunakan Google High-Resolution Favicon CDN (128x128px PNG) tanpa unduhan lokal
import snpmbData from '@/data/snpmbData.min.json'

export const CAMPUS_LIST = [
  // ========================================================
  // 1. KARESIDENAN MADIUN & SEKITARNYA (PRIORITAS SMADA NGAWI)
  // ========================================================
  {
    name: 'Universitas PGRI Madiun',
    shortName: 'UNIPMA',
    aliases: ['unipma', 'pgri madiun', 'univ pgri madiun', 'ikip pgri madiun'],
    domain: 'unipma.ac.id',
    category: 'PTS',
    city: 'Madiun'
  },
  {
    name: 'Universitas Merdeka Madiun',
    shortName: 'UNMER Madiun',
    aliases: ['unmer madiun', 'univ merdeka madiun', 'merdeka madiun'],
    domain: 'unmermadiun.ac.id',
    category: 'PTS',
    city: 'Madiun'
  },
  {
    name: 'Politeknik Negeri Madiun',
    shortName: 'PNM',
    aliases: ['pnm', 'politeknik negeri madiun', 'poltek madiun'],
    domain: 'pnm.ac.id',
    category: 'PTN',
    city: 'Madiun'
  },
  {
    name: 'Politeknik Perkeretaapian Indonesia Madiun',
    shortName: 'PPI Madiun',
    aliases: ['ppi madiun', 'api madiun', 'politeknik perkeretaapian indonesia'],
    domain: 'ppi.ac.id',
    category: 'Kedinasan',
    city: 'Madiun'
  },
  {
    name: 'Universitas Muhammadiyah Ponorogo',
    shortName: 'UMPO',
    aliases: ['umpo', 'muhammadiyah ponorogo', 'univ muhammadiyah ponorogo'],
    domain: 'umpo.ac.id',
    category: 'PTS',
    city: 'Ponorogo'
  },
  {
    name: 'Universitas Darussalam Gontor',
    shortName: 'UNIDA Gontor',
    aliases: ['unida', 'unida gontor', 'gontor', 'universitas darussalam gontor'],
    domain: 'unida.gontor.ac.id',
    category: 'PTS',
    city: 'Ponorogo'
  },
  {
    name: 'IAIN Ponorogo',
    shortName: 'IAIN Ponorogo',
    aliases: ['iain ponorogo', 'stain ponorogo'],
    domain: 'iainponorogo.ac.id',
    category: 'PTN',
    city: 'Ponorogo'
  },
  {
    name: 'Universitas Soerjo Ngawi',
    shortName: 'UNSOERJO',
    aliases: ['unsoerjo', 'universitas soerjo', 'univ soerjo ngawi', 'soerjo ngawi'],
    domain: 'unsoerjo.ac.id',
    category: 'PTS',
    city: 'Ngawi'
  },
  {
    name: 'STKIP PGRI Ngawi',
    shortName: 'STKIP Ngawi',
    aliases: ['stkip pgri ngawi', 'stkip ngawi'],
    domain: 'stkip-pgri-ngawi.ac.id',
    category: 'PTS',
    city: 'Ngawi'
  },
  {
    name: 'STIKES Bhakti Husada Mulia Madiun',
    shortName: 'STIKES BHM',
    aliases: ['stikes bhm', 'stikes madiun', 'bhakti husada mulia madiun'],
    domain: 'stikes-bhm.ac.id',
    category: 'PTS',
    city: 'Madiun'
  },
  {
    name: 'STKIP PGRI Pacitan',
    shortName: 'STKIP Pacitan',
    aliases: ['stkip pgri pacitan', 'stkip pacitan'],
    domain: 'stkippacitan.ac.id',
    category: 'PTS',
    city: 'Pacitan'
  },
  {
    name: 'Akademi Keperawatan Pemkab Ngawi',
    shortName: 'Akper Ngawi',
    aliases: ['akper ngawi', 'akper pemkab ngawi', 'akademi keperawatan ngawi', 'akademi keperawatan pemkab ngawi', 'akper pemda ngawi'],
    domain: 'akperngawi.ac.id',
    logoUrl: '/logos/akper-ngawi.jpg',
    category: 'PTS',
    city: 'Ngawi'
  },
  {
    name: 'Politeknik Energi dan Mineral Akamigas',
    shortName: 'PEM Akamigas',
    aliases: ['pem akamigas', 'akamigas', 'stem akamigas', 'politeknik energi dan mineral akamigas', 'akamigas cepu', 'pem akamigas cepu'],
    domain: 'akamigas.ac.id',
    category: 'Kedinasan',
    city: 'Blora'
  },

  // ========================================================
  // 2. SOLO RAYA / SURAKARTA (DEKAT NGAWI / SRAGEN / SOLO)
  // ========================================================
  {
    name: 'Universitas Sebelas Maret',
    shortName: 'UNS',
    aliases: ['uns', 'sebelas maret', 'univ sebelas maret', 'uns solo', 'uns surakarta'],
    domain: 'uns.ac.id',
    category: 'PTN',
    city: 'Surakarta'
  },
  {
    name: 'Universitas Muhammadiyah Surakarta',
    shortName: 'UMS',
    aliases: ['ums', 'ums solo', 'muhammadiyah surakarta', 'univ muhammadiyah surakarta'],
    domain: 'ums.ac.id',
    category: 'PTS',
    city: 'Surakarta'
  },
  {
    name: 'Institut Seni Indonesia Surakarta',
    shortName: 'ISI Solo',
    aliases: ['isi solo', 'isi surakarta', 'stsi solo'],
    domain: 'isi-ska.ac.id',
    category: 'PTN',
    city: 'Surakarta'
  },
  {
    name: 'UIN Raden Mas Said Surakarta',
    shortName: 'UIN Solo',
    aliases: ['uin solo', 'uin raden mas said', 'iain surakarta'],
    domain: 'uinsaid.ac.id',
    category: 'PTN',
    city: 'Surakarta'
  },
  {
    name: 'Universitas Slamet Riyadi',
    shortName: 'UNISRI',
    aliases: ['unisri', 'unisri solo', 'slamet riyadi'],
    domain: 'unisri.ac.id',
    category: 'PTS',
    city: 'Surakarta'
  },
  {
    name: 'Universitas Tunas Pembangunan',
    shortName: 'UTP',
    aliases: ['utp', 'utp solo', 'tunas pembangunan'],
    domain: 'utp.ac.id',
    category: 'PTS',
    city: 'Surakarta'
  },
  {
    name: 'Universitas Duta Bangsa',
    shortName: 'UDB',
    aliases: ['udb', 'udb solo', 'duta bangsa'],
    domain: 'udb.ac.id',
    category: 'PTS',
    city: 'Surakarta'
  },
  {
    name: 'Universitas Setia Budi',
    shortName: 'USB',
    aliases: ['usb', 'usb solo', 'setia budi'],
    domain: 'setiabudi.ac.id',
    category: 'PTS',
    city: 'Surakarta'
  },
  {
    name: 'Universitas Sahid Surakarta',
    shortName: 'USAHID Solo',
    aliases: ['usahid solo', 'sahid surakarta'],
    domain: 'usahidsolo.ac.id',
    category: 'PTS',
    city: 'Surakarta'
  },
  {
    name: 'Universitas Veteran Bangun Nusantara',
    shortName: 'UNIVET',
    aliases: ['univet', 'univet bantara', 'univet sukoharjo'],
    domain: 'univetbantara.ac.id',
    category: 'PTS',
    city: 'Sukoharjo'
  },
  {
    name: 'Universitas Boyolali',
    shortName: 'UBY',
    aliases: ['uby', 'univ boyolali', 'universitas boyolali'],
    domain: 'uby.ac.id',
    category: 'PTS',
    city: 'Boyolali'
  },
  {
    name: 'Universitas Widya Dharma Klaten',
    shortName: 'UNWIDHA',
    aliases: ['unwidha', 'widya dharma klaten'],
    domain: 'unwidha.ac.id',
    category: 'PTS',
    city: 'Klaten'
  },
  {
    name: 'Poltekkes Kemenkes Surakarta',
    shortName: 'Poltekkes Solo',
    aliases: ['poltekkes solo', 'poltekkes surakarta', 'politeknik kesehatan surakarta'],
    domain: 'poltekkes-solo.ac.id',
    category: 'Kedinasan',
    city: 'Surakarta'
  },

  // ========================================================
  // 3. JAWA TIMUR (SURABAYA, MALANG, KEDIRI, JEMBER, DLL)
  // ========================================================
  {
    name: 'Universitas Negeri Surabaya',
    shortName: 'UNESA',
    aliases: ['unesa', 'univ negeri surabaya', 'unesa surabaya', 'ikip surabaya'],
    domain: 'unesa.ac.id',
    category: 'PTN',
    city: 'Surabaya'
  },
  {
    name: 'Universitas Airlangga',
    shortName: 'UNAIR',
    aliases: ['unair', 'univ airlangga', 'airlangga surabaya'],
    domain: 'unair.ac.id',
    category: 'PTN',
    city: 'Surabaya'
  },
  {
    name: 'Institut Teknologi Sepuluh Nopember',
    shortName: 'ITS',
    aliases: ['its', 'its surabaya', 'institut teknologi sepuluh nopember'],
    domain: 'its.ac.id',
    category: 'PTN',
    city: 'Surabaya'
  },
  {
    name: 'Universitas Brawijaya',
    shortName: 'UB',
    aliases: ['ub', 'brawijaya', 'unibraw', 'univ brawijaya', 'brawijaya malang'],
    domain: 'ub.ac.id',
    category: 'PTN',
    city: 'Malang'
  },
  {
    name: 'Universitas Negeri Malang',
    shortName: 'UM',
    aliases: ['um', 'univ negeri malang', 'um malang', 'ikip malang'],
    domain: 'um.ac.id',
    category: 'PTN',
    city: 'Malang'
  },
  {
    name: 'Universitas Jember',
    shortName: 'UNEJ',
    aliases: ['unej', 'univ jember', 'jember university'],
    domain: 'unej.ac.id',
    category: 'PTN',
    city: 'Jember'
  },
  {
    name: 'UPN "Veteran" Jawa Timur',
    shortName: 'UPN Jatim',
    aliases: ['upn jatim', 'upnv jatim', 'upn veteran jatim', 'upn surabaya', 'upnv', 'upn sby', 'upnv jatim sby', 'upn veteran jawa timur'],
    domain: 'upnjatim.ac.id',
    category: 'PTN',
    city: 'Surabaya'
  },
  {
    name: 'Politeknik Elektronika Negeri Surabaya',
    shortName: 'PENS',
    aliases: ['pens', 'pens its', 'politeknik elektronika negeri surabaya'],
    domain: 'pens.ac.id',
    category: 'PTN',
    city: 'Surabaya'
  },
  {
    name: 'Politeknik Perkapalan Negeri Surabaya',
    shortName: 'PPNS',
    aliases: ['ppns', 'politeknik perkapalan negeri surabaya'],
    domain: 'ppns.ac.id',
    category: 'PTN',
    city: 'Surabaya'
  },
  {
    name: 'Politeknik Negeri Malang',
    shortName: 'POLINEMA',
    aliases: ['polinema', 'politeknik negeri malang', 'poltek malang'],
    domain: 'polinema.ac.id',
    category: 'PTN',
    city: 'Malang'
  },
  {
    name: 'Politeknik Negeri Jember',
    shortName: 'POLIJE',
    aliases: ['polije', 'politeknik negeri jember'],
    domain: 'polije.ac.id',
    category: 'PTN',
    city: 'Jember'
  },
  {
    name: 'Politeknik Negeri Madura',
    shortName: 'POLTERA',
    aliases: ['poltera', 'politeknik negeri madura'],
    domain: 'poltera.ac.id',
    category: 'PTN',
    city: 'Sampang'
  },
  {
    name: 'Politeknik Negeri Banyuwangi',
    shortName: 'POLIWANGI',
    aliases: ['poliwangi', 'politeknik negeri banyuwangi'],
    domain: 'poliwangi.ac.id',
    category: 'PTN',
    city: 'Banyuwangi'
  },
  {
    name: 'Universitas Trunojoyo Madura',
    shortName: 'UTM',
    aliases: ['utm', 'trunojoyo', 'trunojoyo madura'],
    domain: 'trunojoyo.ac.id',
    category: 'PTN',
    city: 'Bangkalan'
  },
  {
    name: 'UIN Sunan Ampel Surabaya',
    shortName: 'UINSA',
    aliases: ['uinsa', 'uin sunan ampel', 'iain sunan ampel'],
    domain: 'uinsby.ac.id',
    category: 'PTN',
    city: 'Surabaya'
  },
  {
    name: 'UIN Maulana Malik Ibrahim Malang',
    shortName: 'UIN Malang',
    aliases: ['uin malang', 'uin maulana malik ibrahim', 'uin maliki'],
    domain: 'uin-malang.ac.id',
    category: 'PTN',
    city: 'Malang'
  },
  {
    name: 'UIN Kiai Haji Achmad Siddiq Jember',
    shortName: 'UIN KHAS Jember',
    aliases: ['uin khas', 'uin jember', 'iain jember'],
    domain: 'uinkhas.ac.id',
    category: 'PTN',
    city: 'Jember'
  },
  {
    name: 'Universitas Nusantara PGRI Kediri',
    shortName: 'UNP Kediri',
    aliases: ['unp kediri', 'pgri kediri', 'ikip pgri kediri'],
    domain: 'unpkediri.ac.id',
    category: 'PTS',
    city: 'Kediri'
  },
  {
    name: 'Universitas Islam Kadiri',
    shortName: 'UNISKA Kediri',
    aliases: ['uniska kediri', 'uniska'],
    domain: 'uniska-kediri.ac.id',
    category: 'PTS',
    city: 'Kediri'
  },
  {
    name: 'IIK Bhakti Wiyata Kediri',
    shortName: 'IIK Bhakta',
    aliases: ['iik', 'iik kediri', 'iik bhakti wiyata', 'bhakti wiyata'],
    domain: 'iik.ac.id',
    category: 'PTS',
    city: 'Kediri'
  },
  {
    name: 'IAIN Kediri',
    shortName: 'IAIN Kediri',
    aliases: ['iain kediri', 'stain kediri'],
    domain: 'iainkediri.ac.id',
    category: 'PTN',
    city: 'Kediri'
  },
  {
    name: 'Universitas Bojonegoro',
    shortName: 'UNIGORO',
    aliases: ['unigoro', 'univ bojonegoro', 'bojonegoro university'],
    domain: 'unigoro.ac.id',
    category: 'PTS',
    city: 'Bojonegoro'
  },
  {
    name: 'Universitas PGRI Ronggolawe Tuban',
    shortName: 'UNIROW',
    aliases: ['unirow', 'unirow tuban', 'ronggolawe tuban'],
    domain: 'unirow.ac.id',
    category: 'PTS',
    city: 'Tuban'
  },
  {
    name: 'Universitas Ciputra Surabaya',
    shortName: 'UC',
    aliases: ['uc', 'ciputra', 'universitas ciputra'],
    domain: 'uc.ac.id',
    category: 'PTS',
    city: 'Surabaya'
  },
  {
    name: 'Universitas Kristen Petra',
    shortName: 'UK Petra',
    aliases: ['petra', 'uk petra', 'kristen petra'],
    domain: 'petra.ac.id',
    category: 'PTS',
    city: 'Surabaya'
  },
  {
    name: 'Universitas Surabaya',
    shortName: 'UBAYA',
    aliases: ['ubaya', 'univ surabaya'],
    domain: 'ubaya.ac.id',
    category: 'PTS',
    city: 'Surabaya'
  },
  {
    name: 'Universitas Katolik Widya Mandala Surabaya',
    shortName: 'UKWMS',
    aliases: ['widya mandala', 'ukwms', 'wm surabaya'],
    domain: 'ukwms.ac.id',
    category: 'PTS',
    city: 'Surabaya'
  },
  {
    name: 'Universitas 17 Agustus 1945 Surabaya',
    shortName: 'UNTAG Surabaya',
    aliases: ['untag sby', 'untag surabaya', '17 agustus surabaya'],
    domain: 'untag-sby.ac.id',
    category: 'PTS',
    city: 'Surabaya'
  },
  {
    name: 'Universitas Narotama Surabaya',
    shortName: 'Narotama',
    aliases: ['narotama', 'univ narotama'],
    domain: 'narotama.ac.id',
    category: 'PTS',
    city: 'Surabaya'
  },
  {
    name: 'Universitas Hang Tuah Surabaya',
    shortName: 'UHT',
    aliases: ['hang tuah', 'uht surabaya'],
    domain: 'hangtuah.ac.id',
    category: 'PTS',
    city: 'Surabaya'
  },
  {
    name: 'Universitas Muhammadiyah Malang',
    shortName: 'UMM',
    aliases: ['umm', 'umm malang', 'muhammadiyah malang'],
    domain: 'umm.ac.id',
    category: 'PTS',
    city: 'Malang'
  },
  {
    name: 'Universitas Islam Malang',
    shortName: 'UNISMA',
    aliases: ['unisma', 'unisma malang', 'islam malang'],
    domain: 'unisma.ac.id',
    category: 'PTS',
    city: 'Malang'
  },
  {
    name: 'Universitas Merdeka Malang',
    shortName: 'UNMER Malang',
    aliases: ['unmer malang', 'unmer', 'merdeka malang'],
    domain: 'unmer.ac.id',
    category: 'PTS',
    city: 'Malang'
  },
  {
    name: 'Universitas Tribhuwana Tunggadewi',
    shortName: 'UNITRI',
    aliases: ['unitri', 'unitri malang', 'tribhuwana'],
    domain: 'unitri.ac.id',
    category: 'PTS',
    city: 'Malang'
  },
  {
    name: 'Universitas Ma Chung Malang',
    shortName: 'Ma Chung',
    aliases: ['ma chung', 'machung', 'ma chung malang'],
    domain: 'machung.ac.id',
    category: 'PTS',
    city: 'Malang'
  },
  {
    name: 'Universitas Muhammadiyah Sidoarjo',
    shortName: 'UMSIDA',
    aliases: ['umsida', 'muhammadiyah sidoarjo'],
    domain: 'umsida.ac.id',
    category: 'PTS',
    city: 'Sidoarjo'
  },
  {
    name: 'Universitas Muhammadiyah Gresik',
    shortName: 'UMG',
    aliases: ['umg', 'muhammadiyah gresik'],
    domain: 'umg.ac.id',
    category: 'PTS',
    city: 'Gresik'
  },
  {
    name: 'Universitas Muhammadiyah Jember',
    shortName: 'UM Jember',
    aliases: ['um jember', 'muhammadiyah jember'],
    domain: 'unmuhjember.ac.id',
    category: 'PTS',
    city: 'Jember'
  },
  {
    name: 'Universitas Muhammadiyah Surabaya',
    shortName: 'UM Surabaya',
    aliases: ['um surabaya', 'muhammadiyah surabaya'],
    domain: 'um-surabaya.ac.id',
    category: 'PTS',
    city: 'Surabaya'
  },
  {
    name: 'Poltekkes Kemenkes Surabaya',
    shortName: 'Poltekkes Sby',
    aliases: ['poltekkes surabaya', 'poltekes surabaya', 'poltekkes kemenkes surabaya', 'poltekkes sby', 'poltekes sby'],
    domain: 'poltekkes-sby.ac.id',
    category: 'Kedinasan',
    city: 'Surabaya'
  },
  {
    name: 'Poltekkes Kemenkes Malang',
    shortName: 'Poltekkes Malang',
    aliases: ['poltekkes malang', 'poltekkes kemenkes malang'],
    domain: 'poltekkes-malang.ac.id',
    category: 'Kedinasan',
    city: 'Malang'
  },

  // ========================================================
  // 4. D.I. YOGYAKARTA
  // ========================================================
  {
    name: 'Universitas Gadjah Mada',
    shortName: 'UGM',
    aliases: ['ugm', 'gadjah mada', 'ugm jogja', 'ugm yogyakarta'],
    domain: 'ugm.ac.id',
    category: 'PTN',
    city: 'Yogyakarta'
  },
  {
    name: 'Universitas Negeri Yogyakarta',
    shortName: 'UNY',
    aliases: ['uny', 'univ negeri yogyakarta', 'ikip jogja'],
    domain: 'uny.ac.id',
    category: 'PTN',
    city: 'Yogyakarta'
  },
  {
    name: 'UPN "Veteran" Yogyakarta',
    shortName: 'UPN Jogja',
    aliases: ['upn jogja', 'upn yk', 'upn veteran yogyakarta'],
    domain: 'upnyk.ac.id',
    category: 'PTN',
    city: 'Yogyakarta'
  },
  {
    name: 'Institut Seni Indonesia Yogyakarta',
    shortName: 'ISI Jogja',
    aliases: ['isi jogja', 'isi yogyakarta'],
    domain: 'isi.ac.id',
    category: 'PTN',
    city: 'Yogyakarta'
  },
  {
    name: 'UIN Sunan Kalijaga Yogyakarta',
    shortName: 'UIN Jogja',
    aliases: ['uin suka', 'uin sunan kalijaga', 'iain sunan kalijaga'],
    domain: 'uin-suka.ac.id',
    category: 'PTN',
    city: 'Yogyakarta'
  },
  {
    name: 'Universitas Islam Indonesia',
    shortName: 'UII',
    aliases: ['uii', 'uii jogja', 'islam indonesia'],
    domain: 'uii.ac.id',
    category: 'PTS',
    city: 'Yogyakarta'
  },
  {
    name: 'Universitas Muhammadiyah Yogyakarta',
    shortName: 'UMY',
    aliases: ['umy', 'umy jogja', 'muhammadiyah yogyakarta'],
    domain: 'umy.ac.id',
    category: 'PTS',
    city: 'Yogyakarta'
  },
  {
    name: 'Universitas Ahmad Dahlan',
    shortName: 'UAD',
    aliases: ['uad', 'uad jogja', 'ahmad dahlan'],
    domain: 'uad.ac.id',
    category: 'PTS',
    city: 'Yogyakarta'
  },
  {
    name: 'Universitas Atma Jaya Yogyakarta',
    shortName: 'UAJY',
    aliases: ['uajy', 'atma jaya jogja', 'atma jogja'],
    domain: 'uajy.ac.id',
    category: 'PTS',
    city: 'Yogyakarta'
  },
  {
    name: 'Universitas Sanata Dharma',
    shortName: 'USD',
    aliases: ['usd', 'sanata dharma', 'sadhar'],
    domain: 'usd.ac.id',
    category: 'PTS',
    city: 'Yogyakarta'
  },
  {
    name: 'Universitas Kristen Duta Wacana',
    shortName: 'UKDW',
    aliases: ['ukdw', 'duta wacana'],
    domain: 'ukdw.ac.id',
    category: 'PTS',
    city: 'Yogyakarta'
  },
  {
    name: 'Universitas Sarjanawiyata Tamansiswa',
    shortName: 'UST',
    aliases: ['ust', 'ust jogja', 'tamansiswa jogja'],
    domain: 'ustjogja.ac.id',
    category: 'PTS',
    city: 'Yogyakarta'
  },
  {
    name: 'Universitas Aisyiyah Yogyakarta',
    shortName: 'UNISA',
    aliases: ['unisa', 'unisa yogyakarta', 'unisa jogja', 'universitas aisyiyah yogyakarta', 'universitas aisyiyah', 'aisyiyah yogyakarta', 'aisyiyah'],
    domain: 'unisayogya.ac.id',
    logoUrl: '/logos/unisa-jogja.png',
    category: 'PTS',
    city: 'Yogyakarta'
  },
  {
    name: 'Politeknik Agraria STPN',
    shortName: 'STPN',
    aliases: ['stpn', 'politeknik agraria stpn', 'politeknik agraria', 'sekolah tinggi pertanahan nasional', 'stpn yogyakarta', 'stpn jogja', 'agraria stpn'],
    domain: 'stpn.ac.id',
    category: 'Kedinasan',
    city: 'Yogyakarta'
  },
  {
    name: 'Universitas Widya Mataram',
    shortName: 'UWM',
    aliases: ['uwm', 'widya mataram', 'universitas widya mataram', 'uwm jogja', 'uwm yogyakarta', 'widya mataram yogyakarta'],
    domain: 'widyamataram.ac.id',
    category: 'PTS',
    city: 'Yogyakarta'
  },
  {
    name: 'Politeknik Pembangunan Pertanian Yogyakarta-Magelang',
    shortName: 'Polbangtan Yoma',
    aliases: ['polbangtan yogyakarta', 'polbangtan', 'polbangtan yoma', 'politeknik pembangunan pertanian yogyakarta', 'polbangtan magelang'],
    domain: 'polbangtanyoma.ac.id',
    category: 'Kedinasan',
    city: 'Yogyakarta'
  },
  {
    name: 'Politeknik LPP Yogyakarta',
    shortName: 'Poltek LPP',
    aliases: ['politeknik lpp yogyakarta', 'politeknik lpp', 'poltek lpp', 'lpp yogyakarta'],
    domain: 'polteklpp.ac.id',
    category: 'PTS',
    city: 'Yogyakarta'
  },
  {
    name: 'Universitas Alma Ata',
    shortName: 'Alma Ata',
    aliases: ['alma ata', 'univ alma ata'],
    domain: 'almaata.ac.id',
    category: 'PTS',
    city: 'Yogyakarta'
  },
  {
    name: 'Universitas PGRI Yogyakarta',
    shortName: 'UPY',
    aliases: ['upy', 'pgri jogja', 'univ pgri yogyakarta'],
    domain: 'upy.ac.id',
    category: 'PTS',
    city: 'Yogyakarta'
  },
  {
    name: 'Poltekkes Kemenkes Yogyakarta',
    shortName: 'Poltekkes Jogja',
    aliases: ['poltekkes jogja', 'poltekkes yogyakarta'],
    domain: 'poltekkesjogja.ac.id',
    category: 'Kedinasan',
    city: 'Yogyakarta'
  },
  {
    name: 'Sekolah Tinggi Multi Media MMTC Yogyakarta',
    shortName: 'MMTC',
    aliases: ['mmtc', 'mmtc jogja', 'stmm mmtc'],
    domain: 'mmtc.ac.id',
    category: 'Kedinasan',
    city: 'Yogyakarta'
  },

  // ========================================================
  // 5. JAWA TENGAH (SEMARANG, PURWOKERTO, SALATIGA, KUDUS, DLL)
  // ========================================================
  {
    name: 'Universitas Diponegoro',
    shortName: 'UNDIP',
    aliases: ['undip', 'diponegoro', 'undip semarang'],
    domain: 'undip.ac.id',
    category: 'PTN',
    city: 'Semarang'
  },
  {
    name: 'Universitas Negeri Semarang',
    shortName: 'UNNES',
    aliases: ['unnes', 'univ negeri semarang', 'ikip semarang'],
    domain: 'unnes.ac.id',
    category: 'PTN',
    city: 'Semarang'
  },
  {
    name: 'UIN Walisongo Semarang',
    shortName: 'UIN Walisongo',
    aliases: ['walisongo', 'uin walisongo', 'iain walisongo'],
    domain: 'walisongo.ac.id',
    category: 'PTN',
    city: 'Semarang'
  },
  {
    name: 'Politeknik Negeri Semarang',
    shortName: 'POLINES',
    aliases: ['polines', 'politeknik negeri semarang'],
    domain: 'polines.ac.id',
    category: 'PTN',
    city: 'Semarang'
  },
  {
    name: 'Politeknik Maritim Negeri Indonesia',
    shortName: 'POLIMARIN',
    aliases: ['polimarin', 'politeknik maritim negeri'],
    domain: 'polimarin.ac.id',
    category: 'PTN',
    city: 'Semarang'
  },
  {
    name: 'Universitas Dian Nuswantoro',
    shortName: 'UDINUS',
    aliases: ['udinus', 'dinus', 'universitas dian nuswantoro'],
    domain: 'dinus.ac.id',
    category: 'PTS',
    city: 'Semarang'
  },
  {
    name: 'Universitas Islam Sultan Agung',
    shortName: 'UNISSULA',
    aliases: ['unissula', 'sultan agung semarang'],
    domain: 'unissula.ac.id',
    category: 'PTS',
    city: 'Semarang'
  },
  {
    name: 'Universitas Katolik Soegijapranata',
    shortName: 'UNIKA',
    aliases: ['unika', 'unika soegijapranata', 'soegijapranata'],
    domain: 'unika.ac.id',
    category: 'PTS',
    city: 'Semarang'
  },
  {
    name: 'Universitas Semarang',
    shortName: 'USM',
    aliases: ['usm', 'usm semarang', 'univ semarang'],
    domain: 'usm.ac.id',
    category: 'PTS',
    city: 'Semarang'
  },
  {
    name: 'Universitas Wahid Hasyim',
    shortName: 'UNWAHAS',
    aliases: ['unwahas', 'wahid hasyim'],
    domain: 'unwahas.ac.id',
    category: 'PTS',
    city: 'Semarang'
  },
  {
    name: 'Universitas Jenderal Soedirman',
    shortName: 'UNSOED',
    aliases: ['unsoed', 'jenderal soedirman', 'unsoed purwokerto'],
    domain: 'unsoed.ac.id',
    category: 'PTN',
    city: 'Purwokerto'
  },
  {
    name: 'UIN Prof. K.H. Saifuddin Zuhri Purwokerto',
    shortName: 'UIN Saizu',
    aliases: ['uin saizu', 'iain purwokerto', 'uin purwokerto'],
    domain: 'uinsaizu.ac.id',
    category: 'PTN',
    city: 'Purwokerto'
  },
  {
    name: 'Universitas Muhammadiyah Purwokerto',
    shortName: 'UMP',
    aliases: ['ump', 'muhammadiyah purwokerto'],
    domain: 'ump.ac.id',
    category: 'PTS',
    city: 'Purwokerto'
  },
  {
    name: 'Universitas Kristen Satya Wacana',
    shortName: 'UKSW',
    aliases: ['uksw', 'satya wacana', 'satya wacana salatiga'],
    domain: 'uksw.edu',
    category: 'PTS',
    city: 'Salatiga'
  },
  {
    name: 'UIN Salatiga',
    shortName: 'UIN Salatiga',
    aliases: ['uin salatiga', 'iain salatiga'],
    domain: 'uinsalatiga.ac.id',
    category: 'PTN',
    city: 'Salatiga'
  },
  {
    name: 'Universitas Tidar Magelang',
    shortName: 'UNTIDAR',
    aliases: ['untidar', 'univ tidar', 'tidar magelang'],
    domain: 'untidar.ac.id',
    category: 'PTN',
    city: 'Magelang'
  },
  {
    name: 'Universitas Muhammadiyah Magelang',
    shortName: 'UNIMMA',
    aliases: ['unimma', 'umm magelang', 'muhammadiyah magelang'],
    domain: 'unimma.ac.id',
    category: 'PTS',
    city: 'Magelang'
  },
  {
    name: 'Universitas Muria Kudus',
    shortName: 'UMK',
    aliases: ['umk', 'muria kudus', 'univ muria kudus'],
    domain: 'umk.ac.id',
    category: 'PTS',
    city: 'Kudus'
  },
  {
    name: 'Universitas Pancasakti Tegal',
    shortName: 'UPS Tegal',
    aliases: ['ups tegal', 'pancasakti tegal'],
    domain: 'upstegal.ac.id',
    category: 'PTS',
    city: 'Tegal'
  },
  {
    name: 'Poltekkes Kemenkes Semarang',
    shortName: 'Poltekkes Smg',
    aliases: ['poltekkes semarang', 'poltekkes kemenkes semarang'],
    domain: 'poltekkes-smg.ac.id',
    category: 'Kedinasan',
    city: 'Semarang'
  },

  // ========================================================
  // 6. JAWA BARAT, DKI JAKARTA, BANTEN
  // ========================================================
  {
    name: 'Universitas Indonesia',
    shortName: 'UI',
    aliases: ['ui', 'univ indonesia', 'makara ui', 'universitas indonesia depok'],
    domain: 'ui.ac.id',
    category: 'PTN',
    city: 'Depok / Jakarta'
  },
  {
    name: 'Institut Teknologi Bandung',
    shortName: 'ITB',
    aliases: ['itb', 'ganesha itb', 'institut teknologi bandung'],
    domain: 'itb.ac.id',
    category: 'PTN',
    city: 'Bandung'
  },
  {
    name: 'IPB University',
    shortName: 'IPB',
    aliases: ['ipb', 'institut pertanian bogor', 'ipb university', 'ipb bogor'],
    domain: 'ipb.ac.id',
    category: 'PTN',
    city: 'Bogor'
  },
  {
    name: 'Universitas Padjadjaran',
    shortName: 'UNPAD',
    aliases: ['unpad', 'padjadjaran', 'unpad jatinangor', 'unpad bandung'],
    domain: 'unpad.ac.id',
    category: 'PTN',
    city: 'Sumedang / Bandung'
  },
  {
    name: 'Universitas Pendidikan Indonesia',
    shortName: 'UPI',
    aliases: ['upi', 'upi bandung', 'ikip bandung'],
    domain: 'upi.edu',
    category: 'PTN',
    city: 'Bandung'
  },
  {
    name: 'Universitas Negeri Jakarta',
    shortName: 'UNJ',
    aliases: ['unj', 'unj jakarta', 'ikip jakarta'],
    domain: 'unj.ac.id',
    category: 'PTN',
    city: 'Jakarta'
  },
  {
    name: 'UPN "Veteran" Jakarta',
    shortName: 'UPN Jakarta',
    aliases: ['upn jakarta', 'upnvj', 'upn veteran jakarta'],
    domain: 'upnvj.ac.id',
    category: 'PTN',
    city: 'Jakarta'
  },
  {
    name: 'Politeknik Negeri Bandung',
    shortName: 'POLBAN',
    aliases: ['polban', 'politeknik negeri bandung', 'poltek itb'],
    domain: 'polban.ac.id',
    category: 'PTN',
    city: 'Bandung'
  },
  {
    name: 'Politeknik Negeri Jakarta',
    shortName: 'PNJ',
    aliases: ['pnj', 'politeknik negeri jakarta', 'poltek ui'],
    domain: 'pnj.ac.id',
    category: 'PTN',
    city: 'Depok'
  },
  {
    name: 'Politeknik Manufaktur Bandung',
    shortName: 'POLMAN',
    aliases: ['polman', 'polman bandung', 'pms itb'],
    domain: 'polman-bandung.ac.id',
    category: 'PTN',
    city: 'Bandung'
  },
  {
    name: 'Universitas Sultan Ageng Tirtayasa',
    shortName: 'UNTIRTA',
    aliases: ['untirta', 'untirta serang', 'sultan ageng tirtayasa'],
    domain: 'untirta.ac.id',
    category: 'PTN',
    city: 'Serang'
  },
  {
    name: 'Universitas Siliwangi',
    shortName: 'UNSIL',
    aliases: ['unsil', 'unsil tasikmalaya', 'siliwangi'],
    domain: 'unsil.ac.id',
    category: 'PTN',
    city: 'Tasikmalaya'
  },
  {
    name: 'Universitas Singaperbangsa Karawang',
    shortName: 'UNSIKA',
    aliases: ['unsika', 'unsika karawang', 'singaperbangsa'],
    domain: 'unsika.ac.id',
    category: 'PTN',
    city: 'Karawang'
  },
  {
    name: 'UIN Syarif Hidayatullah Jakarta',
    shortName: 'UIN Jakarta',
    aliases: ['uin jakarta', 'uin syarif hidayatullah', 'iain ciputat'],
    domain: 'uinjkt.ac.id',
    category: 'PTN',
    city: 'Tangerang Selatan'
  },
  {
    name: 'UIN Sunan Gunung Djati Bandung',
    shortName: 'UIN Bandung',
    aliases: ['uin bandung', 'uin sunan gunung djati', 'iain bandung'],
    domain: 'uinsgd.ac.id',
    category: 'PTN',
    city: 'Bandung'
  },
  {
    name: 'Telkom University',
    shortName: 'Tel-U',
    aliases: ['telkom university', 'tel-u', 'telkom bandung', 'universitas telkom'],
    domain: 'telkomuniversity.ac.id',
    category: 'PTS',
    city: 'Bandung'
  },
  {
    name: 'Universitas Bina Nusantara',
    shortName: 'BINUS',
    aliases: ['binus', 'binus university', 'bina nusantara'],
    domain: 'binus.ac.id',
    category: 'PTS',
    city: 'Jakarta'
  },
  {
    name: 'Universitas Trisakti',
    shortName: 'Trisakti',
    aliases: ['trisakti', 'usakti', 'univ trisakti'],
    domain: 'trisakti.ac.id',
    category: 'PTS',
    city: 'Jakarta'
  },
  {
    name: 'Universitas Tarumanagara',
    shortName: 'UNTAR',
    aliases: ['untar', 'tarumanagara', 'univ tarumanagara'],
    domain: 'untar.ac.id',
    category: 'PTS',
    city: 'Jakarta'
  },
  {
    name: 'Universitas Katolik Indonesia Atma Jaya',
    shortName: 'Atma Jaya Jkt',
    aliases: ['atma jaya jakarta', 'atmajaya jkt', 'unika atma jaya'],
    domain: 'atmajaya.ac.id',
    category: 'PTS',
    city: 'Jakarta'
  },
  {
    name: 'Universitas Katolik Parahyangan',
    shortName: 'UNPAR',
    aliases: ['unpar', 'parahyangan', 'unpar bandung'],
    domain: 'unpar.ac.id',
    category: 'PTS',
    city: 'Bandung'
  },
  {
    name: 'Universitas Kristen Maranatha',
    shortName: 'Maranatha',
    aliases: ['maranatha', 'maranatha bandung'],
    domain: 'maranatha.edu',
    category: 'PTS',
    city: 'Bandung'
  },
  {
    name: 'Universitas Pasundan',
    shortName: 'UNPAS',
    aliases: ['unpas', 'unpas bandung', 'pasundan'],
    domain: 'unpas.ac.id',
    category: 'PTS',
    city: 'Bandung'
  },
  {
    name: 'Universitas Islam Bandung',
    shortName: 'UNISBA',
    aliases: ['unisba', 'unisba bandung'],
    domain: 'unisba.ac.id',
    category: 'PTS',
    city: 'Bandung'
  },
  {
    name: 'Universitas Mercu Buana',
    shortName: 'UMB',
    aliases: ['mercu buana', 'umb jakarta'],
    domain: 'mercubuana.ac.id',
    category: 'PTS',
    city: 'Jakarta'
  },
  {
    name: 'Universitas Gunadarma',
    shortName: 'Gundar',
    aliases: ['gunadarma', 'gundar', 'univ gunadarma'],
    domain: 'gunadarma.ac.id',
    category: 'PTS',
    city: 'Depok / Jakarta'
  },
  {
    name: 'Universitas Multimedia Nusantara',
    shortName: 'UMN',
    aliases: ['umn', 'umn serpong', 'multimedia nusantara'],
    domain: 'umn.ac.id',
    category: 'PTS',
    city: 'Tangerang'
  },
  {
    name: 'Universitas Pelita Harapan',
    shortName: 'UPH',
    aliases: ['uph', 'pelita harapan', 'uph karawaci'],
    domain: 'uph.edu',
    category: 'PTS',
    city: 'Tangerang'
  },
  {
    name: 'President University',
    shortName: 'PresUniv',
    aliases: ['president university', 'presuniv', 'presiden university'],
    domain: 'president.ac.id',
    category: 'PTS',
    city: 'Cikarang'
  },
  {
    name: 'Politeknik Negeri Media Kreatif',
    shortName: 'POLIMEDIA',
    aliases: ['polimedia', 'politeknik negeri media kreatif', 'poltek media kreatif', 'polimedia kreatif', 'polimedia jakarta'],
    domain: 'polimedia.ac.id',
    category: 'PTN',
    city: 'Jakarta'
  },

  // ========================================================
  // 7. SEKOLAH KEDINASAN & MILITER / KEPOLISIAN
  // ========================================================
  {
    name: 'Politeknik Keuangan Negara STAN',
    shortName: 'PKN STAN',
    aliases: ['stan', 'pkn stan', 'stan bintaro', 'politeknik keuangan negara stan'],
    domain: 'pknstan.ac.id',
    category: 'Kedinasan',
    city: 'Tangerang Selatan'
  },
  {
    name: 'Institut Pemerintahan Dalam Negeri',
    shortName: 'IPDN',
    aliases: ['ipdn', 'ipdn jatinangor', 'stpdn'],
    domain: 'ipdn.ac.id',
    category: 'Kedinasan',
    city: 'Jatinangor'
  },
  {
    name: 'Politeknik Statistika STIS',
    shortName: 'STIS',
    aliases: ['stis', 'stis jakarta', 'politeknik statistika stis', 'ais'],
    domain: 'stis.ac.id',
    category: 'Kedinasan',
    city: 'Jakarta'
  },
  {
    name: 'Sekolah Tinggi Meteorologi Klimatologi dan Geofisika',
    shortName: 'STMKG',
    aliases: ['stmkg', 'stmkg bintaro', 'bmkg'],
    domain: 'stmkg.ac.id',
    category: 'Kedinasan',
    city: 'Tangerang Selatan'
  },
  {
    name: 'Politeknik Ilmu Pemasyarakatan',
    shortName: 'POLTEKIP',
    aliases: ['poltekip', 'akip', 'politeknik ilmu pemasyarakatan'],
    domain: 'poltekip.ac.id',
    category: 'Kedinasan',
    city: 'Depok'
  },
  {
    name: 'Politeknik Imigrasi',
    shortName: 'POLTEKIM',
    aliases: ['poltekim', 'aim', 'politeknik imigrasi'],
    domain: 'poltekim.ac.id',
    category: 'Kedinasan',
    city: 'Depok'
  },
  {
    name: 'Politeknik Siber dan Sandi Negara',
    shortName: 'Poltek SSN',
    aliases: ['poltek ssn', 'stsn', 'poltek sandi negara'],
    domain: 'poltekssn.ac.id',
    category: 'Kedinasan',
    city: 'Bogor'
  },
  {
    name: 'Sekolah Tinggi Intelijen Negara',
    shortName: 'STIN',
    aliases: ['stin', 'stin sentul', 'sekolah tinggi intelijen negara'],
    domain: 'stin.ac.id',
    category: 'Kedinasan',
    city: 'Bogor'
  },
  {
    name: 'Politeknik Transportasi Darat Indonesia',
    shortName: 'PTDI-STTD',
    aliases: ['sttd', 'ptdi sttd', 'sttd bekasi'],
    domain: 'ptdisttd.ac.id',
    category: 'Kedinasan',
    city: 'Bekasi'
  },
  {
    name: 'Politeknik Penerbangan Surabaya',
    shortName: 'Poltekbang Sby',
    aliases: ['poltekbang surabaya', 'atkp surabaya'],
    domain: 'poltekbangsby.ac.id',
    category: 'Kedinasan',
    city: 'Surabaya'
  },
  {
    name: 'Politeknik Pelayaran Surabaya',
    shortName: 'Poltekpel Sby',
    aliases: ['poltekpel surabaya', 'bp2ip surabaya'],
    domain: 'poltekpel-sby.ac.id',
    category: 'Kedinasan',
    city: 'Surabaya'
  },
  {
    name: 'Akademi Militer',
    shortName: 'AKMIL',
    aliases: ['akmil', 'akmil magelang', 'akademi militer'],
    domain: 'akmil.ac.id',
    category: 'TNI/Polri',
    city: 'Magelang'
  },
  {
    name: 'Akademi Kepolisian',
    shortName: 'AKPOL',
    aliases: ['akpol', 'akpol semarang', 'akademi kepolisian'],
    domain: 'akpol.ac.id',
    category: 'TNI/Polri',
    city: 'Semarang'
  },
  {
    name: 'Akademi Angkatan Laut',
    shortName: 'AAL',
    aliases: ['aal', 'aal surabaya', 'bumimoro'],
    domain: 'aal.ac.id',
    category: 'TNI/Polri',
    city: 'Surabaya'
  },
  {
    name: 'Akademi Angkatan Udara',
    shortName: 'AAU',
    aliases: ['aau', 'aau yogyakarta', 'aau jogja'],
    domain: 'aau.ac.id',
    category: 'TNI/Polri',
    city: 'Yogyakarta'
  },
  {
    name: 'TNI Angkatan Darat (Akmil)',
    shortName: 'TNI AD',
    aliases: ['tni ad', 'ad', 'angkatan darat', 'tni angkatan darat', 'akmil', 'akademi militer'],
    domain: 'akmil.ac.id',
    category: 'TNI/Polri',
    city: 'Magelang'
  },

  // ========================================================
  // 8. SUMATRA, BALI, KALIMANTAN, SULAWESI, DLL
  // ========================================================
  {
    name: 'Universitas Sumatera Utara',
    shortName: 'USU',
    aliases: ['usu', 'usu medan', 'sumatera utara'],
    domain: 'usu.ac.id',
    category: 'PTN',
    city: 'Medan'
  },
  {
    name: 'Universitas Andalas',
    shortName: 'UNAND',
    aliases: ['unand', 'unand padang', 'andalas'],
    domain: 'unand.ac.id',
    category: 'PTN',
    city: 'Padang'
  },
  {
    name: 'Universitas Riau',
    shortName: 'UNRI',
    aliases: ['unri', 'unri pekanbaru', 'univ riau'],
    domain: 'unri.ac.id',
    category: 'PTN',
    city: 'Pekanbaru'
  },
  {
    name: 'Universitas Sriwijaya',
    shortName: 'UNSRI',
    aliases: ['unsri', 'unsri palembang', 'sriwijaya'],
    domain: 'unsri.ac.id',
    category: 'PTN',
    city: 'Palembang'
  },
  {
    name: 'Universitas Lampung',
    shortName: 'UNILA',
    aliases: ['unila', 'unila lampung', 'univ lampung'],
    domain: 'unila.ac.id',
    category: 'PTN',
    city: 'Bandar Lampung'
  },
  {
    name: 'Institut Teknologi Sumatera',
    shortName: 'ITERA',
    aliases: ['itera', 'itera lampung'],
    domain: 'itera.ac.id',
    category: 'PTN',
    city: 'Lampung Selatan'
  },
  {
    name: 'Universitas Syiah Kuala',
    shortName: 'USK',
    aliases: ['usk', 'unsyiah', 'syiah kuala aceh'],
    domain: 'usk.ac.id',
    category: 'PTN',
    city: 'Banda Aceh'
  },
  {
    name: 'Universitas Negeri Padang',
    shortName: 'UNP',
    aliases: ['unp', 'unp padang', 'ikip padang'],
    domain: 'unp.ac.id',
    category: 'PTN',
    city: 'Padang'
  },
  {
    name: 'Universitas Negeri Medan',
    shortName: 'UNIMED',
    aliases: ['unimed', 'unimed medan', 'ikip medan'],
    domain: 'unimed.ac.id',
    category: 'PTN',
    city: 'Medan'
  },
  {
    name: 'Universitas Udayana',
    shortName: 'UNUD',
    aliases: ['unud', 'unud bali', 'udayana denpasar'],
    domain: 'unud.ac.id',
    category: 'PTN',
    city: 'Denpasar'
  },
  {
    name: 'Universitas Pendidikan Ganesha',
    shortName: 'UNDIKSHA',
    aliases: ['undiksha', 'undiksha singaraja', 'undiksha bali'],
    domain: 'undiksha.ac.id',
    category: 'PTN',
    city: 'Singaraja'
  },
  {
    name: 'Universitas Mataram',
    shortName: 'UNRAM',
    aliases: ['unram', 'unram lombok', 'mataram'],
    domain: 'unram.ac.id',
    category: 'PTN',
    city: 'Mataram'
  },
  {
    name: 'Universitas Nusa Cendana',
    shortName: 'UNDANA',
    aliases: ['undana', 'undana kupang'],
    domain: 'undana.ac.id',
    category: 'PTN',
    city: 'Kupang'
  },
  {
    name: 'Universitas Tanjungpura',
    shortName: 'UNTAN',
    aliases: ['untan', 'untan pontianak'],
    domain: 'untan.ac.id',
    category: 'PTN',
    city: 'Pontianak'
  },
  {
    name: 'Universitas Lambung Mangkurat',
    shortName: 'ULM',
    aliases: ['ulm', 'unlam', 'lambung mangkurat'],
    domain: 'ulm.ac.id',
    category: 'PTN',
    city: 'Banjarmasin'
  },
  {
    name: 'Universitas Mulawarman',
    shortName: 'UNMUL',
    aliases: ['unmul', 'unmul samarinda'],
    domain: 'unmul.ac.id',
    category: 'PTN',
    city: 'Samarinda'
  },
  {
    name: 'Institut Teknologi Kalimantan',
    shortName: 'ITK',
    aliases: ['itk', 'itk balikpapan'],
    domain: 'itk.ac.id',
    category: 'PTN',
    city: 'Balikpapan'
  },
  {
    name: 'Universitas Hasanuddin',
    shortName: 'UNHAS',
    aliases: ['unhas', 'unhas makassar', 'hasanuddin'],
    domain: 'unhas.ac.id',
    category: 'PTN',
    city: 'Makassar'
  },
  {
    name: 'Universitas Negeri Makassar',
    shortName: 'UNM',
    aliases: ['unm', 'unm makassar', 'ikip ujung pandang'],
    domain: 'unm.ac.id',
    category: 'PTN',
    city: 'Makassar'
  },
  {
    name: 'Universitas Sam Ratulangi',
    shortName: 'UNSRAT',
    aliases: ['unsrat', 'unsrat manado'],
    domain: 'unsrat.ac.id',
    category: 'PTN',
    city: 'Manado'
  },
  {
    name: 'Universitas Tadulako',
    shortName: 'UNTAD',
    aliases: ['untad', 'untad palu'],
    domain: 'untad.ac.id',
    category: 'PTN',
    city: 'Palu'
  },
  {
    name: 'Universitas Halu Oleo',
    shortName: 'UHO',
    aliases: ['uho', 'univ haluoleo', 'universitas halu oleo', 'unhalu', 'halu oleo', 'uho kendari'],
    domain: 'uho.ac.id',
    category: 'PTN',
    city: 'Kendari'
  },
  {
    name: 'Universitas Cenderawasih',
    shortName: 'UNCEN',
    aliases: ['uncen', 'uncen jayapura', 'cenderawasih papua'],
    domain: 'uncen.ac.id',
    category: 'PTN',
    city: 'Jayapura'
  }
]

/**
 * Normalisasi string teks untuk pencocokan (huruf kecil, buang tanda baca, spasi tunggal)
 */
function normalizeText(str) {
  if (!str || typeof str !== 'string') return ''
  return str
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasWordBoundaryMatch(source, target) {
  if (!source || !target) return false
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|\\s)${escaped}(\\s|$)`, 'i').test(source)
}

// Lengkapi seluruh 145 PTN resmi SNPMB (Kemendikbud) ke dalam basis data kampus
snpmbData.forEach(p => {
  const normName = normalizeText(p.name)
  const exists = CAMPUS_LIST.some(c => normalizeText(c.name) === normName || c.aliases.some(a => normalizeText(a) === normName))
  if (!exists) {
    let domain = null
    if (p.web) {
      try {
        const u = new URL(p.web)
        domain = u.hostname.replace(/^pmb\./, '').replace(/^admisi\./, '').replace(/^spmb\./, '')
      } catch (e) {}
    }
    CAMPUS_LIST.push({
      name: p.name,
      shortName: p.name,
      aliases: [p.rawName.toLowerCase(), p.name.toLowerCase()],
      domain: domain,
      category: 'PTN',
      city: 'Indonesia'
    })
  }
})

/**
 * Mencari data kampus berdasarkan nama, singkatan, atau alias
 * @param {string} query 
 * @returns {Object|null}
 */
export function findCampus(query) {
  if (!query || typeof query !== 'string') return null
  const cleanQuery = normalizeText(query)
  if (!cleanQuery) return null

  // 1. Cek kecocokan persis pada nama resmi atau shortName
  for (const c of CAMPUS_LIST) {
    if (normalizeText(c.name) === cleanQuery || normalizeText(c.shortName) === cleanQuery) {
      return c
    }
  }

  // 2. Cek kecocokan persis pada array aliases
  for (const c of CAMPUS_LIST) {
    if (c.aliases.some(alias => normalizeText(alias) === cleanQuery)) {
      return c
    }
  }

  // 3. Pencocokan cerdas parsial berbasis skor dan batas kata (word boundaries)
  let bestMatch = null
  let bestScore = 0

  for (const c of CAMPUS_LIST) {
    const normName = normalizeText(c.name)
    const normShort = normalizeText(c.shortName)

    // Cek kecocokan alias (alias lebih panjang/spesifik bernilai lebih tinggi)
    for (const alias of c.aliases) {
      const normAlias = normalizeText(alias)
      if (normAlias.length >= 2 && hasWordBoundaryMatch(cleanQuery, normAlias)) {
        const score = normAlias.length * 10
        if (score > bestScore) {
          bestScore = score
          bestMatch = c
        }
      }
    }

    // Cek kecocokan shortName
    if (normShort.length >= 3 && hasWordBoundaryMatch(cleanQuery, normShort)) {
      const score = normShort.length * 8
      if (score > bestScore) {
        bestScore = score
        bestMatch = c
      }
    }

    // Cek kecocokan nama resmi lengkap (untuk query panjang)
    if (cleanQuery.length >= 6) {
      if (hasWordBoundaryMatch(cleanQuery, normName)) {
        const score = normName.length * 12
        if (score > bestScore) {
          bestScore = score
          bestMatch = c
        }
      } else if (hasWordBoundaryMatch(normName, cleanQuery)) {
        const score = cleanQuery.length * 10
        if (score > bestScore) {
          bestScore = score
          bestMatch = c
        }
      }
    }
  }

  return bestMatch
}

/**
 * Menghasilkan URL logo resmi kampus via Google Favicon CDN 128px (Jernih, Cepat, Zero-Download)
 * @param {string} institutionName - Nama kampus / perusahaan / instansi
 * @returns {string|null} URL gambar PNG atau null jika tidak terdeteksi
 */
export function getInstitutionLogo(institutionName) {
  if (!institutionName || typeof institutionName !== 'string') return null

  // 1. Cek apakah institusi cocok dengan basis data kampus
  const campus = findCampus(institutionName)
  if (campus) {
    if (campus.logoUrl) return campus.logoUrl
    if (campus.domain) {
      return `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${campus.domain}&size=128`
    }
  }

  // 2. Jika nama mengandung format domain (misal: "pertamina.com", "shopee.co.id")
  const domainMatch = institutionName.match(/([a-zA-Z0-9-]+\.(ac\.id|co\.id|go\.id|com|org|net|edu))/i)
  if (domainMatch) {
    return `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domainMatch[0]}&size=128`
  }

  return null
}

/**
 * Filter daftar kampus untuk autocomplete / combobox dropdown
 * @param {string} query
 * @param {number} limit
 */
export function searchCampuses(query = '', limit = 12) {
  if (!query || !query.trim()) {
    return CAMPUS_LIST.slice(0, limit)
  }

  const q = normalizeText(query)
  const results = CAMPUS_LIST.filter(c => {
    return (
      normalizeText(c.name).includes(q) ||
      normalizeText(c.shortName).includes(q) ||
      c.aliases.some(a => normalizeText(a).includes(q)) ||
      normalizeText(c.city).includes(q)
    )
  })

  return results.slice(0, limit)
}
