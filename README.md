# Asisten Toko - chatbot untuk UMKM

Web lengkap: dashboard klien, halaman chat, dan widget yang ditempel di website klien.
Stack: Vercel (halaman statis + fungsi di `api/`), Supabase (login + database), Gemini (jawaban AI).
Tidak ada langkah build dan tidak ada framework.

## Cara kerja

```
Website klien --(widget.js)--> iframe https://DOMAINMU/chat/slug-toko
                                  |  POST /api/chat
                                  v
                api/chat.js -> lib/bot.js -> Supabase (data toko, riwayat) + Gemini
Pemilik toko  --> /dashboard.html --> Supabase langsung (dibatasi RLS)
```

Pelanggan tidak pernah menyentuh database. Semua lewat `api/chat.js` yang memakai service role key (hanya ada di server).

## Pasang (sekitar 20 menit)

1. **Supabase**: buat project. Buka SQL Editor, tempel isi `supabase/schema.sql`, Run.
   - Authentication > Providers > Email: untuk uji coba, matikan "Confirm email" (atau biarkan aktif dan pastikan Site URL diisi domainmu).
   - Authentication > URL Configuration: isi Site URL dengan domainmu.
2. **Gemini**: buat API key di Google AI Studio.
3. **Vercel**: import folder ini sebagai project (Framework: Other). Isi Environment Variables seperti di `.env.example`:
   `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL` (opsional).
4. **Domain**: tambahkan domain, misalnya `chat.isengin.site`, di Vercel > Settings > Domains lalu arahkan DNS-nya.
5. Buka `/login.html#daftar`, buat akun, buat toko, isi produk dan FAQ, lalu buka tab **Pasang**.

Uji lokal: `npm i -g vercel`, lalu `vercel dev` (butuh `.env`).
Tes otomatis otak bot: `npm test` (tanpa jaringan).

## Struktur folder

```
api/chat.js        POST pesan pelanggan, GET polling balasan admin
api/embed.js       menyajikan /chat/:slug + header CSP frame-ancestors per toko
api/config.js      memberi URL dan anon key Supabase ke browser
lib/bot.js         alur percakapan, batas laju, batas harian, prompt, handoff
lib/gemini.js      pemanggil Gemini (model dari env GEMINI_MODEL)
lib/domains.js     validasi domain dan pembuat CSP
lib/chat.html      halaman chat pelanggan
public/            beranda, login, dashboard, widget.js, style.css
supabase/schema.sql tabel, indeks, dan aturan keamanan (RLS)
tests/bot.test.js  13 tes untuk otak bot
```

## Keamanan: yang sudah ada dan batasnya

- **RLS di semua tabel.** Pemilik toko hanya bisa membaca dan mengubah data tokonya. Pelanggan (anon) tidak punya akses langsung.
- **Service role key hanya di `api/` dan `lib/`.** Jangan pernah menaruhnya di `public/`.
- **Domain yang diizinkan** dipaksa lewat header CSP `frame-ancestors`: browser menolak menampilkan chat di situs lain. Ini mencegah orang menempelkan botmu di situs mereka lewat browser. Ini tidak menghentikan orang yang memanggil `/api/chat` langsung (curl), karena header bisa dipalsukan.
- **Pengaman biaya yang sebenarnya:** batas 8 pesan per menit per percakapan, 60 per menit per toko, dan batas balasan bot per hari per toko (atur di tab Bot). Setelah batas tercapai, pesan masuk ke admin tanpa memanggil Gemini.
- **Prompt injection:** pesan pelanggan hanya masuk sebagai giliran user, dan prompt menyuruh bot menjawab hanya dari data toko. Ini mengurangi risiko, bukan menghilangkannya. Karena itu bot tidak diberi kemampuan mengubah harga, stok, atau pesanan; admin yang mengonfirmasi pesanan.
- **Privasi:** pesan pelanggan disimpan di databasemu, dan halaman chat memberi tahu hal itu. Sebelum jualan ke klien, siapkan kebijakan privasi dan perjanjian pemrosesan data sederhana.
- Library Supabase di halaman login/dashboard dimuat dari CDN dengan versi dipin. Untuk lebih aman, simpan filenya di `public/vendor/` dan ganti `src`-nya.

## Yang belum ada (tahap berikutnya)

- **Pembayaran langganan** (Midtrans/Xendit). Saat ini belum ada kolom paket atau kuota bulanan; aktivasi klien dilakukan manual.
- **Telegram dan WhatsApp.** `lib/bot.js` sudah dipisah dari halaman web, jadi tinggal dibuatkan endpoint webhook yang memanggil `handleMessage`.
- **Banyak toko per akun** (sekarang satu akun satu toko) dan peran admin tambahan.
- **Notifikasi** saat ada percakapan butuh admin (email atau Telegram). Dashboard sekarang polling tiap 10 detik.
- **Realtime** pengganti polling kalau pengguna sudah banyak.
- **Pencarian produk besar.** Sekarang maksimal 100 produk dan 100 FAQ dikirim ke prompt. Di atas itu perlu pencarian dulu.

## Catatan Gemini

Model dibaca dari `GEMINI_MODEL` (default `gemini-3.5-flash-lite`). Nama model dan parameter yang didukung bisa berubah, jadi cek dokumentasi Google sebelum meluncur. Untuk model Gemini 3.x, `lib/gemini.js` sengaja tidak mengirim `temperature`, `top_p`, atau `top_k`.
