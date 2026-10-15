import supabase from '@/lib/supabase';
import domains from '@/lib/domains';
import TEMPLATE from '@/lib/chatTemplate';
import widgetConfig from '@/lib/widgetConfig';

export const dynamic = 'force-dynamic';

function safeJson(o) {
  return JSON.stringify(o).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

function text(code, msg) {
  return new Response(msg, {
    status: code,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

// Menyajikan halaman chat untuk /chat/:slug.
// Header CSP frame-ancestors memastikan browser hanya mau menampilkan halaman ini
// sebagai iframe di domain yang diizinkan klien. Dibuka langsung (tab sendiri) tetap bisa.
export async function GET(request, context) {
  const { slug: raw } = await context.params;
  const slug = String(raw || '');
  if (!/^[a-z0-9-]{3,30}$/.test(slug)) return text(404, 'Asisten tidak ditemukan');

  let shop;
  try {
    const r = await supabase.getAdmin().from('shops')
      .select('*')
      .eq('slug', slug).maybeSingle();
    if (r.error) throw r.error;
    shop = r.data;
  } catch (e) {
    console.error(e);
    return text(500, 'Terjadi gangguan. Coba lagi sebentar.');
  }
  if (!shop) return text(404, 'Asisten tidak ditemukan');

  const wc = widgetConfig.clean(shop);
  const cfg = {
    slug: shop.slug,
    shopName: shop.name,
    botName: shop.bot_name,
    greeting: shop.greeting,
    tone: shop.tone,
    accent: wc.color,
    icon: wc.icon,
    logo: wc.logo,
    bubble: wc.bubble,
    hours: wc.hours,
    eta: wc.eta
  };
  const html = TEMPLATE.replace('__CONFIG__', () => safeJson(cfg));

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy':
        "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src data:; " +
        "base-uri 'none'; form-action 'none'; " + domains.frameAncestors(shop.allowed_domains)
    }
  });
}
