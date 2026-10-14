/* Kerangka pemuatan (skeleton). Tidak butuh pustaka, animasinya ada di globals.css (.sk). */

export function Sk({ w = '100%', h = 14, r, style }) {
  return <span className="sk" aria-hidden="true" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

function Status({ children }) {
  return (
    <div role="status" aria-busy="true">
      {children}
      <span className="sr">Memuat...</span>
    </div>
  );
}

// Baris daftar percakapan (judul + cuplikan + label status).
export function SkConvRows({ rows = 5 }) {
  return (
    <Status>
      {Array.from({ length: rows }, (_, i) => (
        <div className="li" key={i}>
          <div className="t">
            <Sk w={i % 2 ? '48%' : '58%'} h={15} />
            <Sk w={i % 2 ? '70%' : '84%'} h={12} style={{ marginTop: 8 }} />
          </div>
          <Sk w={84} h={24} r={999} />
        </div>
      ))}
    </Status>
  );
}

// Kotak item produk (3 kolom + deskripsi) atau FAQ (pertanyaan + jawaban).
export function SkItems({ rows = 3, variant = 'produk' }) {
  return (
    <Status>
      {Array.from({ length: rows }, (_, i) => (
        <div className="item" key={i}>
          {variant === 'produk' ? (
            <>
              <div className="grid3"><Sk h={42} r={10} /><Sk h={42} r={10} /><Sk h={42} r={10} /></div>
              <Sk h={42} r={10} style={{ marginTop: 8 }} />
              <Sk w={90} h={14} style={{ marginTop: 14 }} />
            </>
          ) : (
            <>
              <Sk h={42} r={10} />
              <Sk h={74} r={10} style={{ marginTop: 8 }} />
              <Sk w={64} h={28} r={10} style={{ marginTop: 12 }} />
            </>
          )}
        </div>
      ))}
    </Status>
  );
}

// Gelembung chat saat riwayat pesan dimuat.
export function SkMsgs() {
  const rows = [['left', '62%'], ['right', '48%'], ['left', '38%'], ['right', '70%']];
  return (
    <Status>
      <div className="msgs" style={{ overflow: 'hidden' }}>
        {rows.map(([side, w], i) => (
          <Sk key={i} w={w} h={i % 2 ? 52 : 40} r={16} style={{ alignSelf: side === 'left' ? 'flex-start' : 'flex-end' }} />
        ))}
      </div>
    </Status>
  );
}

// Bilah pemakaian di tab Bot.
export function SkUsage() {
  return (
    <Status>
      <Sk w="46%" h={14} />
      <Sk h={10} r={999} style={{ margin: '10px 0 8px' }} />
    </Status>
  );
}

// Menu sidebar saat sesi dan data toko dimuat.
export function SkNav({ rows = 6 }) {
  return (
    <div className="sk-gap" style={{ padding: '4px 4px' }} role="status" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => <Sk key={i} h={38} r={10} />)}
      <span className="sr">Memuat...</span>
    </div>
  );
}
