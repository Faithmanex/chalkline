/*!
 * Chalkline — the design board.
 * A pattern-paper canvas where the tailor sketches over a garment outline,
 * pins the client's measurements onto the body, and exports the sheet to print.
 *
 * Strokes are stored as vectors in a fixed 1000 x 1400 space, so a saved board
 * looks identical in the app, in an export and on a ticket.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ChalklineCanvas = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const W = 1000;
  const H = 1400;

  /* ------------------------------------------------------------------ geometry */

  function distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = dx * dx + dy * dy;
    let t = len === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len;
    t = Math.max(0, Math.min(1, t));
    const cx = x1 + t * dx;
    const cy = y1 + t * dy;
    return Math.hypot(px - cx, py - cy);
  }

  /** Drops points closer than `min` logical px — keeps sketches light to store. */
  function simplify(points, min) {
    const gap = min == null ? 3 : min;
    const out = [];
    for (const p of points) {
      const last = out[out.length - 1];
      if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= gap) out.push({ x: p.x, y: p.y });
    }
    return out;
  }

  function hitTest(strokes, x, y, tolerance) {
    const tol = tolerance == null ? 12 : tolerance;
    for (let i = strokes.length - 1; i >= 0; i--) {
      const s = strokes[i];
      if (s.tool === 'text') {
        if (Math.abs(x - s.x) < 120 && y > s.y - 34 && y < s.y + 12) return i;
        continue;
      }
      if (s.tool === 'pin') {
        if (Math.hypot(x - s.x, y - s.y) < 26) return i;
        continue;
      }
      for (let k = 1; k < s.points.length; k++) {
        const a = s.points[k - 1];
        const b = s.points[k];
        if (distToSegment(x, y, a.x, a.y, b.x, b.y) <= tol + (s.width || 3) / 2) return i;
      }
    }
    return -1;
  }

  function boundsOf(items) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const eat = (x, y) => {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    };
    for (const s of items || []) {
      if (s.tool === 'text' || s.tool === 'pin') eat(s.x, s.y);
      for (const p of s.points || []) eat(p.x, p.y);
    }
    if (minX === Infinity) return null;
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }

  /* -------------------------------------------------------------------- paint */

  const PALETTE = {
    ink: '#1b1813',
    red: '#b23a2c',
    blue: '#2f5f8f',
    chalk: '#c99a2e',
    green: '#22624a',
  };

  function roundRect(ctx, x, y, w, h, r) {
    const rad = Math.min(r, h / 2, w / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }

  function drawArrowHead(ctx, from, to, size) {
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const s = size || 16;
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x - s * Math.cos(angle - 0.42), to.y - s * Math.sin(angle - 0.42));
    ctx.lineTo(to.x - s * Math.cos(angle + 0.42), to.y - s * Math.sin(angle + 0.42));
    ctx.closePath();
    ctx.fill();
  }

  /* --------------------------------------------------------------------- board */

  function createBoard(canvas, options) {
    const opts = options || {};
    const garmentDef = opts.garmentDef || function () { return null; };
    const ctx = canvas.getContext('2d');

    let state = {
      template: opts.template || 'shirt',
      showGrid: true,
      strokes: [],
      pins: [],
    };
    let tool = 'pen';
    let colour = PALETTE.ink;
    let width = 3;
    let pinField = null;
    let measurements = [];
    let live = null;
    let undoStack = [];
    let redoStack = [];
    let onChange = opts.onChange || function () {};
    let onDirty = opts.onDirty || function () {};
    let cssWidth = 0;
    const dpr = Math.min(3, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);

    function setState(next) {
      if (!next) return;
      state = {
        template: next.template || 'shirt',
        showGrid: next.showGrid !== false,
        strokes: Array.isArray(next.strokes) ? next.strokes.slice() : [],
        pins: Array.isArray(next.pins) ? next.pins.slice() : [],
      };
      undoStack = [];
      redoStack = [];
      render();
      onChange(getState());
    }

    function getState() {
      return {
        template: state.template,
        showGrid: state.showGrid,
        strokes: state.strokes,
        pins: state.pins,
      };
    }

    function setTools(t) {
      if (t.tool) tool = t.tool;
      if (t.colour) colour = t.colour;
      if (t.width) width = t.width;
      if (t.pinField !== undefined) pinField = t.pinField;
      if (t.template) {
        state.template = t.template;
        render();
        onChange(getState());
      }
      if (t.showGrid !== undefined) {
        state.showGrid = !!t.showGrid;
        render();
        onChange(getState());
      }
    }

    function setMeasurements(list) {
      measurements = Array.isArray(list) ? list : [];
      render();
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(220, Math.round(rect.width));
      const h = Math.round(w * (H / W));
      cssWidth = w;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.height = h + 'px';
      render();
    }

    function scaleFactor() {
      return canvas.width / W;
    }

    function toLogical(evt) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((evt.clientX - rect.left) / rect.width) * W,
        y: ((evt.clientY - rect.top) / rect.height) * H,
      };
    }

    function pushUndo() {
      undoStack.push(JSON.stringify({ strokes: state.strokes, pins: state.pins }));
      if (undoStack.length > 40) undoStack.shift();
      redoStack = [];
    }

    function undo() {
      if (!undoStack.length) return;
      redoStack.push(JSON.stringify({ strokes: state.strokes, pins: state.pins }));
      const prev = JSON.parse(undoStack.pop());
      state.strokes = prev.strokes;
      state.pins = prev.pins;
      render();
      onChange(getState());
      onDirty();
    }

    function redo() {
      if (!redoStack.length) return;
      undoStack.push(JSON.stringify({ strokes: state.strokes, pins: state.pins }));
      const next = JSON.parse(redoStack.pop());
      state.strokes = next.strokes;
      state.pins = next.pins;
      render();
      onChange(getState());
      onDirty();
    }

    function clear() {
      pushUndo();
      state.strokes = [];
      state.pins = [];
      render();
      onChange(getState());
      onDirty();
    }

    /* ------------------------------------------------------------------ render */

    function paintGrid(c) {
      if (!state.showGrid) return;
      c.save();
      c.strokeStyle = 'rgba(27,24,19,0.055)';
      c.lineWidth = 1.6;
      for (let x = 0; x <= W; x += 50) {
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x, H);
        c.stroke();
      }
      for (let y = 0; y <= H; y += 50) {
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(W, y);
        c.stroke();
      }
      c.strokeStyle = 'rgba(27,24,19,0.10)';
      c.lineWidth = 2;
      for (let x = 0; x <= W; x += 250) {
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x, H);
        c.stroke();
      }
      for (let y = 0; y <= H; y += 250) {
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(W, y);
        c.stroke();
      }
      c.restore();
    }

    function paintFigure(c) {
      const def = garmentDef(state.template);
      const s = 9;
      const ox = (W - 100 * s) / 2;
      const oy = 40;
      c.save();
      c.translate(ox, oy);
      c.scale(s, s);
      // mannequin reference, always faint
      c.strokeStyle = 'rgba(27,24,19,0.22)';
      c.lineWidth = 0.34;
      c.setLineDash([1.6, 2.6]);
      c.beginPath();
      c.arc(50, 13, 6.5, 0, Math.PI * 2);
      c.moveTo(46, 20); c.lineTo(46, 25);
      c.moveTo(54, 20); c.lineTo(54, 25);
      c.moveTo(30, 28); c.quadraticCurveTo(50, 23, 70, 28);
      c.moveTo(30, 28); c.lineTo(26, 52); c.lineTo(27, 74);
      c.moveTo(70, 28); c.lineTo(74, 52); c.lineTo(73, 74);
      c.moveTo(34, 30); c.lineTo(34, 64); c.quadraticCurveTo(50, 69, 66, 64); c.lineTo(66, 30);
      c.moveTo(42, 68); c.lineTo(41, 100); c.lineTo(40, 128);
      c.moveTo(58, 68); c.lineTo(59, 100); c.lineTo(60, 128);
      c.stroke();
      c.setLineDash([]);
      if (def && def.outline) {
        c.strokeStyle = 'rgba(27,24,19,0.34)';
        c.lineWidth = 0.55;
        for (const path of def.outline) {
          c.stroke(new Path2D(path));
        }
      }
      c.restore();
    }

    function paintStroke(c, s) {
      c.save();
      c.strokeStyle = s.colour || PALETTE.ink;
      c.fillStyle = s.colour || PALETTE.ink;
      c.lineWidth = s.width || 3;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      if (s.tool === 'text') {
        c.font = '600 30px Archivo, system-ui, sans-serif';
        const label = String(s.text || '');
        const w = c.measureText(label).width;
        c.fillStyle = 'rgba(251,247,236,0.86)';
        roundRect(c, s.x - 8, s.y - 30, w + 16, 40, 6);
        c.fill();
        c.fillStyle = s.colour || PALETTE.ink;
        c.fillText(label, s.x, s.y);
      } else if (s.tool === 'pin') {
        const m = measurements.find((x) => x.key === s.key);
        const label = m ? m.label + ' ' + m.value : s.label || 'Pin';
        c.font = '600 22px "IBM Plex Mono", ui-monospace, monospace';
        const tw = c.measureText(label).width;
        const boxW = tw + 34;
        const bx = Math.min(W - boxW - 14, Math.max(14, s.x - boxW / 2));
        const by = Math.max(14, s.y - 46);
        c.fillStyle = 'rgba(251,247,236,0.94)';
        roundRect(c, bx, by, boxW, 34, 4);
        c.fill();
        c.strokeStyle = s.colour || PALETTE.red;
        c.lineWidth = 2;
        roundRect(c, bx, by, boxW, 34, 4);
        c.stroke();
        c.beginPath();
        c.moveTo(bx + boxW / 2, by + 34);
        c.lineTo(s.x, s.y);
        c.stroke();
        c.beginPath();
        c.arc(s.x, s.y, 6, 0, Math.PI * 2);
        c.fillStyle = s.colour || PALETTE.red;
        c.fill();
        c.fillStyle = s.colour || PALETTE.red;
        c.font = '600 22px "IBM Plex Mono", ui-monospace, monospace';
        c.fillText(label, bx + 12, by + 23);
      } else if (s.points && s.points.length) {
        c.beginPath();
        c.moveTo(s.points[0].x, s.points[0].y);
        if (s.points.length === 1) {
          c.lineTo(s.points[0].x + 0.1, s.points[0].y);
        } else {
          for (let i = 1; i < s.points.length; i++) c.lineTo(s.points[i].x, s.points[i].y);
        }
        c.stroke();
        if (s.tool === 'arrow') {
          const a = s.points[s.points.length - 2] || s.points[0];
          const b = s.points[s.points.length - 1];
          c.beginPath();
          const angle = Math.atan2(b.y - a.y, b.x - a.x);
          const size = Math.max(14, (s.width || 3) * 5);
          c.moveTo(b.x, b.y);
          c.lineTo(b.x - size * Math.cos(angle - 0.42), b.y - size * Math.sin(angle - 0.42));
          c.lineTo(b.x - size * Math.cos(angle + 0.42), b.y - size * Math.sin(angle + 0.42));
          c.closePath();
          c.fill();
        }
      }
      c.restore();
    }

    function render() {
      if (!canvas.width) return;
      const k = scaleFactor();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(k, 0, 0, k, 0, 0);
      ctx.fillStyle = '#fbf7ec';
      ctx.fillRect(0, 0, W, H);
      paintGrid(ctx);
      paintFigure(ctx);
      for (const s of state.strokes) paintStroke(ctx, s);
      for (const p of state.pins) paintStroke(ctx, Object.assign({ tool: 'pin' }, p));
      if (live) paintStroke(ctx, live);
    }

    /* -------------------------------------------------------------- interaction */

    function strokeWidthForTool() {
      if (tool === 'pen') return width;
      if (tool === 'line' || tool === 'arrow') return width;
      return width;
    }

    function pointerDown(e) {
      if (e.button != null && e.button !== 0) return;
      e.preventDefault();
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
      const p = toLogical(e);

      if (tool === 'erase') {
        const idx = hitTest(state.strokes.concat(state.pins.map((pin) => Object.assign({ tool: 'pin' }, pin))), p.x, p.y, 18);
        const total = state.strokes.length;
        if (idx > -1 && idx < total) {
          pushUndo();
          state.strokes.splice(idx, 1);
        } else if (idx >= total) {
          pushUndo();
          state.pins.splice(idx - total, 1);
        }
        render();
        onChange(getState());
        onDirty();
        return;
      }

      if (tool === 'text') {
        const text = typeof window !== 'undefined' && window.prompt ? window.prompt('Note for the cutter:', '') : '';
        if (text && text.trim()) {
          pushUndo();
          state.strokes.push({ tool: 'text', x: p.x, y: p.y, text: text.trim().slice(0, 60), colour: colour, width: 2 });
          render();
          onChange(getState());
          onDirty();
        }
        return;
      }

      if (tool === 'pin') {
        pushUndo();
        const m = measurements.find((x) => x.key === pinField) || measurements[0];
        state.pins.push({ x: p.x, y: p.y, key: m ? m.key : '', colour: PALETTE.red });
        render();
        onChange(getState());
        onDirty();
        return;
      }

      pushUndo();
      live = {
        tool: tool === 'line' || tool === 'arrow' ? tool : 'pen',
        points: [{ x: p.x, y: p.y }],
        colour: colour,
        width: strokeWidthForTool(),
      };
      render();
    }

    function pointerMove(e) {
      if (!live) return;
      const p = toLogical(e);
      if (live.tool === 'pen') {
        const last = live.points[live.points.length - 1];
        if (Math.hypot(p.x - last.x, p.y - last.y) >= 2.2) live.points.push({ x: p.x, y: p.y });
      } else {
        live.points[1] = { x: p.x, y: p.y };
      }
      render();
    }

    function pointerUp(e) {
      if (!live) return;
      const s = live;
      live = null;
      if (s.tool === 'pen') s.points = simplify(s.points, 3);
      const last = s.points[s.points.length - 1];
      const first = s.points[0];
      const tiny = s.tool === 'pen' ? s.points.length < 2 : Math.hypot(last.x - first.x, last.y - first.y) < 8;
      if (tiny) {
        if (undoStack.length) undoStack.pop(); // nothing drawn, drop the snapshot
        render();
        return;
      }
      state.strokes.push(s);
      render();
      onChange(getState());
      onDirty();
    }

    canvas.addEventListener('pointerdown', pointerDown);
    canvas.addEventListener('pointermove', pointerMove);
    canvas.addEventListener('pointerup', pointerUp);
    canvas.addEventListener('pointercancel', pointerUp);
    canvas.addEventListener('pointerleave', function (e) {
      if (live && e.buttons === 0) pointerUp(e);
    });

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(function () { resize(); });
      ro.observe(canvas.parentElement || canvas);
    }

    /* ------------------------------------------------------------------ export */

    function toPNG(scale) {
      const k = scale || 2;
      const out = document.createElement('canvas');
      out.width = W * k;
      out.height = H * k;
      const c = out.getContext('2d');
      c.setTransform(k, 0, 0, k, 0, 0);
      c.fillStyle = '#fbf7ec';
      c.fillRect(0, 0, W, H);
      paintGrid(c);
      paintFigure(c);
      for (const s of state.strokes) paintStroke(c, s);
      for (const p of state.pins) paintStroke(c, Object.assign({ tool: 'pin' }, p));
      return out.toDataURL('image/png');
    }

    return {
      setState,
      getState,
      setTools,
      setMeasurements,
      resize,
      render,
      undo,
      redo,
      clear,
      toPNG,
      canUndo: function () { return undoStack.length > 0; },
      canRedo: function () { return redoStack.length > 0; },
      stats: function () { return { strokes: state.strokes.length, pins: state.pins.length }; },
      destroy: function () {
        canvas.removeEventListener('pointerdown', pointerDown);
        canvas.removeEventListener('pointermove', pointerMove);
        canvas.removeEventListener('pointerup', pointerUp);
        canvas.removeEventListener('pointercancel', pointerUp);
      },
    };
  }

  /** Renders a saved design to a PNG data URL without needing a mounted board. */
  function renderPNG(design, options) {
    const o = options || {};
    const tmp = document.createElement('canvas');
    tmp.width = W;
    tmp.height = H;
    const board = createBoard(tmp, { garmentDef: o.garmentDef, template: design.template });
    board.setMeasurements(o.measurements || []);
    board.setState(design);
    const url = board.toPNG(o.scale || 2);
    board.destroy();
    return url;
  }

  return { W, H, PALETTE, createBoard, renderPNG, distToSegment, simplify, hitTest, boundsOf };
});
