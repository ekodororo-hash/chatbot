import './globals.css';

export const metadata = {
  title: { default: 'Asisten Toko - Asisten AI untuk UMKM', template: '%s - Asisten Toko' },
  description: 'Asisten AI yang menjawab pertanyaan pelanggan dari data tokomu, 24 jam. Pasang di website dengan satu baris kode.'
};

export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400..600&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
        {/* Chat widget untuk situs ini sendiri. Isi WIDGET_BOT di env dengan slug toko yang dipakai (mis. emahairshop). Kosong = tidak tampil. */}
        {/^[a-z0-9-]{3,30}$/.test(process.env.WIDGET_BOT || '') ? <script src="/widget.js" data-bot={process.env.WIDGET_BOT} defer /> : null}
      </body>
    </html>
  );
}
