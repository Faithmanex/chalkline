import test from 'node:test';
import assert from 'node:assert/strict';
import C from './canvas.js';
import D from './domain.js';

test('distance to a segment is measured to the segment, not the infinite line', () => {
  assert.equal(Math.round(C.distToSegment(5, 5, 0, 0, 10, 0)), 5);
  assert.equal(C.distToSegment(-4, 0, 0, 0, 10, 0), 4);
  assert.equal(C.distToSegment(13, 4, 0, 0, 10, 0), 5);
  assert.equal(Math.round(C.distToSegment(4, 3, 0, 0, 10, 0)), 3);
});

test('simplify keeps shape but drops near-duplicate points', () => {
  const points = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0.2 },
    { x: 40, y: 0 },
    { x: 41, y: 1 },
  ];
  const out = C.simplify(points, 3);
  assert.deepEqual(out, [{ x: 0, y: 0 }, { x: 40, y: 0 }]);
  assert.equal(C.simplify([], 3).length, 0);
});

test('hit testing finds the stroke under the chalk and the pin on the body', () => {
  const strokes = [
    { tool: 'pen', points: [{ x: 100, y: 100 }, { x: 300, y: 100 }], width: 3 },
    { tool: 'text', x: 500, y: 500, text: 'lengthen hem' },
  ];
  assert.equal(C.hitTest(strokes, 200, 104, 10), 0);
  assert.equal(C.hitTest(strokes, 200, 140, 10), -1);
  assert.equal(C.hitTest(strokes, 520, 490, 10), 1);
  const pins = [{ tool: 'pin', x: 400, y: 400 }];
  assert.equal(C.hitTest(pins, 405, 402, 10), 0);
});

test('bounds cover strokes, text and pins', () => {
  const b = C.boundsOf([
    { tool: 'pen', points: [{ x: 10, y: 20 }, { x: 50, y: 60 }] },
    { tool: 'pin', x: 5, y: 5 },
  ]);
  assert.deepEqual({ minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY }, { minX: 5, minY: 5, maxX: 50, maxY: 60 });
  assert.equal(C.boundsOf([]), null);
});

test('every garment outline paints inside the 1000 x 1400 sheet', () => {
  for (const key of D.GARMENT_KEYS) {
    const def = D.GARMENTS[key];
    for (const path of def.outline || []) {
      const nums = path.match(/-?\d+(\.\d+)?/g).map(Number);
      for (const n of nums) assert.ok(n >= 0 && n <= 140, key + ' outline coordinate out of range: ' + n);
    }
    for (const f of def.fields) {
      assert.ok(f.pt[0] > 0 && f.pt[0] < 100 && f.pt[1] > 0 && f.pt[1] < 140, key + '.' + f.key + ' point out of range');
    }
  }
});

test('measurement pins resolve to real labels and values', () => {
  const state = D.blankState();
  const client = D.newClient({ name: 'Ayesha', phone: '0300' });
  D.saveMeasurement(client.people[0], 'dress', 'in', { bust: 38 }, 'Bilal');
  const set = client.people[0].measures.dress;
  const list = D.GARMENTS.dress.fields.map((f) => ({
    key: f.key,
    label: f.label,
    value: set.values[f.key] != null ? D.length(set.values[f.key], set.unit) : '—',
  }));
  assert.equal(list.find((m) => m.key === 'bust').value, '38"');
  assert.equal(list.find((m) => m.key === 'waist').value, '—');
});
