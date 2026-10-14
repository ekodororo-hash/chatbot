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
   `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `GEMINI_API_KEY_<PAKET>`, `_2`, `_3` dengan PAKET = FREE / STARTER / BISNIS (opsional, sampai 3 key khusus per paket), `GEMINI_MODEL` (opsional), `DEVELOPER_EMAILS` (opsional, email pengembang yang boleh melihat detail teknis di halaman Coba bot), `APP_URL` (opsional, untuk tautan di notifikasi), `MIDTRANS_SERVER_KEY` / `MIDTRANS_IS_PRODUCTION` dan/atau `DOKU_CLIENT_ID` / `DOKU_SECRET_KEY` / `DOKU_IS_PRODUCTION` (opsional, untuk langganan berbayar).
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
app/dashboard/               dashboard pemilik toko (layout + sidebar di DashShell.js, satu route per menu: /dashboard, /produk, /faq, /toko, /bot, /pasang, /notifikasi, /tim, /langganan)
app/api/chat/route.js        POST pesan pelanggan, GET polling balasan admin
app/api/billing/route.js     status paket, checkout, periksa pembayaran (khusus pemilik)
app/api/midtrans/route.js    webhook notifikasi pembayaran Midtrans
app/api/doku/route.js        webhook notifikasi pembayaran DOKU
app/chat/[slug]/route.js     menyajikan /chat/:slug + header CSP frame-ancestors per toko
app/globals.css              gaya seluruh halaman
lib/bot.js                   alur percakapan, batas laju, batas harian, prompt, handoff
lib/gemini.js                pemanggil Gemini (key dan model per paket dari /admin/ai; cadangan env GEMINI_API_KEY / GEMINI_MODEL)
lib/plans.js                 paket, harga, kuota, diskon, perhitungan masa berlaku (bisa diubah dari /admin/paket)
lib/billing.js               Midtrans Snap dan DOKU Checkout, verifikasi webhook, perpanjangan paket
lib/notify.js                notifikasi admin (Telegram) dan perintah /admin KODE
lib/auth.js                  pemeriksaan anggota/pemilik toko untuk API dashboard (header X-Shop-Id)
lib/domains.js               validasi domain dan pembuat CSP
lib/chatTemplate.js          halaman chat pelanggan (dokumen mandiri, lihat catatan di bawah)
lib/supabase.js              klien server (Secret/service role key)
lib/supabaseBrowser.js       klien browser (Publishable/anon key)
public/widget.js             widget yang ditempel di website klien
supabase/schema.sql          tabel, indeks, dan aturan keamanan (RLS)
tests/bot.test.js            60 tes untuk otak bot, saluran, notifikasi, pencarian katalog, dan langganan (npm test)
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

## Banyak toko, tim admin, notifikasi, dan realtime

**Persiapan database (sekali):** jalankan `supabase/migrations/banyak_toko_tim_notifikasi.sql` di Supabase SQL Editor (aman dijalankan ulang; proyek baru sudah tercakup di `schema.sql`). Ini menambah tabel `shop_members`, `shop_invites`, `shop_notify`, kolom `conversations.notified_at`, dan mengaktifkan Realtime untuk `conversations` dan `messages`.

**Banyak toko per akun.** Satu akun boleh punya beberapa toko (batas 5, ubah di fungsi `shops_before_insert`). Pindah toko lewat pilihan di sidebar, tambah lewat tombol "+ Tambah toko". Toko yang terakhir dibuka diingat di browser.

**Peran.** Pemilik (`shops.owner_id`) bisa semuanya. Admin tambahan hanya bisa mengurus Percakapan, Produk, FAQ, dan Coba bot. Pembatasan ini dipaksa di database (RLS) dan di API, bukan hanya disembunyikan di menu. Pemilik mengundang admin dari halaman **Tim** dengan email; undangan diterima otomatis saat orang itu masuk dengan email yang sama (fungsi `accept_invites`). Aktifkan "Confirm email" di Supabase supaya undangan tidak bisa diambil orang yang mendaftar dengan email milik orang lain.

**Notifikasi ke admin** (halaman Notifikasi, lewat Telegram). Dikirim saat bot meneruskan percakapan ke admin, saat ada pesanan, dan saat pelanggan menulis lagi di percakapan yang sudah dipegang admin. Satu percakapan paling sering dikabari sekali tiap 15 menit (diatur atomik lewat `conversations.notified_at`, jadi dua pesan bersamaan tidak mengirim dobel). Gagal kirim hanya dicatat di log dan tidak mengganggu balasan ke pelanggan.
- **Telegram:** hubungkan bot toko, lalu tiap admin mengirim `/admin KODE` ke bot itu dari akun Telegram-nya (kode ada di halaman Notifikasi, maksimal 10 chat). `/admin stop` mencabut. Kode salah diproses seperti pesan pelanggan biasa.

**Realtime.** Daftar percakapan, isi percakapan, dan angka "butuh admin" di menu diperbarui lewat Supabase Realtime (dibatasi RLS), bukan polling 10 detik. Sebagai jaring pengaman, data juga dimuat ulang tiap 60 detik dan saat tab dibuka kembali. Penghapusan percakapan oleh admin lain baru terlihat di jaring pengaman itu, karena event DELETE tidak bisa difilter per toko. Halaman chat pelanggan masih polling 6 detik hanya saat menunggu admin.

## Keamanan: yang sudah ada dan batasnya

- **RLS di semua tabel.** Pemilik toko hanya bisa membaca dan mengubah data tokonya. Pelanggan (anon) tidak punya akses langsung.
- **Secret key / service role key hanya di `app/api`, `app/chat`, dan `lib/`.** Jangan pernah menaruhnya di `public/` atau memberinya awalan `NEXT_PUBLIC_`.
- **Domain yang diizinkan** dipaksa lewat header CSP `frame-ancestors`: browser menolak menampilkan chat di situs lain. Ini mencegah orang menempelkan botmu di situs mereka lewat browser. Ini tidak menghentikan orang yang memanggil `/api/chat` langsung (curl), karena header bisa dipalsukan.
- **Pengaman biaya yang sebenarnya:** batas 8 pesan per menit per percakapan, 60 per menit per toko, dan batas balasan bot per hari per toko (atur di halaman Bot). Setelah batas tercapai, pesan masuk ke admin tanpa memanggil Gemini.
- **Prompt injection:** pesan pelanggan hanya masuk sebagai giliran user, dan prompt menyuruh bot menjawab hanya dari data toko. Ini mengurangi risiko, bukan menghilangkannya. Karena itu bot tidak diberi kemampuan mengubah harga, stok, atau pesanan; admin yang mengonfirmasi pesanan.
- **Privasi:** pesan pelanggan disimpan di databasemu, dan halaman chat memberi tahu hal itu. Sebelum jualan ke klien, siapkan kebijakan privasi dan perjanjian pemrosesan data sederhana.
- Library Supabase sekarang dipasang lewat npm (bukan CDN), jadi versinya terkunci di `package-lock.json`. Commit file itu setelah `npm install` pertama.

## Katalog besar (pencarian produk dan FAQ)

**Persiapan database (sekali):** jalankan `supabase/migrations/pencarian_katalog.sql` (mengaktifkan `pg_trgm`, indeks, dan fungsi `search_products` / `search_faqs`; proyek baru sudah tercakup di `schema.sql`).

- Sampai 100 produk dan 100 FAQ, seluruh data dikirim ke prompt seperti sebelumnya.
- Di atas itu, bot mencari dulu: kata kunci diambil dari tiga pesan pelanggan terakhir (kata sambung dibuang), lalu 40 produk dan 20 FAQ paling cocok yang dikirim. Skor: kata ada di nama (3), di deskripsi (1), atau mirip nama untuk salah ketik kecil (2).
- Pertanyaan umum tanpa kata kunci ("ada produk apa saja?") mendapat 15 contoh produk.
- Prompt memberi tahu bot bahwa datanya sebagian, jadi produk yang tidak tampil tidak dianggap tidak ada: bot meneruskan ke admin.
- Kalau fungsi pencarian belum dipasang atau error, bot jatuh ke 100 data pertama dan tetap menjawab (tercatat di log).
- Batasnya: pencarian berbasis kata, bukan makna. Pelanggan yang memakai sinonim yang tidak ada di nama/deskripsi produk ("jilbab" untuk "kerudung") tidak ketemu. Perbaikannya: isi deskripsi dengan kata yang umum dipakai pelanggan, atau tambah FAQ.

## Langganan berbayar (Midtrans dan/atau DOKU)

**Persiapan database (sekali):** jalankan `supabase/migrations/langganan.sql` (tabel `shop_billing` dan `payments`, RLS tanpa policy sehingga hanya server yang bisa menulis). Toko yang sudah ada diberi masa percobaan paket Bisnis 30 hari supaya tidak mendadak terbatas; hapus blok itu di file migrasi kalau tidak diinginkan.

**Paket** (ubah lewat menu **Admin → Paket**: nama, jumlah chat per bulan, harga per bulan, diskon paket, dan diskon lama langganan; langsung berlaku tanpa deploy. Disimpan di tabel `app_settings` kunci `PLANS_CONFIG`. Nilai bawaan ada di `lib/plans.js`, dipakai kalau belum pernah diubah atau setelah klik "Kembalikan ke bawaan"). Bawaan: Gratis 100 balasan/bulan, Starter Rp49.000 (1.500/bulan), Bisnis Rp149.000 (6.000/bulan). Lama 1, 3 (hemat 5%), atau 12 bulan (hemat 15%). Diskon paket (0 sampai 90%) ditumpuk dengan diskon lama langganan, dan pelanggan melihat harga normal dicoret di halaman Langganan. Angka ini contoh, sesuaikan dengan hitungan biaya Gemini dan harga pasarmu. Kuota dihitung per bulan kalender WIB per toko; setelah habis, pesan masuk ke admin tanpa memanggil AI. Batas harian di halaman Bot tetap berlaku.

**Pasang Midtrans:**
1. Daftar di dashboard.midtrans.com. Mulai dari mode Sandbox: ambil Server Key di Settings > Access Keys.
2. Isi `MIDTRANS_SERVER_KEY` dan `APP_URL` di Vercel, lalu deploy ulang. `MIDTRANS_IS_PRODUCTION` biarkan `false` selama uji coba.
3. Di Midtrans: Settings > Configuration > Payment Notification URL isi `https://DOMAINMU/api/midtrans`. Finish redirect URL tidak perlu diisi (dikirim dari aplikasi).
4. Buka Dashboard > Langganan (hanya pemilik toko), pilih paket, dan bayar dengan simulator sandbox Midtrans.
5. Untuk meluncur: ganti ke Server Key production dan set `MIDTRANS_IS_PRODUCTION=true`.

**Pasang DOKU (Checkout):**
1. Daftar di dashboard.doku.com, mulai dari Sandbox. Ambil Client ID dan Secret Key di Integration > API Keys.
2. Isi `DOKU_CLIENT_ID`, `DOKU_SECRET_KEY`, dan `APP_URL` di Vercel, lalu deploy ulang. `DOKU_IS_PRODUCTION` biarkan `false` selama uji coba.
3. Di DOKU Back Office isi **Notification URL** `https://DOMAINMU/api/doku` untuk tiap payment channel yang kamu aktifkan. Path-nya harus persis `/api/doku` karena ikut dalam perhitungan tanda tangan.
4. Aktifkan channel yang diinginkan (QRIS, VA, e-wallet, kartu) di akun DOKU; yang tampil di halaman bayar mengikuti pengaturan itu.
5. Untuk meluncur: ganti ke kunci production dan set `DOKU_IS_PRODUCTION=true`.

Midtrans dan DOKU boleh aktif bersamaan: pemilik toko memilih metode di halaman Langganan. Kalau hanya satu yang diisi, hanya itu yang muncul. Penyedia tercatat per pembayaran (`payments.provider`), jadi tombol Periksa selalu bertanya ke penyedia yang benar.

**Catatan DOKU:** tanda tangan dan alur ini ditulis dari dokumentasi DOKU dan diuji dengan tes otomatis, tapi belum pernah dicoba ke server DOKU sungguhan. Uji sekali di sandbox sebelum meluncur (bayar satu paket, lihat status berubah lunas). DOKU hanya mengirim SUCCESS atau FAILED; FAILED diabaikan karena pelanggan boleh mencoba metode lain, dan tagihan yang tidak dibayar dalam 24 jam tetap berstatus menunggu bayar di riwayat. API cek status DOKU untuk Checkout hanya aktif untuk merchant yang mendaftar sejak Desember 2024 (yang lama perlu minta ke DOKU); kalau belum aktif, tombol Periksa tidak menemukan apa pun dan kamu mengandalkan webhook. DOKU menyarankan cek status minimal 60 detik setelah pembayaran.

**Cara kerjanya:**
- Jumlah dan harga selalu dihitung server dari pengaturan paket (`lib/plans.js` + isian admin); browser hanya mengirim nama paket dan lama.
- Notifikasi diverifikasi dengan tanda tangan (Midtrans: SHA-512 dengan Server Key; DOKU: HMAC-SHA256 dengan Secret Key atas Client-Id, Request-Id, timestamp, path, dan Digest body) dan jumlahnya dicocokkan dengan tagihan. Pembayaran ditandai lunas lewat satu update atomik, jadi notifikasi yang dikirim ulang tidak memperpanjang dua kali. Kalau perpanjangan gagal, status dikembalikan ke pending dan webhook membalas error supaya Midtrans mengirim ulang.
- Tombol **Periksa** di riwayat (dan otomatis saat kembali dari halaman bayar) menanyakan status langsung ke Midtrans, jadi paket tetap aktif walau webhook terlambat.
- Memperpanjang paket yang sama menyambung dari tanggal berakhir. Pindah ke paket lain dihitung dari hari pembayaran (sisa masa paket lama tidak dikompensasi). Turun paket saat paket lebih tinggi masih aktif ditolak.
- Klik beli berulang dalam 23 jam memakai ulang tautan bayar yang sama.
- Kalau tabel paket bermasalah, bot tetap menjawab (hanya batas harian yang berlaku) dan error dicatat di log.
- Aktivasi manual (misalnya klien bayar transfer): lihat contoh SQL di bagian bawah `langganan.sql`.

Yang belum ada: perpanjangan otomatis (kartu tersimpan/langganan berulang), faktur/PPN, pengingat email sebelum masa habis, dan pembatasan fitur per paket selain kuota balasan (jumlah toko, saluran Telegram/WhatsApp).

## Yang belum ada (tahap berikutnya)

- Perpanjangan otomatis dan pengingat masa langganan habis (lihat bagian Langganan).
- Pencarian produk berbasis makna (embedding) untuk katalog yang pelanggannya sering memakai sinonim.

## Catatan Gemini

Model per paket diatur admin di menu **AI** (`/admin/ai`), bersama API key Gemini (tersimpan terenkripsi, tanpa deploy ulang). Tiap paket (Gratis, Starter, Bisnis) bisa punya sampai 3 API key sendiri. Key dipakai bergantian supaya beban terbagi, dan kalau satu key kena limit (429), ditolak, atau server Gemini error, bot otomatis mencoba key berikutnya. Paket tanpa key sendiri memakai key bawaan. Paket yang modelnya dikosongkan memakai `GEMINI_MODEL` (default `gemini-3.5-flash-lite`); toko tanpa langganan aktif memakai model paket Gratis. Nama model dan parameter yang didukung bisa berubah, jadi cek dokumentasi Google sebelum meluncur. Untuk model Gemini 3.x, `lib/gemini.js` sengaja tidak mengirim `temperature`, `top_p`, atau `top_k`.
