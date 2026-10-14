# Asisten Toko - chatbot untuk UMKM

Web lengkap: dashboard klien, halaman chat, dan widget yang ditempel di website klien.
Stack: Next.js (App Router, JavaScript) di Vercel, Supabase (login + database), Gemini (jawaban AI).

## Cara kerja

```
Website klien --(widget.js)--> iframe https://DOMAINMU/chat/slug-toko
                                  |  POST /api/chat
                                  v
        app/api/chat/route.js -> lib/bot.js -> Supabase (data toko, riwayat) + Gemini
Pemilik toko  --> /dashboard --> Supabase langsung (dibatasi RLS)
```

Pelanggan tidak pernah menyentuh database. Semua lewat `app/api/chat/route.js` yang memakai Secret key / service role key (hanya ada di server).

## Pasang (sekitar 20 menit)

1. **Supabase**: buat project. Buka SQL Editor, tempel isi `supabase/schema.sql`, Run.
   - Authentication > Providers > Email: untuk uji coba, matikan "Confirm email" (atau biarkan aktif dan pastikan Site URL diisi domainmu).
   - Authentication > URL Configuration: isi Site URL dengan domainmu.
2. **Gemini**: buat API key di Google AI Studio.
3. **Vercel**: import folder ini sebagai project (Framework Preset: Next.js, terdeteksi otomatis; `vercel.json` juga mengaturnya). Isi Environment Variables seperti di `.env.example`:
   `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL` (opsional), `DEVELOPER_EMAILS` (opsional, email pengembang yang boleh melihat detail teknis di halaman Coba bot).
   Nama variabel tidak berubah dari versi lama dan tidak perlu awalan `NEXT_PUBLIC_`. URL dan kunci publik diteruskan ke browser lewat server component.
   `SUPABASE_ANON_KEY` boleh diisi Publishable key (`sb_publishable_...`), `SUPABASE_SERVICE_ROLE_KEY` boleh diisi Secret key (`sb_secret_...`).
4. **Domain**: tambahkan domain, misalnya `chat.isengin.site`, di Vercel > Settings > Domains lalu arahkan DNS-nya.
5. Buka `/login#daftar`, buat akun, buat toko, isi produk dan FAQ, lalu buka halaman **Pasang**.

Uji lokal: `npm install`, buat `.env.local` dari `.env.example`, lalu `npm run dev` (buka http://localhost:3000).
Tes otomatis otak bot: `npm test` (tanpa jaringan).

## Struktur folder

```
app/page.js                  beranda
app/login/                   halaman masuk dan daftar
app/dashboard/               dashboard pemilik toko (layout + sidebar di DashShell.js, satu route per menu: /dashboard, /produk, /faq, /toko, /bot, /pasang, /notifikasi)
app/api/chat/route.js        POST pesan pelanggan, GET polling balasan admin
app/chat/[slug]/route.js     menyajikan /chat/:slug + header CSP frame-ancestors per toko
app/globals.css              gaya seluruh halaman
lib/bot.js                   alur percakapan, batas laju, batas harian, prompt, handoff
lib/gemini.js                pemanggil Gemini (model dari env GEMINI_MODEL)
lib/domains.js               validasi domain dan pembuat CSP
lib/chatTemplate.js          halaman chat pelanggan (dokumen mandiri, lihat catatan di bawah)
lib/supabase.js              klien server (Secret/service role key)
lib/supabaseBrowser.js       klien browser (Publishable/anon key)
public/widget.js             widget yang ditempel di website klien
supabase/schema.sql          tabel, indeks, dan aturan keamanan (RLS)
tests/bot.test.js            13 tes untuk otak bot (npm test)
```

**Kenapa halaman chat bukan komponen React?** Halaman `/chat/:slug` dipasang sebagai iframe di website klien, dan harus membawa
header CSP yang berbeda untuk tiap toko (daftar domain yang boleh memasangnya). Dengan dokumen mandiri tanpa script eksternal,
CSP bisa dibuat sangat ketat (`default-src 'none'`). Isinya hanya berubah lewat `lib/chatTemplate.js`.

## Telegram dan WhatsApp

Bot yang sama (`lib/bot.js`) sekarang bisa melayani Telegram dan WhatsApp selain widget web. Semua percakapan masuk ke tab Percakapan, dengan label saluran, dan admin membalas dari sana seperti biasa.

**Persiapan database (sekali):** jalankan `supabase/migrations/saluran_telegram_whatsapp.sql` di Supabase SQL Editor (proyek baru sudah tercakup di `schema.sql`).

**Telegram:** di dashboard buka Notifikasi > Telegram, tempel token dari @BotFather, klik Hubungkan. Webhook dipasang otomatis dan dilindungi secret token acak.

**WhatsApp (Cloud API Meta):**
1. Buat app di developers.facebook.com, tambahkan produk WhatsApp, siapkan nomor.
2. Buat System User dan access token permanen (token sementara hanya berlaku 24 jam).
3. Di dashboard buka Notifikasi > WhatsApp, isi Phone number ID, Access token, dan App Secret, lalu Simpan.
4. Di dashboard Meta (WhatsApp > Configuration > Webhook) tempel Callback URL dan Verify token yang muncul, klik Verify and save, lalu subscribe ke field `messages`.

Hal yang perlu diketahui:
- Kunci akses disimpan di tabel `shop_channels`. RLS aktif tanpa policy, jadi hanya server yang bisa membacanya; dashboard tidak pernah menerima token kembali.
- Webhook memverifikasi pengirim: header secret token (Telegram) dan tanda tangan `X-Hub-Signature-256` dengan App Secret (WhatsApp). Pesan yang dikirim ulang diabaikan lewat `messages.external_id`.
- Satu pelanggan = satu percakapan yang berlanjut. Setelah 200 pesan, otomatis dibuat percakapan baru.
- Aturan WhatsApp: balasan bebas hanya boleh dikirim dalam 24 jam setelah pelanggan terakhir menulis. Di luar itu admin akan melihat pesan gagal kirim dan butuh message template (belum didukung).
- Bot hanya membaca pesan teks. Foto, stiker, dan voice note dibalas permintaan maaf. Grup Telegram diabaikan.
- Webhook memproses pesan sebelum menjawab 200, jadi `maxDuration` di route diset 30 detik.
- Versi Graph API diatur lewat `WHATSAPP_API_VERSION` (default `v26.0`). Versi lama dihentikan Meta secara berkala, jadi cek developers.facebook.com sebelum meluncur.

## Keamanan: yang sudah ada dan batasnya

- **RLS di semua tabel.** Pemilik toko hanya bisa membaca dan mengubah data tokonya. Pelanggan (anon) tidak punya akses langsung.
- **Secret key / service role key hanya di `app/api`, `app/chat`, dan `lib/`.** Jangan pernah menaruhnya di `public/` atau memberinya awalan `NEXT_PUBLIC_`.
- **Domain yang diizinkan** dipaksa lewat header CSP `frame-ancestors`: browser menolak menampilkan chat di situs lain. Ini mencegah orang menempelkan botmu di situs mereka lewat browser. Ini tidak menghentikan orang yang memanggil `/api/chat` langsung (curl), karena header bisa dipalsukan.
- **Pengaman biaya yang sebenarnya:** batas 8 pesan per menit per percakapan, 60 per menit per toko, dan batas balasan bot per hari per toko (atur di halaman Bot). Setelah batas tercapai, pesan masuk ke admin tanpa memanggil Gemini.
- **Prompt injection:** pesan pelanggan hanya masuk sebagai giliran user, dan prompt menyuruh bot menjawab hanya dari data toko. Ini mengurangi risiko, bukan menghilangkannya. Karena itu bot tidak diberi kemampuan mengubah harga, stok, atau pesanan; admin yang mengonfirmasi pesanan.
- **Privasi:** pesan pelanggan disimpan di databasemu, dan halaman chat memberi tahu hal itu. Sebelum jualan ke klien, siapkan kebijakan privasi dan perjanjian pemrosesan data sederhana.
- Library Supabase sekarang dipasang lewat npm (bukan CDN), jadi versinya terkunci di `package-lock.json`. Commit file itu setelah `npm install` pertama.

## Yang belum ada (tahap berikutnya)

- **Pembayaran langganan** (Midtrans/Xendit). Saat ini belum ada kolom paket atau kuota bulanan; aktivasi klien dilakukan manual.
- **Banyak toko per akun** (sekarang satu akun satu toko) dan peran admin tambahan.
- **Notifikasi** saat ada percakapan butuh admin (email atau Telegram). Dashboard sekarang polling tiap 10 detik.
- **Realtime** pengganti polling kalau pengguna sudah banyak.
- **Pencarian produk besar.** Sekarang maksimal 100 produk dan 100 FAQ dikirim ke prompt. Di atas itu perlu pencarian dulu.

## Catatan Gemini

Model dibaca dari `GEMINI_MODEL` (default `gemini-3.5-flash-lite`). Nama model dan parameter yang didukung bisa berubah, jadi cek dokumentasi Google sebelum meluncur. Untuk model Gemini 3.x, `lib/gemini.js` sengaja tidak mengirim `temperature`, `top_p`, atau `top_k`.
