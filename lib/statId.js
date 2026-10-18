// ID anonim pengunjung untuk statistik widget: 1 IP + 1 browser dihitung 1 kali per hari (per jenis: view/open/wa).
// IP dan User-Agent tidak disimpan. Yang masuk ke database hanya hash HMAC yang berganti tiap hari (tanggal WIB ikut di-hash),
// jadi pengunjung tidak bisa dilacak lintas hari dan IP asli tidak bisa dipulihkan dari tabelnya.

const crypto = require('crypto');

function dayWib(now) {
  return new Date((now || Date.now()) + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

// Mengembalikan string hash, atau null kalau IP tidak diketahui (mis. jalan lokal): di kasus itu server menghitung tanpa dedup.
function statVisitorId(ip, userAgent, opts) {
  if (!ip) return null;
  const o = opts || {};
  const secret = o.secret || process.env.STAT_SALT || process.env.CRON_SECRET || 'widget-stat';
  const ua = String(userAgent || '').slice(0, 300);
  return crypto.createHmac('sha256', secret).update(dayWib(o.now) + '|' + ip + '|' + ua).digest('hex').slice(0, 32);
}

module.exports = { statVisitorId, dayWib };
