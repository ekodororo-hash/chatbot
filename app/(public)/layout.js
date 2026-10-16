// Layout khusus halaman publik (landing page saja — grup route ini tidak memengaruhi URL).
// Widget chat sengaja ditaruh di sini, BUKAN di root layout.js, supaya tidak ikut
// muncul di /admin, /dashboard, /login, atau /chat/[slug].
export default function PublicLayout({ children }) {
  return (
    <>
      {children}
      {/* Chat widget untuk situs ini sendiri. Isi WIDGET_BOT di env dengan slug toko yang dipakai (mis. emahairshop). Kosong = tidak tampil. */}
      {/^[a-z0-9-]{3,30}$/.test(process.env.WIDGET_BOT || '') ? (
        <script src="/widget.js" data-bot={process.env.WIDGET_BOT} defer />
      ) : null}
    </>
  );
}
