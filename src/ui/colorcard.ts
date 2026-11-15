// ---------- 色卡对比页: 两种皮料并排 ----------
import type { AppCtx } from '../main';
import { el, selectBox } from './components';
import { makeSwatch } from '../geom/bags';
import { materialOptions } from './library';

export function renderColorcard(root: HTMLElement, ctx: AppCtx): void {
  const wrap = el('div', 'page-pad colorcard-layout');
  root.append(wrap);

  if (ctx.materials.length < 1) {
    wrap.append(el('div', 'empty', '请先在皮料库新建至少一个皮料'));
    return;
  }
  let leftId = ctx.materials[0].id;
  let rightId = ctx.materials.length > 1 ? ctx.materials[1].id : ctx.materials[0].id;

  const bar = el('div', 'colorcard-bar');
  const selL = selectBox('左侧皮料', materialOptions(ctx), leftId, (v) => { leftId = v; });
  const selR = selectBox('右侧皮料', materialOptions(ctx), rightId, (v) => { rightId = v; });
  bar.append(selL, selR, el('span', 'hint', '拖动旋转 · 滚轮缩放 · 两侧同光源同角度'));
  wrap.append(bar);

  const viewWrap = el('div', 'view-wrap colorcard-view');
  const canvas = el('canvas', 'view3d') as HTMLCanvasElement;
  viewWrap.append(canvas);
  // 标签
  const labelL = el('div', 'cc-label cc-left');
  const labelR = el('div', 'cc-label cc-right');
  viewWrap.append(labelL, labelR);
  wrap.append(viewWrap);

  ctx.renderer.uploadMesh('swatch', makeSwatch());
  ctx.renderer.camera.yaw = 0.35;
  ctx.renderer.camera.pitch = 0.25;
  ctx.renderer.camera.dist = 0.8;
  ctx.renderer.camera.target = [0, 0, 0];

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

  let raf = 0, alive = true;
  const observer = new MutationObserver(() => {
    if (!document.contains(canvas)) { alive = false; cancelAnimationFrame(raf); observer.disconnect(); }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  function frame() {
    if (!alive) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth * dpr, h = canvas.clientHeight * dpr;
    const lm = ctx.materials.find((x) => x.id === leftId)!;
    const rm = ctx.materials.find((x) => x.id === rightId)!;
    labelL.textContent = `${lm.name} · ${lm.id}`;
    labelR.textContent = `${rm.name} · ${rm.id}`;
    const lt = ctx.getTextures(lm, ctx.previewSize);
    const rt = ctx.getTextures(rm, ctx.previewSize);
    ctx.renderer.draw(canvas, 'swatch', lt,
      [lm.aging.wear, lm.aging.wax, lm.aging.crease], [0, 0, 0], 0, [0, 0, w / 2, h]);
    ctx.renderer.draw(canvas, 'swatch', rt,
      [rm.aging.wear, rm.aging.wax, rm.aging.crease], [0, 0, 0], 0, [w / 2, 0, w / 2, h]);
    raf = requestAnimationFrame(frame);
  }
  frame();
}
