# Asisten Toko - asisten AI untuk UMKM

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
app/api/rating/route.js      POST penilaian jempol atas/bawah dari halaman chat
app/api/lead/route.js        POST nomor/email pengunjung yang mau dikabari soal promo
app/api/pasang/cek/route.js  POST cek pemasangan: ambil situs klien, cari kode widget, cocokkan domain (anggota toko)
app/api/billing/route.js     status paket, checkout, periksa pembayaran (khusus pemilik)
app/api/midtrans/route.js    webhook notifikasi pembayaran Midtrans
app/api/doku/route.js        webhook notifikasi pembayaran DOKU
app/chat/[slug]/route.js     menyajikan /chat/:slug + header CSP frame-ancestors per toko
app/globals.css              gaya seluruh halaman
lib/bot.js                   alur percakapan, batas laju, batas harian, prompt, handoff
lib/gemini.js                pemanggil Gemini (key dan model per paket dari /admin/ai; cadangan env GEMINI_API_KEY / GEMINI_MODEL)
lib/plans.js                 paket, harga, kuota, diskon, perhitungan masa berlaku (bisa diubah dari /admin/paket)
lib/billing.js               Midtrans Snap dan DOKU Checkout, verifikasi webhook, perpanjangan paket
lib/rating.js                logika penilaian (memilih pertanyaan untuk FAQ, ringkasan kepuasan)
lib/leads.js                 validasi nomor/email, format tampilan, ekspor CSV kontak
lib/notify.js                notifikasi admin (Telegram) dan perintah /admin KODE
lib/auth.js                  pemeriksaan anggota/pemilik toko untuk API dashboard (header X-Shop-Id)
lib/domains.js               validasi domain dan pembuat CSP
lib/siteCheck.js             pengambil halaman untuk Cek pemasangan (penjaga SSRF) dan pencari kode widget di HTML
lib/qr.js                    pembuat QR code tanpa dependensi (byte mode, koreksi M, sampai 213 byte) untuk link chat
lib/chatTemplate.js          halaman chat pelanggan (dokumen mandiri, lihat catatan di bawah)
lib/supabase.js              klien server (Secret/service role key)
lib/supabaseBrowser.js       klien browser (Publishable/anon key)
public/widget.js             widget yang ditempel di website klien (tampilan dibaca dari /api/widget/slug)
supabase/schema.sql          tabel, indeks, dan aturan keamanan (RLS)
tests/pasang.test.js         tes Cek pemasangan (penjaga SSRF, pencari kode widget, cocok domain) dan QR code
tests/bot.test.js            82 tes untuk otak bot, saluran, notifikasi, pencarian katalog, dan langganan (npm test)
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

## Ringkasan, pesanan, pertanyaan belum terjawab, dan notifikasi kuota

**Persiapan database (sekali):** jalankan `supabase/migrations/dashboard_pesanan_kuota.sql` di Supabase SQL Editor (aman dijalankan ulang; proyek baru sudah tercakup di `schema.sql`). Ini menambah `conversations.order_status` dan kolom catatan notifikasi kuota di `shop_notify`. Kalau belum dijalankan, bot dan halaman lain tetap jalan; hanya fitur Pesanan dan notifikasi kuota yang belum aktif.

- **Ringkasan** (`/dashboard/ringkasan`): percakapan dan balasan asisten hari ini, jumlah yang butuh admin, pesanan baru, pemakaian kuota bulan ini (hanya pemilik), grafik percakapan 7 hari, dan daftar hal yang perlu ditangani.
- **Pesanan** (`/dashboard/pesanan`): percakapan yang ditandai bot sebagai pesanan, dengan status baru, diproses, selesai, atau dibatalkan. Rincian pesanan (produk, jumlah, nama, alamat) dibaca dari isi percakapan. Lencana di menu menghitung pesanan berstatus baru. Saat migrasi dijalankan, pesanan lama yang aktif dalam 14 hari terakhir menjadi "baru" dan yang lebih lama menjadi "selesai".
- **Belum terjawab** (`/dashboard/belum-terjawab`): pertanyaan pelanggan yang tidak bisa dijawab asisten, dikelompokkan bila sama. Tombol **Jadikan FAQ** membuka form FAQ dengan pertanyaan terisi; setelah FAQ disimpan, pertanyaan itu otomatis ditandai beres.
- **Notifikasi kuota** (`lib/quotaAlert.js`): lewat Telegram admin toko, sekali saat kuota balasan bulan ini terpakai 80% dan sekali saat habis, per bulan kalender (WIB). Tidak ada penerima Telegram berarti tidak ada kiriman dan jatah bulan itu tidak terpakai. Batas 80% diatur di `WARN_AT`.
- **Pengingat masa aktif** sudah ada sebelumnya (`lib/reminder.js`, tahap 7, 3, 1 hari dan habis) dan butuh `CRON_SECRET` serta cron-job.org seperti di bagian langganan.

## Pemakaian balasan (kuota tidak kembali saat percakapan dihapus)

**Persiapan database (sekali):** jalankan `supabase/migrations/pemakaian_bot.sql` di Supabase SQL Editor (aman dijalankan ulang; proyek baru sudah tercakup di `schema.sql`).

Kuota harian (`daily_limit`) dan kuota bulanan paket dihitung dari tabel `bot_usage` (satu baris per toko per hari WIB, ditambah lewat fungsi `bot_usage_add` setiap AI selesai membalas), bukan dari jumlah pesan. Hanya balasan AI yang dihitung: pesan otomatis seperti "asisten sedang nonaktif" atau "kuota habis" tidak memakai kuota. Pesan ikut terhapus saat percakapan dihapus (`ON DELETE CASCADE`), sehingga dulu pemakaian bisa kembali ke 0 setelah semua percakapan dihapus. Pembacaan ada di `lib/usage.js`. Kalau tabel belum ada, aplikasi tetap jalan dan menghitung dari pesan seperti sebelumnya. Balasan yang sudah terlanjur terhapus sebelum migrasi tidak bisa dipulihkan.

## Bahasa

Asisten **memahami pesan dalam bahasa apa pun** tetapi **selalu membalas dalam bahasa Indonesia** (aturan 5a di `buildSystem`, `lib/bot.js`). Pesan otomatis non-AI (kuota habis, gangguan, tulisan widget) juga tetap Indonesia.

Pada toko berkatalog besar (lebih dari 100 produk atau FAQ), nama produk dicari dengan kata kunci a-z. Kalau pencarian biasa kosong, pesan pelanggan diterjemahkan dulu menjadi kata kunci Indonesia (`translateKeywords`, satu panggilan Gemini kecil) lalu dicari sekali lagi. Ini hanya terjadi saat pencarian kosong, dan tidak untuk sapaan biasa seperti "halo kak". Toko berkatalog kecil tidak butuh langkah ini karena seluruh produk dikirim ke AI.

## Keamanan: yang sudah ada dan batasnya

- **RLS di semua tabel.** Pemilik toko hanya bisa membaca dan mengubah data tokonya. Pelanggan (anon) tidak punya akses langsung.
- **Secret key / service role key hanya di `app/api`, `app/chat`, dan `lib/`.** Jangan pernah menaruhnya di `public/` atau memberinya awalan `NEXT_PUBLIC_`.
- **Domain yang diizinkan** dipaksa lewat header CSP `frame-ancestors`: browser menolak menampilkan chat di situs lain. Ini mencegah orang menempelkan botmu di situs mereka lewat browser. Ini tidak menghentikan orang yang memanggil `/api/chat` langsung (curl), karena header bisa dipalsukan.
- **Cek pemasangan** (`/api/pasang/cek`) membuat server membuka alamat yang diketik pengguna, jadi dijaga dari SSRF: harus login sebagai anggota toko, hanya http/https port 80/443, hanya nama domain (bukan IP atau localhost), dan setiap alamat hasil DNS diperiksa saat koneksi dibuat (juga di setiap redirect) sehingga alamat privat, loopback, dan link-local ditolak. Balasan dibatasi 2 MB dan 8 detik. Kode widget yang dipasang lewat Google Tag Manager atau disuntik penuh oleh JavaScript tidak terlihat oleh pengecekan ini.
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

**Paket** (ubah lewat menu **Admin → Paket**: nama, jumlah chat per bulan, harga per bulan, diskon paket, dan diskon lama langganan; langsung berlaku tanpa deploy. Disimpan di tabel `app_settings` kunci `PLANS_CONFIG`. Nilai bawaan ada di `lib/plans.js`, dipakai kalau belum pernah diubah atau setelah klik "Kembalikan ke bawaan"). Bawaan: Gratis 100 balasan/bulan, Starter Rp49.000 (1.500/bulan), Bisnis Rp149.000 (6.000/bulan). Lama 1, 3 (hemat 5%), atau 12 bulan (hemat 15%). Diskon paket (0 sampai 90%) ditumpuk dengan diskon lama langganan, dan pelanggan melihat harga normal dicoret di halaman Langganan. Angka ini contoh, sesuaikan dengan hitungan biaya Gemini dan harga pasarmu. Kuota dihitung per bulan kalender WIB per toko; setelah habis, pesan masuk ke admin tanpa memanggil AI. Batas harian di halaman Asisten AI tetap berlaku.

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

**Pengingat langganan:** toko berbayar dikabari lewat Telegram admin toko pada 7 hari, 3 hari, dan 1 hari sebelum masa berlaku habis, dan sekali setelah habis (sampai 3 hari sesudahnya). Tiap tahap dikirim satu kali per masa berlaku; setelah perpanjangan hitungannya mulai lagi. Toko yang belum menghubungkan Telegram dicoba lagi pada jadwal berikutnya, jadi baru dikabari setelah terhubung.
1. Jalankan `supabase/migrations/pengingat_langganan.sql` di Supabase SQL Editor, lalu deploy.
2. Isi `CRON_SECRET` di Vercel (string acak panjang) dan deploy ulang.
3. Di cron-job.org buat cron job: URL `https://DOMAINMU/api/cron/langganan`, jadwal sehari sekali (misalnya 09.00 WIB), metode GET. Di Advanced > Headers tambahkan `Authorization` dengan nilai `Bearer ISI_CRON_SECRET`. Kalau tidak mau memakai header, boleh `https://DOMAINMU/api/cron/langganan?key=ISI_CRON_SECRET`, tapi header lebih aman karena parameter URL bisa tercatat di log.
4. Uji sekali dengan tombol "Test run" di cron-job.org. Balasannya ringkasan: `checked` (toko yang masuk jendela pengingat), `sent` (terkirim), `noChannel` (Telegram belum terhubung), `failed`.

Yang belum ada: perpanjangan otomatis (kartu tersimpan/langganan berulang), faktur/PPN, pengingat lewat email (yang ada baru lewat Telegram), dan pembatasan fitur per paket selain kuota balasan (jumlah toko, saluran Telegram/WhatsApp).

## Rating percakapan dan kontak pelanggan

**Persiapan database (sekali):** jalankan `supabase/migrations/rating_dan_kontak.sql` di Supabase SQL Editor (aman dijalankan ulang; proyek baru sudah tercakup di `schema.sql`). Ini menambah kolom `conversations.rating`, `rated_at`, `rating_q`, `rating_done`, `lead_offered_at`, kolom `shops.lead_on`, dan tabel `leads`. Kalau belum dijalankan, bot dan halaman lain tetap jalan; kartu penilaian dan tawaran kontak tidak ditampilkan, dan menu Kontak memberi petunjuk menjalankan migrasi.

**Rating (jempol atas/bawah).** Di chat web, kartu "Bagaimana pelayanan kami?" muncul sendiri saat percakapan ditandai selesai. Sebelum itu, pelanggan bisa membukanya lewat tautan kecil "Beri nilai percakapan" di bawah kolom pesan (muncul setelah ada balasan). Penilaian disimpan lewat `/api/rating`, hanya bisa dilakukan pemilik percakapan (token pengunjung), dan nilai terakhir yang berlaku.
- **Ringkasan > Kepuasan pelanggan:** persen puas dan jumlah jempol atas/bawah selama 30 hari terakhir.
- **Dinilai kurang baik:** setiap jempol bawah menyimpan satu pertanyaan pelanggan (dipilih otomatis: yang bernada pertanyaan, bukan tombol cepat atau "ok"). Tombol **Jadikan FAQ** membuka form FAQ dengan pertanyaan itu sudah terisi; setelah FAQ disimpan, barisnya hilang dari daftar. **Tandai beres** menghapusnya tanpa membuat FAQ.
- Hanya chat web. Penilaian untuk Telegram/WhatsApp belum ada.

**Kontak pelanggan (lead).** Mati secara bawaan; nyalakan di **Asisten AI > Tawarkan pengunjung dikabari soal promo**. Setelah pengunjung mengirim minimal 2 pesan, belum memesan, dan tidak sedang dioper ke admin, chat menampilkan kartu "Mau dikabari kalau ada promo?" **satu kali per percakapan**. Nomor (format Indonesia disatukan ke `62812...`, nomor luar negeri harus diawali `+`) atau email divalidasi di server dan disimpan di tabel `leads`, tanpa duplikat per toko. Batas: 3 kontak per percakapan dan 20 per menit per toko.
- **Menu Kontak:** daftar kontak, salin, buka WhatsApp, buka chat asal, hapus, dan unduh CSV (sel diamankan dari rumus Excel). Ini bahan untuk fitur broadcast promo nanti; broadcast-nya sendiri belum dibuat.
- Kartu menjanjikan "bisa minta berhenti kapan saja". Kalau pelanggan minta berhenti, hapus kontaknya di menu Kontak. Hubungi kontak hanya soal promo toko, sesuai yang ditawarkan.

## Yang belum ada (tahap berikutnya)

- Perpanjangan otomatis (kartu tersimpan/langganan berulang). Pengingat masa langganan habis sudah ada, lihat bagian Pengingat langganan.
- Pencarian produk berbasis makna (embedding) untuk katalog yang pelanggannya sering memakai sinonim.
- Broadcast promo ke kontak yang terkumpul, dan penilaian untuk saluran Telegram/WhatsApp.

## Penyedia AI per paket (mis. Groq untuk paket Gratis)

Tiap paket punya pilihan **Penyedia AI** di `/admin/ai`: Gemini (bawaan), Groq, OpenRouter, Mistral, atau Cerebras. Contoh umum: paket Gratis memakai Groq (tier gratis), paket Starter dan Bisnis tetap Gemini. Penyedia selain Gemini berformat OpenAI (`POST {base}/chat/completions`), dipanggil dari `lib/gemini.js`.

- Key diisi di kartu paket (sampai 3, dipakai bergantian dan saling cadangan, seperti Gemini). **Key bawaan Gemini tidak pernah dipakai penyedia lain**, jadi paket yang memakai Groq wajib punya key Groq sendiri.
- Model kosong = model bawaan penyedia (`PROVIDERS` di `lib/gemini.js`). OpenRouter tidak punya bawaan: isi nama model (contoh `meta-llama/llama-3.3-70b-instruct:free`). Nama model dan batas gratis sering berubah, jadi cek di situs penyedia dan ganti dari `/admin/ai` tanpa deploy.
- Tidak ada pindah otomatis antarpenyedia: kalau semua key penyedia sebuah paket gagal, bot meminta pelanggan mengirim ulang lalu meneruskan ke admin seperti biasa.
- Tier gratis punya batas laju, dan sebagian penyedia membatasi pemakaian komersial atau memakai data untuk pelatihan. Baca ketentuannya sebelum dipakai untuk chat pelanggan.

## Otak EMAHAIRSHOP (khusus pemilik layanan)

Asisten bisa memakai "otak" yang sama dengan asisten di portal emahairshop.com: aturan perilaku dan info perusahaan ditulis sekali di server, jadi pemilik layanan tidak perlu mengisi produk, FAQ, atau data toko lagi.

- **Siapa yang memakai:** hanya toko yang pemiliknya berurusan dengan email di `ADMIN_EMAILS` (cadangan: `DEVELOPER_EMAILS`). Toko lain tetap memakai data tokonya sendiri (produk, FAQ, nada). Kalau `ADMIN_EMAILS` kosong, tidak ada toko yang memakai otak ini.
- **Di mana teksnya:** bawaan di `lib/otak.template.js` (dipindah dari `api/chat.js` portal). Admin bisa menggantinya di `/admin/ai` > Otak asisten tanpa deploy; tersedia saklar, "Batalkan perubahan terakhir" (satu tingkat), dan "Kembalikan ke bawaan". Teksnya tidak pernah dikirim ke browser pemilik toko, dan hanya halaman super admin yang bisa melihatnya.
- **Cara kerja:** `lib/bot.js` memanggil `lib/otak.js`. Model membalas JSON `{"reply":"..."}`; penanda portal di akhir `reply` diurai di server dan dibuang sebelum dilihat pelanggan:

| Penanda | Tindakan di chatbot |
|---|---|
| `[[HUMAN]]` | percakapan diserahkan ke admin + notifikasi |
| `[[URGENT]]`, `[[FRAUD]]` | notifikasi ke admin; bot tetap menjawab; percakapan ditandai belum dibalas |
| `[[UNKNOWN]]` | percakapan ditandai belum dibalas (tampil di dashboard), tanpa notifikasi |
| `[[LEAD]]` | percakapan ditandai belum dibalas dengan ringkasan calon pembeli, tanpa notifikasi |
| `[[NAME]]` | nama disimpan sebagai nama pelanggan (hanya chat web) |
| `[[WA]]` | tautan WhatsApp resmi (diambil dari teks otak) ditambahkan di akhir balasan |
| `[[OFFTOPIC]]` | dibuang (balasan singkat penolakan ditulis model sendiri) |
| `[[ADMIN_DRAFT]]` | dibuang (belum dipakai) |

- **Yang berbeda dari portal:** pengetahuan hanya dari teks otak (produk/FAQ di database tidak dimuat); kartu tawaran kontak dan pencatatan pesanan chatbot biasa tidak dipakai; antrean, arsip Telegram, dan pelacak pengunjung portal tidak dipindah. Batas harian toko, kuota paket, dan model per paket tetap berlaku. Aturan privasi data chat di teks otak sudah disesuaikan (di chatbot percakapan disimpan di database).
- **Jaring pengaman admin:** seperti `wantsHuman()` di portal, kalau pesan pengunjung jelas minta bicara dengan admin/manusia tetapi model lupa menulis `[[HUMAN]]`, percakapan tetap diserahkan. Tidak berlaku bila model sudah menandai `[[FRAUD]]` atau `[[URGENT]]` (di chatbot serah-terima membungkam bot). Saat serah-terima, tautan WhatsApp tidak ditambahkan.
- **Bandingkan dengan portal:** `node scripts/bandingkan-otak.js <jalur/api/chat.js>` (offline: keluaran model yang sama dialirkan ke pengurai portal dan chatbot) atau tambah `--live` dengan `GEMINI_API_KEY` untuk pertanyaan yang sama ke model sungguhan. Bahasa balasan: bahasa pesan terakhir pengunjung dideteksi di server (`detectLang`, dari portal) dan dikirim ke model sebagai arahan, jadi "can i have price list" dijawab Inggris. Jaring pengaman lead dari portal (`enrich()` di `lib/otak.js`): nomor diambil dari pola angka di pesan pengunjung, `wa=` buatan model dibuang, lead hanya sah kalau namanya sah, dan lead/nama dibuat otomatis di percakapan harga kalau model lupa menandai. Belum dipindah dari portal: pengecekan nama dan niat harga lewat panggilan model tambahan (menambah biaya tiap pesan), antrean admin, dan arsip Telegram.
- **Tampilan balasan (khusus toko owner):** di halaman chat/widget, tautan di balasan bisa diklik; URL yang berdiri sendiri di satu baris diberi ikon (toko, pelacak, verifikasi, blog, bantuan, ulasan) dan baris penutup `<label>: https://wa.me/...` ditampilkan sebagai tombol hijau. Label tombol mengikuti bahasa pesan pengunjung (Indonesia, Inggris, Italia, Spanyol, Prancis, Arab, Jerman, Rusia; bahasa lain Inggris; tidak terdeteksi Indonesia). Penandanya `cfg.portal` dari `lib/gayaPortal.js` (gerbang yang sama dengan otak: `ADMIN_EMAILS` + saklar; hanya true/false). Toko lain tetap teks biasa. Di Telegram/WhatsApp balasannya teks biasa dengan label yang sama.
- **Sapaan:** otak mengira pengunjung sudah melihat sapaan pembuka. Samakan kolom Sapaan di dashboard > Asisten AI dengan sapaan portal (mis. "Halo, saya asisten AI EMAHAIRSHOP. Ada yang bisa saya bantu?").
- **Tes:** `node tests/otak.test.js` (juga dijalankan `npm test`).

## Otak isengin.site (otak ketiga)

Ada **tiga otak terpisah**, dan satu toko hanya memakai satu:

| Otak | Dipakai oleh | Pengetahuan dari |
|---|---|---|
| EMAHAIRSHOP (`lib/otak.js`) | toko milik email di `ADMIN_EMAILS` | teks otak EMAHAIRSHOP |
| Info situs Asisten Toko (`lib/pengetahuan.js`) | toko widget situs, env `WIDGET_BOT` | data toko + info paket/fitur otomatis (pola lama, tidak berubah) |
| **isengin.site** (`lib/otakIsengin.js`) | toko dengan slug di env `ISENGIN_BOT` | teks otak isengin |

Otak isengin menjawab calon pengguna dan pengguna web isengin.site (link-in-bio): apa itu isengin, cara daftar dan memakai dashboard, Gratis vs Pro, harga, domain kustom, centang, referral, dan kendala umum. Tidak ada tombol WhatsApp, tautan price list, atau gaya portal.

- **Pasang:** buat toko di dashboard Asisten Toko untuk isengin.site (nama, jam, sapaan, nada; produk/FAQ tidak dipakai), isi env `ISENGIN_BOT` dengan slug tokonya, Redeploy, lalu di Pasang daftarkan domain `isengin.site` dan tempel kode widgetnya di web isengin. `ISENGIN_BOT` tidak boleh sama dengan `WIDGET_BOT` (kalau sama, `WIDGET_BOT` menang dan kartu di `/admin/ai` memberi peringatan). Toko ISENGIN_BOT milik admin layanan tetap memakai otak ini, bukan otak EMAHAIRSHOP.
- **Tampilan widget (gaya Neo):** toko `ISENGIN_BOT` otomatis memakai gaya Neo yang sama dengan isengin-link: kuning `#ffd23f`, navy `#1f2255`, krem `#fffbe8`, merah `#ff5a43`, garis 3px dan bayangan keras, huruf Bungee dan Plus Jakarta Sans. Berlaku untuk tombol, pesan pop-up, jendela chat, dan halaman chat. Warna aksen, bentuk bubble, dan tema gelap dari dashboard tidak dipakai di toko ini; posisi, ukuran, label, ikon, pesan pop-up, dan animasi tetap bisa diatur di dashboard. Kodenya: `lib/gayaNeo.js` (halaman chat), `public/widget.js` (tombol dan jendela), diuji di `tests/gayaNeo.test.js`.
- **Teks otak:** bawaan di `lib/otak.isengin.template.js` (ditulis dari kode proyek isengin-link: fitur, aturan Gratis/Pro, centang, referral, domain kustom). Admin bisa menggantinya di `/admin/ai` > Otak isengin.site, lengkap dengan saklar, "Batalkan perubahan terakhir", dan "Kembalikan ke bawaan".
- **Harga Pro:** ditulis di teks sebagai `{{PRO_BULAN}}` dan `{{PRO_TAHUN}}`, diisi server dari env `ISENGIN_PRO_PRICE_MONTH` dan `ISENGIN_PRO_PRICE_YEAR` (bawaan 29000 dan 290000, sama dengan bawaan isengin-link). **Kalau harga Pro di isengin-link diubah, ubah dua env ini juga.** Fitur lain di teks otak perlu diperbarui manual kalau isengin-link berubah.
- **Penanda:** `[[HUMAN]]` (serahkan ke admin + notifikasi), `[[LEAD: ...]]` (calon pembeli serius; kontak hanya dari pesan pengunjung, bukan karangan model), `[[NAME: ...]]`, `[[UNKNOWN: ...]]`, `[[OFFTOPIC]]`. Jaring pengaman "minta admin" lebih ketat daripada otak EMAHAIRSHOP supaya pertanyaan seperti "apakah admin yang menyetujui centang?" tidak salah dianggap permintaan bicara dengan admin.
- **Bahasa:** sama dengan otak EMAHAIRSHOP (bahasa pesan terakhir dideteksi di server; balasan Indonesia untuk pengunjung berbahasa lain dicoba sekali lagi).
- **Tanpa migrasi database.** Pengaturan disimpan di `app_settings` (`OTAK_ISENGIN_MODE`, `OTAK_ISENGIN_TEMPLATE`, `OTAK_ISENGIN_TEMPLATE_PREV`).
- **Tes:** `node tests/otak.isengin.test.js` (juga dijalankan `npm test`).

## Catatan Gemini

Model per paket diatur admin di menu **AI** (`/admin/ai`), bersama API key Gemini (tersimpan terenkripsi, tanpa deploy ulang). Tiap paket (Gratis, Starter, Bisnis) bisa punya sampai 3 API key sendiri. Key dipakai bergantian supaya beban terbagi, dan kalau satu key kena limit (429), ditolak, atau server Gemini error, bot otomatis mencoba key berikutnya. Paket tanpa key sendiri memakai key bawaan. Paket yang modelnya dikosongkan memakai `GEMINI_MODEL` (default `gemini-3.5-flash-lite`); toko tanpa langganan aktif memakai model paket Gratis. Nama model dan parameter yang didukung bisa berubah, jadi cek dokumentasi Google sebelum meluncur. Untuk model Gemini 3.x, `lib/gemini.js` sengaja tidak mengirim `temperature`, `top_p`, atau `top_k`.

## Logo, jam operasional, dan jarak tombol widget

**Persiapan database (sekali):** jalankan `supabase/migrations/widget_logo_jam_offset.sql` di Supabase SQL Editor **sebelum** deploy (aman dijalankan ulang; setelah `tampilan_widget.sql`). Kalau belum dijalankan, menyimpan di halaman Asisten AI akan gagal karena kolom barunya belum ada.

- **Logo toko**: diunggah di Asisten AI > Tampilan chat. Gambar dipotong persegi, dikecilkan, lalu disimpan sebagai data URL di `shops.widget_logo` (maks. 60 KB), jadi tidak perlu storage terpisah. Hanya dipakai sebagai avatar di header jendela chat (tombol widget tetap memakai ikon emoji); kalau gagal dimuat, kembali ke ikon.
- **Jam operasional**: status header ("Admin online", "Admin offline, buka besok 09:00") dihitung di browser pelanggan memakai zona waktu toko. Mendukung jam yang melewati tengah malam. Asisten tetap membalas otomatis di luar jam. "Admin biasanya balas dalam X menit" tampil kalau `reply_eta` > 0.
- **Jarak tombol**: `widget_ox` (samping) dan `widget_oy` (bawah), 0 sampai 200 px. Jendela chat dan pop-up ikut bergeser.
- **Pratinjau jendela chat** di dashboard adalah halaman chat asli (`/chat/slug?preview=1`) yang menerima pengaturan yang belum disimpan lewat `postMessage`. Mode pratinjau tidak mengirim pesan ke server.
- Mode gelap manual sudah dihapus. Halaman chat tetap mengikuti tema terang/gelap dari sistem pelanggan.
- **Bentuk bubble pesan** (bulat, kotak, lancip): jalankan juga `supabase/migrations/widget_bubble.sql` sebelum deploy. Diatur di Asisten AI > Tampilan chat, tersimpan di `shops.widget_bubble`.

## Aturan tampil widget per halaman

Diatur pemilik toko di **Pasang > Halaman tampil** (langkah 3), lalu diuji lewat pratinjau di langkah 4 (Cek pemasangan). Berlaku di website klien tanpa tempel ulang kode (paling lambat sekitar 1 menit).

**Persiapan database (sekali):** jalankan `supabase/migrations/widget_halaman.sql` di Supabase SQL Editor **sebelum** deploy (aman dijalankan ulang). Menambah `shops.widget_hide_checkout`, `widget_paths_mode`, `widget_paths`. Kalau belum dijalankan, bagian ini tampil nonaktif dan menyimpan pengaturan lain tetap jalan; tetapi widget sudah menyembunyikan diri di halaman checkout secara bawaan.

- **Sembunyikan di checkout dan pembayaran** (bawaan aktif): dikenali per segmen alamat (`checkout`, `checkouts`, `cart`, `keranjang`, `payment`, `payments`, `pembayaran`, `bayar`), jadi `/id/checkout/langkah-2` ikut tersembunyi.
- **Aturan tambahan**: semua halaman, sembunyikan di halaman tertentu, atau tampil hanya di halaman tertentu. Satu alamat per baris, `*` berarti apa saja di bawahnya (`/akun/*` mencakup `/akun`), tanpa `*` hanya cocok persis. Maksimal 20 alamat. Aturan checkout selalu menang.
- Situs SPA/Shopify yang berpindah halaman tanpa reload dipantau lewat `pushState`/`replaceState`, `popstate`, dan pengecekan tiap detik; kalau chat sedang terbuka lalu pengunjung masuk ke halaman tersembunyi, chat ditutup.
- Logika pencocokan ada di `public/widget.js` (blok `@paths-begin`), pembersihan alamat di `lib/widgetPaths.js`, dites di `tests/widget.test.js`.

