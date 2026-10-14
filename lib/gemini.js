'use strict';

// Model bisa diganti lewat env GEMINI_MODEL tanpa mengubah kode.
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

// Catatan: model Gemini 3.x tidak menerima temperature/top_p/top_k, dan giliran
// terakhir di "contents" harus dari user dengan teks tidak kosong.
async function generate({ system, contents }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY belum diatur');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
      encodeURIComponent(MODEL) + ':generateContent';
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 1024 }
      }),
      signal: ctrl.signal
    });
    if (!r.ok) throw new Error('Gemini ' + r.status + ': ' + (await r.text()).slice(0, 300));
    const d = await r.json();
    const parts = (d.candidates && d.candidates[0] && d.candidates[0].content &&
      d.candidates[0].content.parts) || [];
    return parts.filter(p => !p.thought && typeof p.text === 'string').map(p => p.text).join('').trim();
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { generate, MODEL };
