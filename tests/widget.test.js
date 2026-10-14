'use strict';
// Jalankan: node tests/widget.test.js
const assert = require('assert');
const wc = require('../lib/widgetConfig');

const d = wc.clean({});
assert.deepStrictEqual(d, { color: '#0b7a75', pos: 'right', icon: '\uD83D\uDCAC', label: '', teaser: '', size: 'sedang', shape: 'bulat' });

const c = wc.clean({ accent: '#ff0000', widget_pos: 'left', widget_icon: ' \uD83D\uDED2 ', widget_label: 'Tanya kami', widget_teaser: 'Halo!', widget_size: 'besar', widget_shape: 'kotak' });
assert.strictEqual(c.color, '#ff0000');
assert.strictEqual(c.pos, 'left');
assert.strictEqual(c.icon, '\uD83D\uDED2');
assert.strictEqual(c.size, 'besar');
assert.strictEqual(c.shape, 'kotak');

// nilai rusak jatuh ke default, teks dipotong
const bad = wc.clean({ accent: 'red', widget_pos: 'top', widget_size: 'raksasa', widget_shape: 'x', widget_label: 'a'.repeat(100), widget_icon: '' });
assert.strictEqual(bad.color, '#0b7a75');
assert.strictEqual(bad.pos, 'right');
assert.strictEqual(bad.size, 'sedang');
assert.strictEqual(bad.shape, 'bulat');
assert.strictEqual(bad.label.length, 30);
assert.strictEqual(bad.icon, '\uD83D\uDCAC');
console.log('widget config ok');
