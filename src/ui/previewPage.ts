// ---------- 成品预览页: 包型 + 双光源 + 截图 ----------
import type { AppCtx } from '../main';
import { el, button, slider, selectBox, toast } from './components';
import { makeBag, BagKind, BAG_NAMES } from '../geom/bags';
import { Light } from '../render/renderer';
import { materialOptions } from './library';

export function renderPreview(root: HTMLElement, ctx: AppCtx): void {
  const wrap = el('div', 'page-pad preview-layout');
  root.append(wrap);

  if (!ctx.materials.length) {
    wrap.append(el('div', 'empty', '请先在皮料库新建皮料'));
    return;
  }
  let m = ctx.current() ?? ctx.materials[0];
  let bagKind: BagKind = 'tote';
  let autoRotate = false;

  // 页面专属相机位
  ctx.renderer.camera.yaw = 0.6;
  ctx.renderer.camera.pitch = 0.35;
  ctx.renderer.camera.dist = 1.1;
  ctx.renderer.camera.target = [0, 0.18, 0];

  // ---- 面板 ----
  const panel = el('div', 'panel');
  panel.append(el('h3', '', '成品预览'));
  panel.append(selectBox('皮料', materialOptions(ctx), m.id, (v) => {
    m = ctx.materials.find((x) => x.id === v)!;
    ctx.setCurrent(m.id);
    updateInfo();
  }));
  panel.append(selectBox<BagKind>('包型', [
    ['tote', BAG_NAMES.tote], ['boston', BAG_NAMES.boston], ['clutch', BAG_NAMES.clutch],
  ], bagKind, (v) => {
    bagKind = v;
    ctx.renderer.camera.target = v === 'boston' ? [0, 0, 0] : [0, 0.18, 0];
    ensureMesh();
  }));
  const info = el('div', 'hint');
  panel.append(info);

  // 光源控制
  panel.append(el('h4', '', '光源 (拖动圆盘调整方向)'));
  const lightAreas: HTMLElement[] = [];
  ctx.renderer.lights.forEach((light, i) => {
    const box = el('div', 'light-box');
    const title = el('div', 'light-title',
      `${light.kind === 'spot' ? '柜台射灯' : '日光'}`);
    const toggle = el('input') as HTMLInputElement;
    toggle.type = 'checkbox';
    toggle.checked = light.enabled;
    toggle.addEventListener('change', () => { light.enabled = toggle.checked; });
    title.append(toggle);
    const dial = makeDial(light);
    const inten = slider({
      label: '强度', min: 0, max: 3, step: 0.05, value: light.intensity,
      format: (v) => v.toFixed(2), onInput: (v) => { light.intensity = v; },
    });
    box.append(title, dial, inten);
    lightAreas.push(box);
    panel.append(box);
    void i;
  });

  const rotateRow = el('div', 'btn-row');
  const rotBtn = button('自动旋转: 关', () => {
    autoRotate = !autoRotate;
    rotBtn.textContent = `自动旋转: ${autoRotate ? '开' : '关'}`;
  }, 'btn btn-sm btn-ghost');
  rotateRow.append(rotBtn);
  panel.append(rotateRow);

  panel.append(button('📷 截图 (带皮料编号)', () => screenshot(), 'btn'));

  // ---- 3D 视图 ----
  const viewWrap = el('div', 'view-wrap');
  const canvas = el('canvas', 'view3d') as HTMLCanvasElement;
  viewWrap.append(canvas);
  wrap.append(panel, viewWrap);

  const meshCache = new Map<BagKind, ReturnType<typeof makeBag>>();
  function ensureMesh() {
    if (!meshCache.has(bagKind)) meshCache.set(bagKind, makeBag(bagKind));
    ctx.renderer.uploadMesh(`preview-${bagKind}`, meshCache.get(bagKind)!);
  }
  ensureMesh();

  function updateInfo() { info.textContent = `${m.name} · ${m.id}`; }
  updateInfo();

  // 交互
  let dragging = false, lastX = 0, lastY = 0;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    ctx.renderer.camera.rotate(e.clientX - lastX, e.clientY - lastY);
    lastX = e.clientX; lastY = e.clientY;
  });
  canvas.addEventListener('pointerup', () => { dragging = false; });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    ctx.renderer.camera.zoom(e.deltaY);
  }, { passive: false });

  function screenshot() {
    // 先渲染一帧保证缓冲最新
    drawFrame();
    const src = canvas;
    const out = document.createElement('canvas');
    const footerH = Math.round(src.height * 0.09);
    out.width = src.width;
    out.height = src.height + footerH;
    const c = out.getContext('2d')!;
    c.drawImage(src, 0, 0);
    c.fillStyle = '#1a1713';
    c.fillRect(0, src.height, out.width, footerH);
    c.fillStyle = '#e8dcc8';
    const fs = Math.round(footerH * 0.34);
    c.font = `${fs}px system-ui, sans-serif`;
    c.textBaseline = 'middle';
    const pad = Math.round(footerH * 0.3);
    c.fillText(`皮料编号: ${m.id}   ${m.name}`, pad, src.height + footerH / 2);
    const date = new Date().toISOString().slice(0, 10);
    const w = c.measureText(date).width;
    c.fillText(date, out.width - w - pad, src.height + footerH / 2);
    out.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${m.id}_preview.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      toast('截图已下载');
    }, 'image/png');
  }

  function drawFrame() {
    const tex = ctx.getTextures(m, ctx.previewSize);
    ctx.renderer.draw(canvas, `preview-${bagKind}`, tex,
      [m.aging.wear, m.aging.wax, m.aging.crease]);
  }

  let raf = 0, alive = true;
  const observer = new MutationObserver(() => {
    if (!document.contains(canvas)) { alive = false; cancelAnimationFrame(raf); observer.disconnect(); }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  function frame() {
    if (!alive) return;
    if (autoRotate) ctx.renderer.modelRotation += 0.008;
    drawFrame();
    raf = requestAnimationFrame(frame);
  }
  frame();
}

/** 光源方向圆盘: 拖动设置方位角/仰角 */
function makeDial(light: Light): HTMLElement {
  const size = 110;
  const wrap = el('div', 'dial-wrap');
  const cv = el('canvas', 'dial') as HTMLCanvasElement;
  cv.width = size; cv.height = size;
  wrap.append(cv);

  function draw() {
    const c = cv.getContext('2d')!;
    c.clearRect(0, 0, size, size);
    const r = size / 2 - 6;
    const cx = size / 2, cy = size / 2;
    c.strokeStyle = '#7a6f5f';
    c.lineWidth = 1.5;
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(cx, cy, r * 0.5, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(cx - r, cy); c.lineTo(cx + r, cy); c.stroke();
    c.beginPath(); c.moveTo(cx, cy - r); c.lineTo(cx, cy + r); c.stroke();
    // 光源位置: 方位角决定圆上角度, 仰角决定半径
    const az = (light.azimuth * Math.PI) / 180;
    const rr = r * (1 - light.elevation / 95);
    const x = cx + Math.sin(az) * rr;
    const y = cy - Math.cos(az) * rr * 0.999;
    c.fillStyle = light.kind === 'spot' ? '#ffb84d' : '#7db8ff';
    c.beginPath(); c.arc(x, y, 7, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#2a251f';
    c.stroke();
  }

  let dragging = false;
  const setFromEvent = (e: PointerEvent) => {
    const rect = cv.getBoundingClientRect();
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    const r = size / 2 - 6;
    light.azimuth = ((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360;
    const rr = Math.min(1, Math.hypot(x, y) / r);
    light.elevation = Math.max(2, Math.min(90, (1 - rr) * 95));
    draw();
  };
  cv.addEventListener('pointerdown', (e) => {
    dragging = true;
    cv.setPointerCapture(e.pointerId);
    setFromEvent(e);
  });
  cv.addEventListener('pointermove', (e) => { if (dragging) setFromEvent(e); });
  cv.addEventListener('pointerup', () => { dragging = false; });
  draw();
  return wrap;
}
