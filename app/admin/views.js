'use client';
/* Isi halaman-halaman admin layanan. Data & aksi datang dari AdminShell lewat context. */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Busy, rp, dayTime } from '../dashboard/helpers';
import { SkForm } from '../components/Skeleton';
import { Panduan } from '../components/Panduan';
import { useConfirm } from '../components/useConfirm';
import { useAdmin } from './context';

const dateOnly = (iso) => (iso ? new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-');
const STATUS = { paid: 'Lunas', pending: 'Menunggu', failed: 'Gagal', expired: 'Kedaluwarsa' };
const PROVIDER = { midtrans: 'Midtrans', doku: 'DOKU' };
const num = (n) => Number(n || 0).toLocaleString('id-ID');

function Stat({ label, value, note }) {
  return (
    <div className="stat">
      <span className="hint">{label}</span>
      <b>{value}</b>
      <small>{note}</small>
    </div>
  );
}

function Empty({ title, children }) {
  return (
    <div className="empty">
      <b>{title}</b>
      {children ? <p>{children}</p> : null}
    </div>
  );
}

function Chevron({ up }) {
  return <svg className={'chev' + (up ? ' up' : '')} viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function usePlanName() {
  const { data } = useAdmin();
  return (id) => { const p = data.plans.find((x) => x.id === id); return p ? p.name : id; };
}

function PaymentRows({ payments }) {
  const planName = usePlanName();
  if (!payments.length) return <Empty title="Belum ada pembayaran">Pembayaran muncul di sini setelah pemilik toko berlangganan.</Empty>;
  return (
    <div>
      {payments.map((p) => (
        <div className="li pay" key={p.order_id}>
          <div className="t stack">
            <b>{p.shop_name || 'Toko'}</b>
            <small>{planName(p.plan) + ' · ' + p.months + ' bulan · ' + (PROVIDER[p.provider] || p.provider || '-') + ' · ' + dayTime(p.created_at)}</small>
          </div>
          <span className="amt">{rp(p.amount)}</span>
          <span className={'tag' + (p.status === 'paid' ? ' a' : p.status === 'pending' ? '' : ' w')}>{STATUS[p.status] || p.status}</span>
        </div>
      ))}
    </div>
  );
}

const ownerLine = (s) => (s.owner || 'Pemilik tidak diketahui') + ' · /chat/' + s.slug;

function ShopTags({ s }) {
  return (
    <>
      {!s.bot_on ? <span className="tag w">Bot mati</span> : null}
      <span className={'tag' + (s.plan !== 'free' ? ' a' : '')}>{s.plan_name}</span>
    </>
  );
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
      <div className="stats s4">
        <Stat label="Total toko" value={num(t.shops)} note={t.paidShops + ' berlangganan aktif'} />
        <Stat label="Pendapatan bulan ini" value={rp(t.revenueMonth)} note="dari pembayaran lunas" />
        <Stat label="Balasan AI bulan ini" value={num(t.botRepliesMonth)} note="semua toko" />
        <Stat label="Total percakapan" value={num(t.conversations)} note="sejak awal" />
      </div>

      <section className="card">
        <div className="chead">
          <div><h2>Toko terbaru</h2><p className="hint">Lima toko yang paling baru mendaftar.</p></div>
          {data.shops.length ? <Link className="btn ghost sm" href="/admin/toko">Lihat semua</Link> : null}
        </div>
        {!data.shops.length ? <Empty title="Belum ada toko">Toko muncul di sini setelah ada yang mendaftar.</Empty> : (
          <div className="rows">
            {data.shops.slice(0, 5).map((s) => (
              <div className="srow" key={s.id}>
                <div className="srow-h">
                  <div className="t"><b>{s.name}</b><small>{ownerLine(s)}</small></div>
                  <ShopTags s={s} />
                </div>
                <ShopUsage s={s} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <div className="chead">
          <div><h2>Pembayaran terbaru</h2><p className="hint">Lima transaksi terakhir dari semua toko.</p></div>
          {data.payments.length ? <Link className="btn ghost sm" href="/admin/pembayaran">Lihat semua</Link> : null}
        </div>
        <PaymentRows payments={data.payments.slice(0, 5)} />
      </section>
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
    <section className="card">
      <div className="toolbar">
        <input type="search" placeholder="Cari nama toko, alamat chat, atau email pemilik" aria-label="Cari toko" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="hint">{shops.length + ' toko'}</span>
      </div>
      {data.totals.capped ? <p className="hint note">{'Menampilkan 200 toko terbaru dari ' + data.totals.shops + '.'}</p> : null}

      <div className="rows">
        {!shops.length ? <Empty title="Tidak ada toko yang cocok">Coba nama toko, alamat chat, atau email pemilik yang lain.</Empty> : null}
        {shops.map((s) => {
          const open = openId === s.id;
          return (
            <div className="srow" key={s.id}>
              <button type="button" className="srow-h srow-btn" aria-expanded={open}
                onClick={() => { setOpenId(open ? null : s.id); setDelText(''); }}>
                <span className="t"><b>{s.name}</b><small>{ownerLine(s)}</small></span>
                <ShopTags s={s} />
                <Chevron up={open} />
              </button>
              <ShopUsage s={s} />

              {open ? (
                <div className="detail">
                  <h3>Ubah paket manual</h3>
                  <p className="hint">Untuk klien yang bayar lewat transfer. Masa berlaku dihitung mulai hari ini.</p>
                  <div className="fgrid">
                    <label>
                      <span className="flabel">Paket</span>
                      <select value={plan} onChange={(e) => setPlan(e.target.value)}>
                        {data.plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </label>
                    <label>
                      <span className="flabel">Lama (hari)</span>
                      <input type="number" min="1" max="3650" inputMode="numeric" value={days} disabled={plan === 'free'} onChange={(e) => setDays(e.target.value)} />
                    </label>
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

                  <div className="danger-zone">
                    <h3>Hapus toko</h3>
                    <p className="hint">{'Menghapus permanen toko ini beserta produk, FAQ, percakapan, tim, saluran, dan riwayat pembayarannya. Tidak bisa dibatalkan.'}</p>
                    <div className="fgrid one">
                      <label>
                        <span className="flabel">{'Ketik ' + s.slug + ' untuk konfirmasi'}</span>
                        <input autoComplete="off" spellCheck="false" value={delText} onChange={(e) => setDelText(e.target.value)} />
                      </label>
                    </div>
                    <div className="row">
                      <button className="btn danger solid sm" type="button" disabled={!!busy || delText.trim() !== s.slug}
                        onClick={async () => { if (await run('del' + s.id, { action: 'delete_shop', shopId: s.id, confirm: delText.trim() }, 'Toko dihapus.')) { setOpenId(null); setDelText(''); } }}>
                        <Busy on={busy === 'del' + s.id} label="Menghapus...">Hapus permanen</Busy>
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
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
      <div className="stats s4">
        <Stat label="Total pengguna" value={num(r.stats.total)} note="akun yang mendaftar" />
        <Stat label="Daftar 7 hari terakhir" value={num(r.stats.new7)} note="pengguna baru" />
        <Stat label="Aktif 30 hari terakhir" value={num(r.stats.active30)} note="pernah login" />
        <Stat label="Belum punya toko" value={num(r.stats.noShop)} note="belum membuat toko" />
      </div>

      <section className="card">
        <div className="toolbar">
          <input type="search" placeholder="Cari email atau nama toko" aria-label="Cari pengguna" value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="hint">{num(r.matched) + ' akun'}</span>
        </div>
        {st.error ? <p className="err" role="alert">{st.error}</p> : null}
        {r.stats.capped ? <p className="hint note">{'Hanya sebagian akun yang dibaca dari total ' + num(r.stats.total) + '. Pakai kolom cari untuk akun tertentu.'}</p> : null}
        {r.matched > r.users.length ? <p className="hint note">{'Menampilkan ' + r.users.length + ' dari ' + num(r.matched) + ' hasil. Persempit pencarian untuk melihat yang lain.'}</p> : null}

        {!r.users.length ? <Empty title="Tidak ada pengguna yang cocok">Coba email atau nama toko yang lain.</Empty> : (
          <div>
            {r.users.map((u) => (
              <div className="li urow" key={u.id}>
                <span className="av" aria-hidden="true">{String(u.email || '?').charAt(0).toUpperCase()}</span>
                <div className="t stack">
                  <b>{u.email || '(tanpa email)'}</b>
                  <small>{'Daftar ' + dateOnly(u.created_at) + ' · login terakhir ' + (u.last_sign_in_at ? dayTime(u.last_sign_in_at) : 'belum pernah') + ' · ' + u.provider}</small>
                  {u.shops.length ? (
                    <span className="chips">
                      {u.shops.map((s, i) => <span className="tag" key={i}>{s.name + ' · ' + (s.role === 'owner' ? 'Pemilik' : 'Admin')}</span>)}
                    </span>
                  ) : null}
                </div>
                <span className="utags">
                  {!u.confirmed ? <span className="tag w">Belum konfirmasi</span> : null}
                  {!u.shops.length ? <span className="tag w">Tanpa toko</span> : null}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export function PembayaranView() {
  const { data } = useAdmin();
  const list = data.payments;
  const paid = list.filter((p) => p.status === 'paid');
  const pending = list.filter((p) => p.status === 'pending');
  const failed = list.filter((p) => p.status === 'failed' || p.status === 'expired');
  const sum = paid.reduce((a, p) => a + Number(p.amount || 0), 0);
  return (
    <>
      <div className="stats">
        <Stat label="Lunas" value={rp(sum)} note={paid.length + ' pembayaran'} />
        <Stat label="Menunggu" value={num(pending.length)} note="belum dibayar" />
        <Stat label="Gagal atau kedaluwarsa" value={num(failed.length)} note="tidak berhasil" />
      </div>
      <section className="card">
        <div className="chead">
          <div><h2>Riwayat pembayaran</h2><p className="hint">{'Menampilkan ' + list.length + ' pembayaran terbaru dari semua toko. Angka di atas dihitung dari daftar ini.'}</p></div>
        </div>
        <PaymentRows payments={list} />
      </section>
    </>
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
  const [ask, confirmNode] = useConfirm();
  const setPlan = (id, k, v) => setForm((f) => ({ ...f, plans: { ...f.plans, [id]: { ...f.plans[id], [k]: v } } }));
  const setTerm = (m, v) => setForm((f) => ({ ...f, terms: { ...f.terms, [m]: v } }));

  async function save() {
    setBusy('save');
    await act({ action: 'save_plans', plans: form.plans, terms: form.terms }, 'Paket disimpan. Langsung berlaku untuk semua toko.');
    setBusy('');
  }
  async function reset() {
    if (!(await ask({ title: 'Kembalikan ke bawaan?', message: 'Semua paket, harga, kuota, dan diskon akan dikembalikan ke nilai bawaan.', okLabel: 'Kembalikan' }))) return;
    setBusy('reset');
    const ok = await act({ action: 'reset_plans' }, 'Dikembalikan ke bawaan.');
    if (ok) setForm(fromCfg({ plans: cfg.defaults.plans, terms: cfg.defaults.terms }));
    setBusy('');
  }

  return (
    <>
      <p className="lead">Ubah jumlah chat (balasan AI per bulan), harga per bulan, dan diskon. Perubahan langsung berlaku untuk semua toko, tanpa deploy ulang. Langganan yang sudah dibayar tidak berubah masa berlakunya, tetapi kuota chat mengikuti angka terbaru.</p>

      <h2 className="sect">Paket dan harga</h2>
      {PLAN_ORDER.map((id) => {
        const p = form.plans[id];
        const free = id === 'free';
        return (
          <section className="card plan" key={id}>
            <div className="chead">
              <div>
                <h2>{p.name || id}</h2>
                <p className="hint">{free ? 'Paket gratis: tanpa harga dan tanpa masa berlaku.' : 'Paket berbayar'}</p>
              </div>
              {!free && Number(p.promo) > 0 ? <span className="tag a">{'Diskon ' + p.promo + '%'}</span> : null}
            </div>
            <div className="fgrid">
              <label>
                <span className="flabel">Nama paket</span>
                <input value={p.name} maxLength={30} onChange={(e) => setPlan(id, 'name', e.target.value)} />
              </label>
              <label>
                <span className="flabel">Jumlah chat per bulan</span>
                <input type="number" min="1" inputMode="numeric" value={p.quota} onChange={(e) => setPlan(id, 'quota', e.target.value)} />
              </label>
              {!free ? (
                <>
                  <label>
                    <span className="flabel">Harga per bulan (Rp)</span>
                    <input type="number" min="1000" inputMode="numeric" value={p.price} onChange={(e) => setPlan(id, 'price', e.target.value)} />
                  </label>
                  <label>
                    <span className="flabel">Diskon paket (%)</span>
                    <input type="number" min="0" max="90" inputMode="numeric" value={p.promo} onChange={(e) => setPlan(id, 'promo', e.target.value)} />
                  </label>
                </>
              ) : null}
            </div>
            {!free ? (
              <p className="hint">
                {'Harga yang dibayar pelanggan: ' + TERM_ORDER.map((m) => m + ' bulan ' + rp(previewPrice(p, form.terms[m]) * Number(m))).join(' · ')}
              </p>
            ) : null}
          </section>
        );
      })}

      <h2 className="sect">Diskon lama langganan</h2>
      <section className="card">
        <p className="hint" style={{ marginTop: 0 }}>Potongan tambahan kalau pelanggan membayar beberapa bulan sekaligus. Ditumpuk dengan diskon paket di atas.</p>
        <div className="fgrid">
          {TERM_ORDER.map((m) => (
            <label key={m}>
              <span className="flabel">{m + ' bulan (%)'}</span>
              <input type="number" min="0" max="90" inputMode="numeric" value={form.terms[m]} onChange={(e) => setTerm(m, e.target.value)} />
            </label>
          ))}
        </div>
      </section>

      <div className="row savebar">
        <button className="btn sm" type="button" disabled={!!busy} onClick={save}>
          <Busy on={busy === 'save'} label="Menyimpan...">Simpan perubahan</Busy>
        </button>
        <button className="btn ghost sm" type="button" disabled={!!busy} onClick={reset}>
          <Busy on={busy === 'reset'} label="Mengembalikan...">Kembalikan ke bawaan</Busy>
        </button>
      </div>
      {confirmNode}
    </>
  );
}

function Steps({ items }) {
  return <ol className="olist">{items.map((x, i) => <li key={i}>{x}</li>)}</ol>;
}
function Code({ children }) {
  return <code className="code">{children}</code>;
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
    <section className="card">
      <div className="chead">
        <div><h2>{meta.name}</h2><p className="hint">{meta.desc}</p></div>
        {g.ready ? <span className="tag a">{'Terhubung · ' + (g.production ? 'Production' : 'Sandbox')}</span> : <span className="tag w">Belum diisi</span>}
      </div>

      <Panduan title={'Cara menghubungkan ' + meta.name}>
        <Steps items={meta.steps(url)} />
      </Panduan>

      <div className="fgrid one">
        {meta.fields.map(([f, label, ph]) => {
          const cur = g.fields[f];
          return (
            <label key={f}>
              <span className="flabel">{label}{cur && cur.source ? <span className="hint">{' · tersimpan ' + cur.hint + (cur.source === 'env' ? ' (dari Vercel)' : '')}</span> : null}</span>
              <input type="password" autoComplete="off" spellCheck="false" value={vals[f] || ''}
                placeholder={cur && cur.source ? 'Kosongkan jika tidak diubah' : ph}
                onChange={(e) => setVals((v) => Object.assign({}, v, { [f]: e.target.value }))} />
            </label>
          );
        })}
        <label>
          <span className="flabel">Lingkungan</span>
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
      <p className="hint note">Key disimpan terenkripsi di server dan tidak pernah ditampilkan penuh lagi setelah disimpan.</p>
    </section>
  );
}

export function PengaturanView() {
  const { data } = useAdmin();
  const [origin, setOrigin] = useState('');
  useEffect(() => { setOrigin(window.location.origin); }, []);
  return (
    <>
      <p className="lead">Isi key pembayaran langsung di sini, tanpa deploy ulang. Pakai salah satu penyedia, atau keduanya: pemilik toko memilih metode saat membayar. Kalau key juga diisi di Vercel, isian dari halaman ini yang dipakai.</p>

      <h2 className="sect">Penyedia pembayaran</h2>
      {(data.gateways || []).map((g) => <GatewayCard key={g.id} g={g} origin={origin} />)}

      <h2 className="sect">Uji coba</h2>
      <section className="card">
        <div className="chead">
          <div><h2>Cek hasilnya</h2><p className="hint">Pastikan pembayaran sandbox tercatat di halaman Pembayaran.</p></div>
        </div>
        <Steps items={[
          <>Buka <b>Dashboard toko → Langganan</b> dengan akun pemilik toko, pilih paket, lalu bayar memakai akun uji coba (sandbox).</>,
          <>Kembali ke <Link href="/admin/pembayaran">Pembayaran</Link>: pembayaran muncul sebagai “Menunggu”, lalu berubah “Lunas” setelah notifikasi masuk.</>,
          <>Kalau tetap “Menunggu”, periksa lagi Notification URL di dashboard penyedia.</>
        ]} />
      </section>
    </>
  );
}

// Contoh nama model untuk saran saat mengetik. Admin boleh mengisi nama model apa pun yang tersedia di akun Gemini-nya.
const MODEL_HINTS = ['gemini-3.5-flash-lite', 'gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro'];

// Otak EMAHAIRSHOP: aturan perilaku + info perusahaan yang dipakai asisten untuk toko milik email di ADMIN_EMAILS.
// Teksnya hanya ada di server; halaman ini (khusus super admin) satu-satunya tempat melihat dan mengubahnya.
function OtakCard() {
  const { data, act } = useAdmin();
  const o = data.ai.otak;
  const [text, setText] = useState(o ? o.text : '');
  const [busy, setBusy] = useState('');
  const serverText = o ? o.text : '';
  useEffect(() => { setText(serverText); }, [serverText]);
  if (!o) return null;
  const dirty = text.trim() !== serverText.trim();
  async function run(tag, body, okMsg) {
    setBusy(tag);
    await act(body, okMsg);
    setBusy('');
  }
  return (
    <section className="card">
      <div className="chead">
        <div>
          <h2>Otak EMAHAIRSHOP</h2>
          <p className="hint">Aturan dan info perusahaan yang dipakai asisten untuk toko milik email di ADMIN_EMAILS. Toko lain tetap memakai data tokonya sendiri. Teks ini tidak pernah tampil di dashboard toko.</p>
        </div>
        {!o.adminEmails ? <span className="tag w">ADMIN_EMAILS kosong</span>
          : o.on ? <span className="tag a">Aktif</span> : <span className="tag w">Dimatikan</span>}
      </div>
      {!o.adminEmails ? <p className="hint" role="alert">ADMIN_EMAILS belum diatur di Vercel, jadi otak ini belum dipakai di toko mana pun.</p> : null}
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--ink)', fontSize: 15, margin: '4px 0 12px' }}>
        <input type="checkbox" style={{ width: 'auto' }} checked={o.on} disabled={!!busy}
          onChange={(e) => run('mode', { action: 'set_otak_mode', on: e.target.checked }, e.target.checked ? 'Otak diaktifkan.' : 'Otak dimatikan; toko kembali memakai data tokonya.')} />
        Pakai otak ini (kalau mati, semua toko memakai data toko biasa)
      </label>
      <div className="fgrid one">
        <label>
          <span className="flabel">{'Teks otak · ' + (o.custom ? 'buatan admin' : 'bawaan') + ' · ' + text.length + ' / ' + o.max + ' karakter'}</span>
          <textarea rows={18} spellCheck="false" value={text} onChange={(e) => setText(e.target.value)}
            style={{ fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 13, lineHeight: 1.5, minHeight: 280 }} />
        </label>
      </div>
      <p className="hint">Penanda internal ([[WA]], [[HUMAN]], [[URGENT]], [[FRAUD]], [[UNKNOWN]], [[LEAD]], [[NAME]], [[OFFTOPIC]]) diurai otomatis dan dibuang sebelum balasan dilihat pelanggan. Jangan menghapus aturannya kecuali kamu paham akibatnya. Perubahan berlaku dalam sekitar 15 detik.</p>
      <div className="row">
        <button className="btn sm" type="button" disabled={!!busy || !dirty} onClick={() => run('save', { action: 'save_otak', text }, 'Teks otak disimpan.')}>
          <Busy on={busy === 'save'} label="Menyimpan...">Simpan</Busy>
        </button>
        <button className="btn ghost sm" type="button" disabled={!!busy || !o.hasPrev}
          onClick={() => { if (window.confirm('Kembalikan teks otak ke versi sebelum perubahan terakhir? Versi sekarang jadi cadangan.')) run('restore', { action: 'restore_otak' }, 'Versi sebelumnya dikembalikan.'); }}>
          <Busy on={busy === 'restore'} label="Mengembalikan...">Batalkan perubahan terakhir</Busy>
        </button>
        <button className="btn ghost sm" type="button" disabled={!!busy || !o.custom}
          onClick={() => { if (window.confirm('Buang teks buatan sendiri dan kembali ke teks bawaan (' + o.defaultLength + ' karakter)? Teks sekarang tersimpan sebagai cadangan.')) run('reset', { action: 'reset_otak' }, 'Kembali ke teks bawaan.'); }}>
          <Busy on={busy === 'reset'} label="Mengembalikan...">Kembalikan ke bawaan</Busy>
        </button>
      </div>
    </section>
  );
}

export function AiView() {
  const { data, act, post } = useAdmin();
  const ai = data.ai;
  const def = ai.key;                                   // key bawaan
  const planKeys = ai.planKeys || {};                   // { paket: [meta key 1, 2, 3] }
  const perPlan = ai.perPlan || 3;
  const slots = Array.from({ length: perPlan }, (_, i) => i + 1);
  const [defKey, setDefKey] = useState('');
  const [keys, setKeys] = useState({});                 // isian key baru: { 'paket:slot': '...' } (belum disimpan)
  const [models, setModels] = useState(() => Object.fromEntries(data.plans.map((p) => [p.id, ai.models[p.id] || ''])));
  const providerList = ai.providerList || [{ id: 'gemini', label: 'Gemini (Google)', keyHint: 'AIza...', defaultModel: ai.defaultModel }];
  const provOf = (id, src) => (src[id] && providerList.some((x) => x.id === src[id]) ? src[id] : 'gemini');
  const [provs, setProvs] = useState(() => Object.fromEntries(data.plans.map((p) => [p.id, provOf(p.id, ai.providers || {})])));
  const [busy, setBusy] = useState('');
  const [tests, setTests] = useState({});               // hasil tes: { 'paket': ..., 'paket:slot': ... }

  const savedModel = (id) => ai.models[id] || '';
  const savedProv = (id) => provOf(id, ai.providers || {});
  const infoOf = (id) => providerList.find((x) => x.id === provs[id]) || providerList[0];
  const metaOf = (id, n) => (planKeys[id] && planKeys[id][n - 1]) || { source: null, hint: '' };
  const countOf = (id) => slots.filter((n) => metaOf(id, n).source).length;
  const totalOwn = data.plans.reduce((a, p) => a + countOf(p.id), 0);
  const typedOf = (id) => Object.fromEntries(slots.map((n) => [n, String(keys[id + ':' + n] || '').trim()]).filter(([, v]) => v));

  async function run(tag, body, okMsg) {
    setBusy(tag);
    const ok = await act(body, okMsg);
    setBusy('');
    return ok;
  }
  async function saveDefault() {
    if (await run('def', { action: 'save_ai_key', key: defKey }, 'Key bawaan disimpan.')) setDefKey('');
  }
  async function clearDefault() {
    if (!window.confirm('Hapus key bawaan? Paket yang belum punya key sendiri akan memakai GEMINI_API_KEY di Vercel kalau ada.')) return;
    await run('defclear', { action: 'clear_ai_key' }, 'Key bawaan dihapus.');
  }
  async function savePlan(p) {
    const typed = typedOf(p.id);
    const modelChanged = String(models[p.id] || '').trim() !== savedModel(p.id) || provs[p.id] !== savedProv(p.id);
    if (Object.keys(typed).length) {
      const ok = await run('save' + p.id, { action: 'save_ai_key', plan: p.id, keys: typed }, 'Key paket ' + p.name + ' disimpan.');
      if (!ok) return;
      setKeys((k) => { const n = { ...k }; slots.forEach((i) => { delete n[p.id + ':' + i]; }); return n; });
    }
    if (modelChanged) {
      const next = { ...Object.fromEntries(data.plans.map((q) => [q.id, savedModel(q.id)])), [p.id]: models[p.id] || '' };
      const nextProv = { ...Object.fromEntries(data.plans.map((q) => [q.id, savedProv(q.id)])), [p.id]: provs[p.id] };
      await run('save' + p.id, { action: 'save_ai_models', models: next, providers: nextProv }, 'Penyedia dan model paket ' + p.name + ' disimpan.');
    }
    setTests((t) => ({ ...t, [p.id]: undefined }));
  }
  async function clearSlot(p, n) {
    if (!window.confirm('Hapus key ' + n + ' paket ' + p.name + '?' + (countOf(p.id) === 1 ? ' Ini key terakhir, paket akan memakai key bawaan.' : ''))) return;
    await run('clear' + p.id + n, { action: 'clear_ai_key', plan: p.id, slot: n }, 'Key ' + n + ' paket ' + p.name + ' dihapus.');
    setTests((t) => ({ ...t, [p.id]: undefined, [p.id + ':' + n]: undefined }));
  }
  // slot kosong = tes paket (key dipakai bergantian seperti saat bot membalas); slot terisi = tes satu key saja.
  async function test(id, slot) {
    const tag = slot ? id + ':' + slot : id;
    setBusy('test' + tag);
    setTests((t) => ({ ...t, [tag]: null }));
    try {
      const r = await post({ action: 'test_ai', plan: id, slot: slot || undefined });
      const via = r.keySource === 'plan' ? (slot ? 'key ' + slot : 'key paket') : 'key bawaan';
      const pl = (providerList.find((x) => x.id === r.provider) || {}).label || '';
      setTests((t) => ({ ...t, [tag]: r.ok ? { ok: true, text: 'Berfungsi · ' + (pl ? pl + ' · ' : '') + r.model + ' · ' + via + ' · ' + r.ms + ' ms' } : { ok: false, text: r.error || 'Gagal.' } }));
    } catch (e) {
      setTests((t) => ({ ...t, [tag]: { ok: false, text: e.message || 'Gagal.' } }));
    }
    setBusy('');
  }

  return (
    <>
      <p className="lead">{'Atur penyedia AI, API key, dan model untuk tiap paket (bawaan Gemini; paket Gratis bisa memakai penyedia gratis lain seperti Groq). Setiap paket boleh punya sampai ' + perPlan + ' key sendiri: asisten memakainya bergantian supaya beban terbagi, dan kalau satu key kena limit atau error, otomatis pindah ke key berikutnya. Paket Gemini tanpa key sendiri memakai key bawaan; penyedia lain wajib punya key sendiri. Perubahan langsung berlaku tanpa deploy ulang.'}</p>

      <div className="stats">
        <div className="stat"><span className="hint">Key bawaan</span><b>{def.source ? 'Aktif' : 'Kosong'}</b><small>{def.source ? '••••' + String(def.hint || '').slice(-4) + (def.source === 'env' ? ' · dari Vercel' : '') : 'Belum diisi'}</small></div>
        <div className="stat"><span className="hint">Key khusus paket</span><b>{totalOwn} / {data.plans.length * perPlan}</b><small>{totalOwn ? 'Paket tanpa key ikut key bawaan' : 'Semua paket ikut key bawaan'}</small></div>
        <div className="stat"><span className="hint">Model bawaan</span><b className="mono">{ai.defaultModel}</b><small>Untuk paket tanpa model sendiri</small></div>
      </div>

      <h2 className="sect">Otak asisten</h2>
      <OtakCard />

      <h2 className="sect">Key dan model per paket</h2>
      <datalist id="model-hints">{MODEL_HINTS.map((m) => <option key={m} value={m} />)}</datalist>
      {data.plans.map((p) => {
        const n = countOf(p.id);
        const info = infoOf(p.id);
        const isGemini = info.id === 'gemini';
        const baseModel = info.defaultModel || '';
        const effective = n > 0 || (isGemini && !!def.source);
        const typed = Object.keys(typedOf(p.id)).length;
        const modelDirty = String(models[p.id] || '').trim() !== savedModel(p.id) || provs[p.id] !== savedProv(p.id);
        const dirty = typed > 0 || modelDirty;
        const t = tests[p.id];
        const me = (models[p.id] || '').trim();
        return (
          <section className="card plan" key={p.id}>
            <div className="chead">
              <div>
                <h2>{'Paket ' + p.name}</h2>
                <p className="hint">{info.label + ' · Model: ' + (me || baseModel || 'belum diisi') + (me || !baseModel ? '' : ' (bawaan)') + ' · Key: ' + (n ? n + ' key sendiri' : (isGemini && def.source) ? 'ikut bawaan' : 'belum ada')}</p>
              </div>
              {n ? <span className="tag a">{n + ' / ' + perPlan + ' key'}</span>
                : (isGemini && def.source) ? <span className="tag">Ikut key bawaan</span>
                : <span className="tag w">Belum ada key</span>}
            </div>

            <div className="keylist">
              {slots.map((i) => {
                const m = metaOf(p.id, i);
                const has = !!m.source;
                const st = tests[p.id + ':' + i];
                return (
                  <div className="keyslot" key={i}>
                    <span className="flabel">{'Key ' + i}{has ? <span className="hint">{' · tersimpan ' + m.hint + (m.source === 'env' ? ' (dari Vercel)' : '')}</span> : null}</span>
                    <div className="keyrow">
                      <input type="password" autoComplete="off" spellCheck="false" aria-label={'API key ' + i + ' paket ' + p.name}
                        value={keys[p.id + ':' + i] || ''}
                        placeholder={has ? 'Kosongkan jika tidak diubah' : (info.keyHint || 'API key') + ' (boleh dikosongkan)'}
                        onChange={(e) => setKeys((k) => ({ ...k, [p.id + ':' + i]: e.target.value }))} />
                      {has ? (
                        <>
                          <button className="btn ghost sm" type="button" disabled={!!busy || dirty} onClick={() => test(p.id, i)} title={dirty ? 'Simpan perubahan dulu' : undefined}>
                            <Busy on={busy === 'test' + p.id + ':' + i} label="Menguji...">Tes</Busy>
                          </button>
                          {m.source === 'web' ? (
                            <button className="btn ghost sm" type="button" disabled={!!busy} onClick={() => clearSlot(p, i)}>
                              <Busy on={busy === 'clear' + p.id + i} label="Menghapus...">Hapus</Busy>
                            </button>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                    {st ? <span className={'test ' + (st.ok ? 'ok' : 'bad')} role={st.ok ? undefined : 'alert'}>{st.text}</span> : null}
                  </div>
                );
              })}
            </div>

            <div className="fgrid one">
              <label>
                <span className="flabel">Penyedia AI</span>
                <select value={provs[p.id]} onChange={(e) => setProvs((m) => ({ ...m, [p.id]: e.target.value }))}>
                  {providerList.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                </select>
                {!isGemini ? <span className="hint">{'Key dari penyedia ini wajib diisi di atas (key bawaan Gemini tidak dipakai). Kosongkan Model untuk memakai model bawaan penyedia' + (baseModel ? '' : ', tapi OpenRouter tidak punya bawaan: isi nama model, contoh meta-llama/llama-3.3-70b-instruct:free') + '. Nama model dan batas gratis bisa berubah, cek di situs penyedia.'}</span> : null}
              </label>
              <label>
                <span className="flabel">Model</span>
                <input list={isGemini ? 'model-hints' : undefined} autoComplete="off" spellCheck="false" maxLength={60} value={models[p.id] || ''}
                  placeholder={baseModel || 'nama model'} onChange={(e) => setModels((m) => ({ ...m, [p.id]: e.target.value }))} />
              </label>
            </div>

            <div className="row">
              <button className="btn sm" type="button" disabled={!!busy || !dirty} onClick={() => savePlan(p)}>
                <Busy on={busy === 'save' + p.id} label="Menyimpan...">Simpan</Busy>
              </button>
              <button className="btn ghost sm" type="button" disabled={!!busy || dirty || !effective} onClick={() => test(p.id)}
                title={dirty ? 'Simpan perubahan dulu' : !effective ? 'Isi key dulu' : undefined}>
                <Busy on={busy === 'test' + p.id} label="Menguji...">Tes paket</Busy>
              </button>
              {t ? <span className={'test ' + (t.ok ? 'ok' : 'bad')} role={t.ok ? undefined : 'alert'}>{t.text}</span> : null}
            </div>
          </section>
        );
      })}

      <h2 className="sect">Key bawaan</h2>
      <section className="card">
        <div className="chead">
          <div><h2>Key bawaan</h2><p className="hint">Cadangan untuk paket yang belum punya key sendiri. Buat key di <b>aistudio.google.com/apikey</b>.</p></div>
          {def.source ? <span className="tag a">{'Terhubung · ' + def.hint}</span> : <span className="tag w">Belum diisi</span>}
        </div>
        <div className="fgrid one">
          <label>
            <span className="flabel">API key{def.source ? <span className="hint">{' · tersimpan ' + def.hint + (def.source === 'env' ? ' (dari Vercel)' : '')}</span> : null}</span>
            <input type="password" autoComplete="off" spellCheck="false" value={defKey}
              placeholder={def.source ? 'Kosongkan jika tidak diubah' : 'AIza...'} onChange={(e) => setDefKey(e.target.value)} />
          </label>
        </div>
        <div className="row">
          <button className="btn sm" type="button" disabled={!!busy || !defKey.trim()} onClick={saveDefault}>
            <Busy on={busy === 'def'} label="Menyimpan...">Simpan key</Busy>
          </button>
          {def.source === 'web' ? (
            <button className="btn ghost sm" type="button" disabled={!!busy} onClick={clearDefault}>
              <Busy on={busy === 'defclear'} label="Menghapus...">Hapus isian</Busy>
            </button>
          ) : null}
        </div>
      </section>

      <p className="hint">Key disimpan terenkripsi di server dan tidak pernah ditampilkan penuh lagi setelah disimpan. Toko tanpa langganan aktif memakai paket Gratis. Nama model harus tersedia di akun penyedianya. Pakai tier gratis berarti kena batas laju penyedia, dan sebagian penyedia membatasi pemakaian komersial atau memakai data untuk pelatihan, jadi baca ketentuannya. Tombol “Tes” menguji pengaturan yang sudah tersimpan.</p>
    </>
  );
}
