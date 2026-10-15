import auth from '@/lib/auth';
import siteCheck from '@/lib/siteCheck';
import domains from '@/lib/domains';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

// Cek pemasangan: ambil halaman situs klien, cari kode widget toko ini, dan bandingkan domainnya
// dengan daftar domain terdaftar. Hanya untuk anggota toko yang sedang login.
export async function POST(request) {
  try {
    const { shop } = await auth.requireMember(request);
    let b;
    try { b = await request.json(); } catch (e) { return json({ error: 'Format permintaan salah' }, 400); }

    const raw = String((b && b.url) || '');
    if (/^(https?:\/\/)?localhost(:\d+)?(\/|$)/i.test(raw.trim())) {
      return json({ error: 'localhost tidak bisa dicek dari server. Cek setelah situsnya online.' }, 400);
    }
    const url = siteCheck.parseSiteUrl(raw);
    if (!url) return json({ error: 'Alamat situs tidak valid. Contoh: tokoayu.com' }, 400);

    const allowed = shop.allowed_domains || [];
    const page = await siteCheck.fetchPage(url);
    // Domain yang dicek = situs tujuan akhir setelah redirect, karena di sanalah widget akan tampil.
    const finalUrl = page.fetched ? page.url : url;
    const domain = domains.normalizeDomain(finalUrl.hostname);
    const domainOk = siteCheck.isRegistered(finalUrl.hostname, allowed);

    if (!page.fetched) return json({ fetched: false, blocked: !!page.blocked, reason: page.reason, domain, domainOk });

    const a = siteCheck.analyzeHtml(page.body, shop.slug);
    return json({
      fetched: true,
      domain,
      domainOk,
      found: a.found,
      match: a.match,
      others: a.others.slice(0, 3),
      redirected: page.redirected ? finalUrl.origin : '',
      truncated: !!page.truncated
    });
  } catch (e) {
    const code = e.httpStatus || 500;
    if (code === 500) console.error(e);
    return json({ error: code === 500 ? 'Terjadi gangguan. Coba lagi sebentar.' : e.message }, code);
  }
}
