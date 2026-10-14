/** @type {import('next').NextConfig} */
const noFrame = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'same-origin' }
];

module.exports = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/widget.js', headers: [{ key: 'Cache-Control', value: 'public, max-age=300' }] },
      // Dashboard dan login tidak boleh dipasang di iframe situs lain.
      { source: '/login', headers: noFrame },
      { source: '/dashboard/:path*', headers: noFrame }
    ];
  }
};
