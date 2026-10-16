'use client';
import { useState } from 'react';
import { Busy, Field, authFetch } from './helpers';

export default function TokoTab({ sb, shop, onShopChange, onShopDeleted, fail, toast }) {
  const [f, setF] = useState({
    name: shop.name, hours: shop.hours, address: shop.address, shipping: shop.shipping, payment: shop.payment,
    about: shop.about || '', ai_notes: shop.ai_notes || ''
  });
  const [busy, setBusy] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [delName, setDelName] = useState('');
  const [delBusy, setDelBusy] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function save() {
    if (!f.name.trim()) return toast('Nama toko tidak boleh kosong.');
    setBusy(true);
    const patch = {
      name: f.name.trim(), hours: f.hours.trim(), address: f.address.trim(),
      shipping: f.shipping.trim(), payment: f.payment.trim(),
      about: f.about.trim(), ai_notes: f.ai_notes.trim()
    };
    const { error } = await sb.from('shops').update(patch).eq('id', shop.id);
    setBusy(false);
    if (error) return fail(error);
    onShopChange(patch);
    toast('Info toko disimpan.');
  }

  async function removeShop() {
    setDelBusy(true);
    try {
      await authFetch(sb, shop.id, '/api/toko', 'DELETE', { confirm: delName.trim() });
      toast('Toko dihapus.');
      onShopDeleted(shop.id);
    } catch (e) { fail(e); setDelBusy(false); }
  }

  return (
    <>
      <section className="card" aria-labelledby="ti">
        <div className="chead">
          <div>
            <h2 id="ti">Info toko</h2>
            <p className="hint">Asisten hanya menjawab dari data toko, produk, dan FAQ. Semakin lengkap, semakin jarang asisten meneruskan ke admin.</p>
          </div>
        </div>

        <div className="fgrid">
          <div>
            <label htmlFor="t1">Nama toko</label>
            <input id="t1" maxLength={100} value={f.name} onChange={set('name')} />
          </div>
          <div>
            <label htmlFor="t2">Jam buka</label>
            <input id="t2" maxLength={200} value={f.hours} onChange={set('hours')} />
          </div>
        </div>
        <div className="fgrid one tfield">
          <div>
            <label htmlFor="t3">Alamat</label>
            <textarea id="t3" maxLength={500} value={f.address} onChange={set('address')} />
          </div>
        </div>

        <h3 className="fsec">Tentang toko</h3>
        <div className="fgrid one tfield">
          <div>
            <label htmlFor="t6">Deskripsi singkat toko</label>
            <textarea id="t6" maxLength={500} value={f.about} onChange={set('about')} placeholder="Contoh: Pemasok hair extension asli untuk salon dan reseller, kirim ke seluruh Indonesia." />
            <p className="hint field-hint">Dipakai asisten untuk menjawab pertanyaan seperti "toko ini jual apa?". Harga, stok, dan kebijakan tetap diambil dari produk dan FAQ. ({f.about.length}/500)</p>
          </div>
        </div>

        <h3 className="fsec">Pengiriman dan pembayaran</h3>
        <div className="fgrid">
          <div>
            <label htmlFor="t4">Pengiriman</label>
            <textarea id="t4" maxLength={1000} value={f.shipping} onChange={set('shipping')} />
            <p className="hint field-hint">Ekspedisi, estimasi, gratis ongkir.</p>
          </div>
          <div>
            <label htmlFor="t5">Pembayaran</label>
            <textarea id="t5" maxLength={500} value={f.payment} onChange={set('payment')} />
          </div>
        </div>

        <h3 className="fsec">Catatan untuk AI</h3>
        <div className="fgrid one tfield">
          <div>
            <label htmlFor="t7">Preferensi gaya jawaban (opsional)</label>
            <textarea id="t7" maxLength={300} value={f.ai_notes} onChange={set('ai_notes')} placeholder="Contoh: Sapa pelanggan dengan Kak, bahasa santai. Untuk komplain, arahkan ke admin." />
            <p className="hint field-hint">Hanya mengatur cara menjawab. Aturan inti sistem tetap berlaku, jadi asisten tidak akan mengarang harga atau fakta toko meski diminta di sini. ({f.ai_notes.length}/300)</p>
          </div>
        </div>

        <div className="row bot-save"><button className="btn" type="button" disabled={busy} onClick={save}><Busy on={busy} label="Menyimpan...">Simpan</Busy></button></div>
      </section>

      <section className="card dz" aria-labelledby="th">
        <div className="chead">
          <div>
            <h2 id="th">Hapus toko</h2>
            <p className="hint">Menghapus toko ini beserta semua produk, FAQ, percakapan, anggota tim, saluran Telegram/WhatsApp, dan riwayat pembayaran. Paket berbayar yang masih aktif ikut hangus tanpa pengembalian dana. Tindakan ini tidak bisa dibatalkan.</p>
          </div>
        </div>
        {!delOpen ? (
          <div className="row"><button className="btn danger sm" type="button" onClick={() => setDelOpen(true)}>Hapus toko ini</button></div>
        ) : (
          <>
            <Field id="t-del" label={'Ketik nama toko (' + shop.name + ') untuk konfirmasi'}>
              <input id="t-del" autoComplete="off" value={delName} onChange={(e) => setDelName(e.target.value)} />
            </Field>
            <div className="row">
              <button className="btn danger solid sm" type="button" disabled={delBusy || delName.trim() !== shop.name.trim()} onClick={removeShop}>
                <Busy on={delBusy} label="Menghapus...">Hapus permanen</Busy>
              </button>
              <button className="btn ghost sm" type="button" disabled={delBusy} onClick={() => { setDelOpen(false); setDelName(''); }}>Batal</button>
            </div>
          </>
        )}
      </section>
    </>
  );
}
