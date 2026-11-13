const https = require('https');
const fs = require('fs');
const path = require('path');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { rejectUnauthorized: false }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse JSON from ${url}: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Convert "UNIVERSITAS NEGERI SURABAYA" -> "Universitas Negeri Surabaya"
function toTitleCase(str) {
  if (!str) return '';
  return str.split(' ').map(w => {
    if (!w) return '';
    // Keep acronyms like ITB, ITS, UGM, UIN, UI, PENS, PPNS, PSDKU, etc.
    const upper = w.toUpperCase();
    if (['ITB', 'ITS', 'UGM', 'UI', 'UIN', 'IAIN', 'STAIN', 'IPB', 'UNAIR', 'UB', 'UM', 'UNESA', 'UNS', 'UNDIP', 'UNY', 'USU', 'UNHAS', 'UNAND', 'PENS', 'PPNS', 'POLINEMA', 'POLINES'].includes(upper)) {
      return upper;
    }
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(' ');
}

async function main() {
  console.log('Fetching PTN list from snpmb.id...');
  const ptnList = await get('https://snpmb.id/proxy-ptn-sb.php');
  console.log(`Found ${ptnList.length} PTN.`);

  const result = [];

  for (let i = 0; i < ptnList.length; i++) {
    const ptn = ptnList[i];
    const id = ptn.id_ptn;
    const rawName = ptn.nama.trim();
    const formattedName = toTitleCase(rawName);

    process.stdout.write(`[${i + 1}/${ptnList.length}] Fetching prodi for ${formattedName} (ID: ${id})...\r`);

    let prodiList = [];
    try {
      const rawProdi = await get(`https://snpmb.id/proxy-prodi-sb.php?ptn=${id}`);
      if (Array.isArray(rawProdi)) {
        prodiList = rawProdi.map(p => {
          const prodiName = toTitleCase(p.nama.trim());
          const jenjang = (p.jenjang || 'S1').toUpperCase();
          const fullName = `${jenjang} ${prodiName}`;
          return {
            id_prodi: p.id_prodi || p.kode_prodi,
            nama: prodiName,
            jenjang: jenjang,
            fullName: fullName,
            dayaTampung: p.daya_tampung_snbt ? parseInt(p.daya_tampung_snbt) : null,
            portofolio: p.nama_portofolio && p.nama_portofolio !== 'Tidak Ada' ? p.nama_portofolio : null
          };
        });
      }
    } catch (err) {
      console.error(`\nError fetching prodi for ${rawName}:`, err.message);
    }

    result.push({
      id: id,
      kode: ptn.kode_ptn,
      name: formattedName,
      rawName: rawName,
      web: ptn.web || null,
      category: 'PTN',
      isAkademik: Boolean(ptn.is_akademik),
      isVokasi: Boolean(ptn.is_vokasi),
      isPtkin: Boolean(ptn.is_ptkin),
      prodiCount: prodiList.length,
      prodi: prodiList
    });

    // Small delay to be polite to the server
    await delay(60);
  }

  console.log('\nFinished fetching all PTN & Prodi.');

  const outDir = path.join(__dirname, '..', 'src', 'data');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outPath = path.join(outDir, 'snpmbData.json');
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');

  // Also create a minified index for quick runtime lookup
  const minifiedPath = path.join(outDir, 'snpmbData.min.json');
  fs.writeFileSync(minifiedPath, JSON.stringify(result), 'utf8');

  console.log(`Saved to ${outPath}`);
  console.log(`Total PTN: ${result.length}, Total Prodi: ${result.reduce((a, b) => a + b.prodiCount, 0)}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

