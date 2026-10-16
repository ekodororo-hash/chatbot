// Info pengunjung web dari header permintaan. Diambil di server, bukan dari browser, jadi tidak bisa dipalsukan lewat widget.
// Di Vercel, header x-vercel-ip-* dan x-vercel-forwarded-for diisi otomatis oleh platform (gratis, tanpa layanan pihak ketiga).
// Saat dijalankan lokal atau di luar Vercel headernya tidak ada, hasilnya kosong dan percakapan tetap berjalan normal.

const names = (() => {
  try { return new Intl.DisplayNames(['id'], { type: 'region' }); } catch (e) { return null; }
})();

const IP = /^[0-9a-fA-F:.]{3,45}$/;

function visitorFromHeaders(h) {
  const get = (k) => String((h && h.get(k)) || '');
  const rawIp = (get('x-vercel-forwarded-for') || get('x-real-ip') || get('x-forwarded-for')).split(',')[0].trim();
  const ip = IP.test(rawIp) ? rawIp : null;

  const code = get('x-vercel-ip-country').trim().toUpperCase();
  let country = null;
  // XX = tidak diketahui, T1 = jaringan Tor.
  if (/^[A-Z]{2}$/.test(code) && code !== 'XX' && code !== 'T1') {
    try { country = (names && names.of(code)) || code; } catch (e) { country = code; }
  }

  let city = get('x-vercel-ip-city');
  try { city = decodeURIComponent(city); } catch (e) { /* biarkan apa adanya */ }
  city = city.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 80) || null;

  return { ip, country, city };
}

module.exports = { visitorFromHeaders };
