'use client';
/* Isi halaman-halaman admin layanan. Data & aksi datang dari AdminShell lewat context. */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Busy, rp, dayTime } from '../dashboard/helpers';
import { SkForm } from '../components/Skeleton';
import { useAdmin } from './context';

const dateOnly = (iso) => (iso ? new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-');
const STATUS = { paid: 'Lunas', pending: 'Menunggu', failed: 'Gagal', expired: 'Kedaluwarsa' };
const num = (n) => Number(n || 0).toLocaleString('id-ID');

function Stat({ label, value, note }) {
  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <span className="hint">{label}</span>
      <h2 style={{ margin: '2px 0 0' }}>{value}</h2>
      <span className="hint">{note}</span>
    </div>
  );
}

function PaymentRows({ payments }) {
  if (!payments.length) return <p className="hint">Belum ada pembayaran.</p>;
  return payments.map((p) => (
    <div className="li" key={p.order_id}>
      <div className="t stack">
        <b>{(p.shop_name || 'Toko') + ' · ' + p.plan + ' ' + p.months + ' bulan'}</b>
        <small>{rp(p.amount) + ' · ' + (p.provider || '-') + ' · ' + dayTime(p.created_at)}</small>
      </div>
      <span className={'tag' + (p.status === 'paid' ? ' a' : p.status === 'pending' ? '' : ' w')}>{STATUS[p.status] || p.status}</span>
    </div>
  ));
}

function ShopUsage({ s }) {
  const pct = s.quota ? Math.min(100, Math.round((s.used / s.quota) * 100)) : 0;
  return (
    <>
      <div className={'bar' + (pct >= 90 ? ' hot' : '')} aria-hidden="true"><i style={{ width: pct + '%' }} /></div>
      <small className="hint">{num(s.used) + ' / ' + num(s.quota) + ' balasan bulan ini · ' + s.convs + ' percakapan' + (s.expires_at ? ' · berakhir ' + dateOnly(s.expires_at) : '')}</small>
    </>
  );
}

export function RingkasanView() {
  const { data } = useAdmin();
  const t = data.totals;
  return (
    <>
      <div className="grid2" style={{ marginBottom: 14 }}>
        <Stat label="Total toko" value={t.shops} note={t.paidShops + ' berlangganan aktif'} />
        <Stat label="Pendapatan bulan ini" value={rp(t.revenueMonth)} note="dari pembayaran lunas" />
        <Stat label="Balasan bot bulan ini" value={num(t.botRepliesMonth)} note="semua toko" />
        <Stat label="Total percakapan" value={num(t.conversations)} note="sejak awal" />
      </div>
      <div className="card">
        <h2>Toko terbaru</h2>
        {!data.shops.length ? <p className="hint">Belum ada toko.</p> : null}
        {data.shops.slice(0, 5).map((s) => (
          <div key={s.id} style={{ borderTop: '1px solid var(--line)', padding: '12px 0' }}>
            <div className="li" style={{ border: 0, padding: 0 }}>
              <div className="t"><b>{s.name}</b><small>{(s.owner || 'pemilik tidak diketahui') + ' · /chat/' + s.slug}</small></div>
              {!s.bot_on ? <span className="tag w">Bot mati</span> : null}
              <span className={'tag' + (s.plan !== 'free' ? ' a' : '')}>{s.plan_name}</span>
            </div>
            <ShopUsage s={s} />
          </div>
        ))}
        {data.shops.length ? <Link className="btn ghost sm" href="/admin/toko">Lihat semua toko</Link> : null}
      </div>
      <div className="card">
        <h2>Pembayaran terbaru</h2>
        <PaymentRows payments={data.payments.slice(0, 5)} />
        {data.payments.length ? <Link className="btn ghost sm" href="/admin/pembayaran">Lihat semua pembayaran</Link> : null}
      </div>
    </>
  );
}

export function TokoView() {
  const { data, act } = useAdmin();
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState(null);
  const [plan, setPlan] = useState('starter');
  const [days, setDays] = useState('30');
  const [busy, setBusy] = useState('');
  const [delText, setDelText] = useState('');

  const shops = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return data.shops;
    return data.shops.filter((s) => [s.name, s.slug, s.owner].some((x) => String(x || '').toLowerCase().includes(t)));
  }, [data, q]);

  async function run(key, body, okMsg) {
    setBusy(key);
    const ok = await act(body, okMsg);
    setBusy('');
    return ok;
  }

  return (
    <div className="card">
      <input type="search" placeholder="Cari nama toko, slug, atau email pemilik" aria-label="Cari toko" value={q} onChange={(e) => setQ(e.target.value)} />
      {data.totals.capped ? <p className="hint">{'Menampilkan 200 toko terbaru dari ' + data.totals.shops + '.'}</p> : null}
      <div style={{ marginTop: 8 }}>
        {!shops.length ? <p className="hint">Tidak ada toko yang cocok.</p> : null}
        {shops.map((s) => {
          const open = openId === s.id;
          return (
            <div key={s.id} style={{ borderTop: '1px solid var(--line)', padding: '12px 0' }}>
              <div className="li" style={{ border: 0, padding: 0 }}>
                <button type="button" className="open" onClick={() => { setOpenId(open ? null : s.id); setDelText(''); }} aria-expanded={open}>
                  <div className="t">
                    <b>{s.name}</b>
                    <small>{(s.owner || 'pemilik tidak diketahui') + ' · /chat/' + s.slug}</small>
                  </div>
                </button>
                {!s.bot_on ? <span className="tag w">Bot mati</span> : null}
                <span className={'tag' + (s.plan !== 'free' ? ' a' : '')}>{s.plan_name}</span>
              </div>
              <ShopUsage s={s} />

              {open ? (
                <div className="item" style={{ marginTop: 10 }}>
                  <b>Ubah paket manual</b>
                  <p className="hint">Untuk klien yang bayar lewat transfer. Masa berlaku dihitung mulai hari ini.</p>
                  <div className="grid2">
                    <select aria-label="Paket" value={plan} onChange={(e) => setPlan(e.target.value)}>
                      {data.plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input type="number" min="1" max="3650" aria-label="Lama (hari)" placeholder="Lama (hari)" value={days} disabled={plan === 'free'} onChange={(e) => setDays(e.target.value)} />
                  </div>
                  <div className="row">
                    <button className="btn sm" type="button" disabled={!!busy} onClick={() => run('plan' + s.id, { action: 'set_plan', shopId: s.id, plan, days }, 'Paket diubah.')}>
                      <Busy on={busy === 'plan' + s.id} label="Menyimpan...">Simpan paket</Busy>
                    </button>
                    <button className="btn ghost sm" type="button" disabled={!!busy} onClick={() => run('bot' + s.id, { action: 'set_bot', shopId: s.id, on: !s.bot_on }, s.bot_on ? 'Bot dimatikan.' : 'Bot dinyalakan.')}>
                      <Busy on={busy === 'bot' + s.id} label="Menyimpan...">{s.bot_on ? 'Matikan bot' : 'Nyalakan bot'}</Busy>
                    </button>
                    <a className="btn ghost sm" href={'/chat/' + s.slug} target="_blank" rel="noopener">Buka chat</a>
                  </div>
                  <b style={{ display: 'block', marginTop: 14 }}>Hapus toko</b>
                  <p className="hint">{'Menghapus permanen toko ini beserta produk, FAQ, percakapan, tim, saluran, dan riwayat pembayarannya. Tidak bisa dibatalkan. Ketik alamat chat (' + s.slug + ') untuk konfirmasi.'}</p>
                  <input aria-label="Ketik alamat chat untuk konfirmasi" autoComplete="off" value={delText} onChange={(e) => setDelText(e.target.value)} />
                  <div className="row">
                    <button className="btn danger solid sm" type="button" disabled={!!busy || delText.trim() !== s.slug}
                      onClick={async () => { if (await run('del' + s.id, { action: 'delete_shop', shopId: s.id, confirm: delText.trim() }, 'Toko dihapus.')) { setOpenId(null); setDelText(''); } }}>
                      <Busy on={busy === 'del' + s.id} label="Menghapus...">Hapus permanen</Busy>
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PenggunaView() {
  const { sb } = useAdmin();
  const [q, setQ] = useState('');
  const [st, setSt] = useState({ loading: true, error: '', res: null });

  useEffect(() => {
    if (!sb) return undefined;
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const { data: s } = await sb.auth.getSession();
        const tok = s && s.session && s.session.access_token;
        const res = await fetch('/api/admin/pengguna?q=' + encodeURIComponent(q.trim()), { headers: { Authorization: 'Bearer ' + tok } });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error || 'Gagal memuat pengguna.');
        if (alive) setSt({ loading: false, error: '', res: j });
      } catch (e) {
        if (alive) setSt((p) => ({ loading: false, error: e.message || 'Gagal memuat pengguna.', res: p.res }));
      }
    }, q ? 300 : 0);
    return () => { alive = false; clearTimeout(t); };
  }, [sb, q]);

  const r = st.res;
  if (!r && st.error) return <div className="card"><p className="err" role="alert">{st.error}</p></div>;
  if (!r) return <div className="card"><SkForm fields={3} /></div>;

  return (
    <>
      <div className="grid2" style={{ marginBottom: 14 }}>
        <Stat label="Total pengguna" value={num(r.stats.total)} note="akun yang mendaftar" />
        <Stat label="Daftar 7 hari terakhir" value={num(r.stats.new7)} note="pengguna baru" />
        <Stat label="Aktif 30 hari terakhir" value={num(r.stats.active30)} note="pernah login" />
        <Stat label="Belum punya toko" value={num(r.stats.noShop)} note="daftar tapi belum membuat toko" />
      </div>
      <div className="card">
        <input type="search" placeholder="Cari email atau nama toko" aria-label="Cari pengguna" value={q} onChange={(e) => setQ(e.target.value)} />
        {st.error ? <p className="err" role="alert">{st.error}</p> : null}
        {r.stats.capped ? <p className="hint">{'Hanya sebagian akun yang dibaca dari total ' + num(r.stats.total) + '. Pakai kolom cari untuk akun tertentu.'}</p> : null}
        {r.matched > r.users.length ? <p className="hint">{'Menampilkan ' + r.users.length + ' dari ' + num(r.matched) + ' hasil. Persempit pencarian untuk melihat yang lain.'}</p> : null}
        <div style={{ marginTop: 8 }}>
          {!r.users.length ? <p className="hint">Tidak ada pengguna yang cocok.</p> : null}
          {r.users.map((u) => (
            <div className="li" key={u.id}>
              <div className="t stack">
                <b>{u.email || '(tanpa email)'}</b>
                <small>{'Daftar ' + dateOnly(u.created_at) + ' · login terakhir ' + (u.last_sign_in_at ? dayTime(u.last_sign_in_at) : 'belum pernah') + ' · ' + u.provider}</small>
                <small>{u.shops.length ? u.shops.map((s) => s.name + (s.role === 'owner' ? ' (pemilik)' : ' (admin)')).join(', ') : 'Belum punya toko'}</small>
              </div>
              {!u.confirmed ? <span className="tag w">Belum konfirmasi</span> : null}
              {!u.shops.length ? <span className="tag w">Tanpa toko</span> : null}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function PembayaranView() {
  const { data } = useAdmin();
  return (
    <div className="card">
      <PaymentRows payments={data.payments} />
    </div>
  );
}

const PLAN_ORDER = ['free', 'starter', 'bisnis'];
const TERM_ORDER = ['1', '3', '12'];

// Hitung harga untuk pratinjau (rumus sama dengan lib/plans.js priceFor; yang berlaku tetap dihitung server).
function previewPrice(p, discount) {
  return Math.round(Number(p.price) * (100 - Number(p.promo || 0)) / 100 * (100 - Number(discount || 0)) / 100);
}

export function PaketView() {
  const { data, act } = useAdmin();
  const cfg = data.planConfig;
  const fromCfg = (c) => ({
    plans: Object.fromEntries(PLAN_ORDER.map((id) => [id, { name: c.plans[id].name, price: String(c.plans[id].price), quota: String(c.plans[id].quota), promo: String(c.plans[id].promo || 0) }])),
    terms: Object.fromEntries(TERM_ORDER.map((m) => [m, String(c.terms[m])]))
  });
  const [form, setForm] = useState(() => fromCfg(cfg));
  const [busy, setBusy] = useState('');
  const setPlan = (id, k, v) => setForm((f) => ({ ...f, plans: { ...f.plans, [id]: { ...f.plans[id], [k]: v } } }));
  const setTerm = (m, v) => setForm((f) => ({ ...f, terms: { ...f.terms, [m]: v } }));

  async function save() {
    setBusy('save');
    await act({ action: 'save_plans', plans: form.plans, terms: form.terms }, 'Paket disimpan. Langsung berlaku untuk semua toko.');
    setBusy('');
  }
  async function reset() {
    if (!window.confirm('Kembalikan semua paket, harga, kuota, dan diskon ke bawaan?')) return;
    setBusy('reset');
    const ok = await act({ action: 'reset_plans' }, 'Dikembalikan ke bawaan.');
    if (ok) setForm(fromCfg({ plans: cfg.defaults.plans, terms: cfg.defaults.terms }));
    setBusy('');
  }

  return (
    <>
      <div className="card">
        <h2>Paket dan harga</h2>
        <p className="hint">Ubah jumlah chat (balasan bot per bulan), harga per bulan, dan diskon. Perubahan langsung berlaku untuk semua toko, tanpa deploy ulang. Langganan yang sudah dibayar tidak berubah masa berlakunya, tetapi kuota chat mengikuti angka terbaru.</p>
      </div>

      {PLAN_ORDER.map((id) => {
        const p = form.plans[id];
        const free = id === 'free';
        return (
          <div className="card" key={id}>
            <div className="li" style={{ border: 0, padding: 0 }}>
              <div className="t"><b>{p.name || id}</b><small>{free ? 'Paket gratis: tanpa harga dan tanpa masa berlaku.' : 'Paket berbayar'}</small></div>
              {!free && Number(p.promo) > 0 ? <span className="tag a">{'Diskon ' + p.promo + '%'}</span> : null}
            </div>
            <div className="grid2" style={{ marginTop: 10 }}>
              <label style={{ display: 'grid', gap: 4, fontSize: 14 }}>
                <span>Nama paket</span>
                <input value={p.name} maxLength={30} onChange={(e) => setPlan(id, 'name', e.target.value)} />
              </label>
              <label style={{ display: 'grid', gap: 4, fontSize: 14 }}>
                <span>Jumlah chat per bulan</span>
                <input type="number" min="1" inputMode="numeric" value={p.quota} onChange={(e) => setPlan(id, 'quota', e.target.value)} />
              </label>
              {!free ? (
                <>
                  <label style={{ display: 'grid', gap: 4, fontSize: 14 }}>
                    <span>Harga per bulan (Rp)</span>
                    <input type="number" min="1000" inputMode="numeric" value={p.price} onChange={(e) => setPlan(id, 'price', e.target.value)} />
                  </label>
                  <label style={{ display: 'grid', gap: 4, fontSize: 14 }}>
                    <span>Diskon paket (%)</span>
                    <input type="number" min="0" max="90" inputMode="numeric" value={p.promo} onChange={(e) => setPlan(id, 'promo', e.target.value)} />
                  </label>
                </>
              ) : null}
            </div>
            {!free ? (
              <small className="hint" style={{ display: 'block', marginTop: 8 }}>
                {'Harga yang dibayar pelanggan: ' + TERM_ORDER.map((m) => m + ' bulan ' + rp(previewPrice(p, form.terms[m]) * Number(m))).join(' · ')}
              </small>
            ) : null}
          </div>
        );
      })}

      <div className="card">
        <h2>Diskon lama langganan</h2>
        <p className="hint">Potongan tambahan kalau pelanggan membayar beberapa bulan sekaligus. Ditumpuk dengan diskon paket di atas.</p>
        <div className="grid2">
          {TERM_ORDER.map((m) => (
            <label key={m} style={{ display: 'grid', gap: 4, fontSize: 14 }}>
              <span>{m + ' bulan (%)'}</span>
              <input type="number" min="0" max="90" inputMode="numeric" value={form.terms[m]} onChange={(e) => setTerm(m, e.target.value)} />
            </label>
          ))}
        </div>
        <div className="row">
          <button className="btn sm" type="button" disabled={!!busy} onClick={save}>
            <Busy on={busy === 'save'} label="Menyimpan...">Simpan perubahan</Busy>
          </button>
          <button className="btn ghost sm" type="button" disabled={!!busy} onClick={reset}>
            <Busy on={busy === 'reset'} label="Mengembalikan...">Kembalikan ke bawaan</Busy>
          </button>
        </div>
      </div>
    </>
  );
}

function Steps({ items }) {
  return <ol style={{ margin: '8px 0 0', paddingLeft: 20 }}>{items.map((x, i) => <li key={i} style={{ margin: '0 0 8px' }}>{x}</li>)}</ol>;
}
function Code({ children }) {
  return <code style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 6, padding: '1px 6px', wordBreak: 'break-all' }}>{children}</code>;
}

const GATEWAYS = {
  midtrans: {
    name: 'Midtrans', desc: 'Kartu, e-wallet, transfer bank, QRIS', path: '/api/midtrans',
    fields: [['server_key', 'Server Key', 'SB-Mid-server-...']],
    steps: (url) => [
      <>Buka <b>dashboard.midtrans.com</b> dan masuk. Untuk uji coba, ganti mode ke <b>Sandbox</b> (pojok kiri atas).</>,
      <>Masuk ke <b>Settings → Access Keys</b>, salin <b>Server Key</b>, lalu tempel di kolom di bawah.</>,
      <>Di <b>Settings → Configuration</b>, isi <b>Payment Notification URL</b> dengan <Code>{url}</Code>, lalu simpan.</>,
      <>Pilih lingkungan <b>Sandbox</b> di bawah (ganti ke <b>Production</b> hanya setelah akun lolos verifikasi dan Server Key diganti yang production), lalu klik <b>Simpan</b>.</>
    ]
  },
  doku: {
    name: 'DOKU', desc: 'DOKU Checkout (VA, e-wallet, QRIS, kartu)', path: '/api/doku',
    fields: [['client_id', 'Client ID', 'BRN-...'], ['secret_key', 'Secret Key', 'SK-...']],
    steps: (url) => [
      <>Buka <b>dashboard.doku.com</b> dan masuk. Pilih lingkungan <b>Sandbox</b> untuk uji coba.</>,
      <>Masuk ke <b>Integration → API Keys</b>, salin <b>Client ID</b> dan <b>Secret Key</b>, lalu tempel di kolom di bawah.</>,
      <>Di DOKU Back Office (<b>Settings → Payment Channels</b>), isi <b>Notification URL</b> dengan <Code>{url}</Code> untuk setiap channel yang dipakai.</>,
      <>Pilih lingkungan <b>Sandbox</b> atau <b>Production</b> sesuai key yang ditempel, lalu klik <b>Simpan</b>.</>
    ]
  }
};

function GatewayCard({ g, origin }) {
  const { act } = useAdmin();
  const meta = GATEWAYS[g.id];
  const [vals, setVals] = useState({});
  const [prod, setProd] = useState(g.production);
  const [busy, setBusy] = useState('');
  const url = (origin || 'https://DOMAINMU') + meta.path;
  const web = Object.values(g.fields).some((f) => f.source === 'web');

  async function run(key, body, msg) {
    setBusy(key);
    const ok = await act(Object.assign({ provider: g.id }, body), msg);
    setBusy('');
    if (ok) setVals({});
  }

  return (
    <div className="card">
      <div className="li" style={{ border: 0, padding: 0 }}>
        <div className="t"><b>{meta.name}</b><small>{meta.desc}</small></div>
        {g.ready ? <span className="tag a">{'Terhubung · ' + (g.production ? 'production' : 'sandbox')}</span> : <span className="tag w">Belum diisi</span>}
      </div>
      <Steps items={meta.steps(url)} />

      <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
        {meta.fields.map(([f, label, ph]) => {
          const cur = g.fields[f];
          return (
            <label key={f} style={{ display: 'grid', gap: 4, fontSize: 14 }}>
              <span>{label}{cur && cur.source ? <span className="hint">{' · tersimpan ' + cur.hint + (cur.source === 'env' ? ' (dari Vercel)' : '')}</span> : null}</span>
              <input type="password" autoComplete="off" spellCheck="false" value={vals[f] || ''}
                placeholder={cur && cur.source ? 'Kosongkan jika tidak diubah' : ph}
                onChange={(e) => setVals((v) => Object.assign({}, v, { [f]: e.target.value }))} />
            </label>
          );
        })}
        <label style={{ display: 'grid', gap: 4, fontSize: 14 }}>
          <span>Lingkungan</span>
          <select value={prod ? 'production' : 'sandbox'} onChange={(e) => setProd(e.target.value === 'production')}>
            <option value="sandbox">Sandbox (uji coba)</option>
            <option value="production">Production (uang asli)</option>
          </select>
        </label>
      </div>
      <div className="row">
        <button className="btn sm" type="button" disabled={!!busy}
          onClick={() => run('save', Object.assign({ action: 'save_gateway', production: prod }, vals), meta.name + ' disimpan.')}>
          <Busy on={busy === 'save'} label="Menyimpan...">Simpan</Busy>
        </button>
        {web ? (
          <button className="btn ghost sm" type="button" disabled={!!busy}
            onClick={() => run('clear', { action: 'clear_gateway' }, 'Isian ' + meta.name + ' dihapus.')}>
            <Busy on={busy === 'clear'} label="Menghapus...">Hapus isian</Busy>
          </button>
        ) : null}
      </div>
      <p className="hint">Key disimpan terenkripsi di server dan tidak pernah ditampilkan penuh lagi setelah disimpan.</p>
    </div>
  );
}

export function PengaturanView() {
  const { data } = useAdmin();
  const [origin, setOrigin] = useState('');
  useEffect(() => { setOrigin(window.location.origin); }, []);
  return (
    <>
      <div className="card">
        <h2>Pembayaran</h2>
        <p className="hint">Isi key pembayaran langsung di sini, tanpa deploy ulang. Pakai salah satu provider, atau keduanya: pemilik toko memilih metode saat membayar. Kalau key juga diisi di Vercel, isian dari halaman ini yang dipakai.</p>
      </div>
      {(data.gateways || []).map((g) => <GatewayCard key={g.id} g={g} origin={origin} />)}
      <div className="card">
        <h2>Cek hasilnya</h2>
        <Steps items={[
          <>Buka <b>Dashboard toko → Langganan</b> dengan akun pemilik toko, pilih paket, lalu bayar memakai akun uji coba (sandbox).</>,
          <>Kembali ke <Link href="/admin/pembayaran">Pembayaran</Link>: pembayaran muncul sebagai “Menunggu”, lalu berubah “Lunas” setelah notifikasi masuk.</>,
          <>Kalau tetap “Menunggu”, periksa lagi Notification URL di dashboard provider.</>
        ]} />
      </div>
    </>
  );
}

// Contoh nama model untuk saran saat mengetik. Admin boleh mengisi nama model apa pun yang tersedia di akun Gemini-nya.
const MODEL_HINTS = ['gemini-3.5-flash-lite', 'gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro'];

export function AiView() {
  const { data, act, post } = useAdmin();
  const ai = data.ai;
  const [key, setKey] = useState('');
  const [models, setModels] = useState(() => Object.fromEntries(data.plans.map((p) => [p.id, ai.models[p.id] || ''])));
  const [busy, setBusy] = useState('');
  const [tests, setTests] = useState({});

  const saved = (id) => ai.models[id] || '';
  const dirty = data.plans.some((p) => String(models[p.id] || '').trim() !== saved(p.id));
  const cur = ai.key;

  async function saveKey() {
    setBusy('key');
    const ok = await act({ action: 'save_ai_key', key }, 'API key Gemini disimpan.');
    setBusy('');
    if (ok) setKey('');
  }
  async function clearKey() {
    if (!window.confirm('Hapus API key dari halaman ini? Bot akan memakai GEMINI_API_KEY di Vercel kalau ada.')) return;
    setBusy('clear');
    await act({ action: 'clear_ai_key' }, 'Isian API key dihapus.');
    setBusy('');
  }
  async function saveModels() {
    setBusy('models');
    const ok = await act({ action: 'save_ai_models', models }, 'Model disimpan. Langsung berlaku untuk semua toko.');
    setBusy('');
    if (ok) setTests({});
  }
  async function test(id) {
    setBusy('test' + id);
    setTests((t) => ({ ...t, [id]: null }));
    try {
      const r = await post({ action: 'test_ai', plan: id });
      setTests((t) => ({ ...t, [id]: r.ok ? { ok: true, text: 'Berfungsi · ' + r.model + ' · ' + r.ms + ' ms' } : { ok: false, text: r.error || 'Gagal.' } }));
    } catch (e) {
      setTests((t) => ({ ...t, [id]: { ok: false, text: e.message || 'Gagal.' } }));
    }
    setBusy('');
  }

  return (
    <>
      <div className="card">
        <div className="li" style={{ border: 0, padding: 0 }}>
          <div className="t"><b>API key Gemini</b><small>Dipakai bot semua toko</small></div>
          {cur.source ? <span className="tag a">{'Terhubung · ' + cur.hint}</span> : <span className="tag w">Belum diisi</span>}
        </div>
        <p className="hint">Buat key di <b>aistudio.google.com/apikey</b>, lalu tempel di bawah. Tanpa deploy ulang. Kalau key juga diisi di Vercel (GEMINI_API_KEY), isian dari halaman ini yang dipakai.</p>
        <label style={{ display: 'grid', gap: 4, fontSize: 14, marginTop: 8 }}>
          <span>API key{cur.source ? <span className="hint">{' · tersimpan ' + cur.hint + (cur.source === 'env' ? ' (dari Vercel)' : '')}</span> : null}</span>
          <input type="password" autoComplete="off" spellCheck="false" value={key}
            placeholder={cur.source ? 'Kosongkan jika tidak diubah' : 'AIza...'} onChange={(e) => setKey(e.target.value)} />
        </label>
        <div className="row">
          <button className="btn sm" type="button" disabled={!!busy || !key.trim()} onClick={saveKey}>
            <Busy on={busy === 'key'} label="Menyimpan...">Simpan key</Busy>
          </button>
          {cur.source === 'web' ? (
            <button className="btn ghost sm" type="button" disabled={!!busy} onClick={clearKey}>
              <Busy on={busy === 'clear'} label="Menghapus...">Hapus isian</Busy>
            </button>
          ) : null}
        </div>
        <p className="hint">Key disimpan terenkripsi di server dan tidak pernah ditampilkan penuh lagi setelah disimpan.</p>
      </div>

      <div className="card">
        <h2>Model AI per paket</h2>
        <p className="hint">{'Pilih model yang dipakai bot untuk toko di tiap paket. Kosongkan untuk memakai model bawaan (' + ai.defaultModel + '). Perubahan langsung berlaku untuk semua toko. Nama model harus ada di akun Gemini-mu; cek daftar model di dokumentasi Google sebelum mengisi.'}</p>
        <datalist id="model-hints">{MODEL_HINTS.map((m) => <option key={m} value={m} />)}</datalist>
        {data.plans.map((p) => {
          const t = tests[p.id];
          return (
            <div key={p.id} style={{ borderTop: '1px solid var(--line)', padding: '12px 0' }}>
              <label style={{ display: 'grid', gap: 4, fontSize: 14 }}>
                <span><b>{p.name}</b><span className="hint">{' · ' + (models[p.id] ? '' : 'bawaan: ') + (String(models[p.id] || '').trim() || ai.defaultModel)}</span></span>
                <input list="model-hints" autoComplete="off" spellCheck="false" maxLength={60} value={models[p.id] || ''}
                  placeholder={ai.defaultModel} onChange={(e) => setModels((m) => ({ ...m, [p.id]: e.target.value }))} />
              </label>
              <div className="row">
                <button className="btn ghost sm" type="button" disabled={!!busy || dirty || !(cur.source)} onClick={() => test(p.id)}
                  title={dirty ? 'Simpan perubahan dulu' : undefined}>
                  <Busy on={busy === 'test' + p.id} label="Menguji...">Tes model</Busy>
                </button>
                {t ? <span className={t.ok ? 'hint' : 'err'} role={t.ok ? undefined : 'alert'}>{t.text}</span> : null}
              </div>
            </div>
          );
        })}
        <div className="row">
          <button className="btn sm" type="button" disabled={!!busy || !dirty} onClick={saveModels}>
            <Busy on={busy === 'models'} label="Menyimpan...">Simpan model</Busy>
          </button>
          <button className="btn ghost sm" type="button" disabled={!!busy}
            onClick={() => setModels(Object.fromEntries(data.plans.map((p) => [p.id, ''])))}>Pakai bawaan semua</button>
        </div>
        <p className="hint">Paket tiap toko mengikuti langganannya: toko tanpa langganan aktif memakai model paket Gratis. Tombol “Tes model” menguji model yang sudah tersimpan.</p>
      </div>
    </>
  );
}
