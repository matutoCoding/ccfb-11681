// ---------- 做旧处理页: 在 3D 包型上刷磨损/油蜡/折痕 ----------
import type { AppCtx } from '../main';
import { el, button, slider, selectBox, toast } from './components';
import { BrushPainter, BrushChannel, raycastMesh, screenRay } from '../render/brush';
import { makeBag, BagKind, BAG_NAMES } from '../geom/bags';
import { mat4InvertRigid, mat4Mul, mat4RotateY, mat4Translate } from '../render/camera';
import { materialOptions } from './library';

const MASK_SIZE = 1024;

export function renderAging(root: HTMLElement, ctx: AppCtx): void {
  const wrap = el('div', 'page-pad aging-layout');
  root.append(wrap);

  if (!ctx.materials.length) {
    wrap.append(el('div', 'empty', '请先在皮料库新建皮料'));
    return;
  }
  let m = ctx.current() ?? ctx.materials[0];
  let bagKind: BagKind = 'tote';
  let channel: BrushChannel = 'wear';
  let brushSize = 0.05;
  let brushStrength = 0.5;

  const painter = new BrushPainter(ctx.gpu);
  painter.init(MASK_SIZE);

  // 页面专属相机位
  ctx.renderer.camera.yaw = 0.6;
  ctx.renderer.camera.pitch = 0.35;
  ctx.renderer.camera.dist = 1.1;
  ctx.renderer.camera.target = [0, 0.18, 0];

  // ---- 面板 ----
  const panel = el('div', 'panel');
  panel.append(el('h3', '', '做旧处理'));
  panel.append(selectBox('皮料', materialOptions(ctx), m.id, (v) => {
    m = ctx.materials.find((x) => x.id === v)!;
    ctx.setCurrent(m.id);
    loadMask();
    updateInfo();
  }));
  const info = el('div', 'hint');
  panel.append(info);
  panel.append(selectBox<BagKind>('包型', [
    ['tote', BAG_NAMES.tote], ['boston', BAG_NAMES.boston], ['clutch', BAG_NAMES.clutch],
  ], bagKind, (v) => {
    bagKind = v;
    ctx.renderer.camera.target = v === 'boston' ? [0, 0, 0] : [0, 0.18, 0];
    ensureMesh();
  }));
  panel.append(selectBox<BrushChannel>('刷子', [
    ['wear', '磨损 (变浅变毛)'], ['wax', '油蜡 (变深变亮)'], ['crease', '折痕 (压暗)'],
  ], channel, (v) => { channel = v; }));
  panel.append(slider({
    label: '笔刷大小', min: 0.01, max: 0.2, step: 0.005, value: brushSize,
    format: (v) => v.toFixed(3), onInput: (v) => { brushSize = v; },
  }));
  panel.append(slider({
    label: '笔刷强度', min: 0.05, max: 1, step: 0.05, value: brushStrength,
    format: (v) => `${(v * 100) | 0}%`, onInput: (v) => { brushStrength = v; },
  }));
  panel.append(el('div', 'hint', '左键拖动 = 刷 · 右键/Shift拖动 = 旋转 · 滚轮 = 缩放'));
  const row = el('div', 'btn-row');
  row.append(
    button('撤销', () => { if (!painter.undo()) toast('没有可撤销的步骤', false); }, 'btn btn-sm'),
    button('清空', () => { painter.clear(); }, 'btn btn-sm btn-ghost'),
    button('保存到皮料', () => {
      m.aging.maskPng = painter.exportPng();
      ctx.save(m);
      ctx.maskTextures.delete(m.id);
      toast('做旧遮罩已保存');
    }, 'btn btn-sm'),
  );
  panel.append(row);
  panel.append(slider({
    label: '磨损整体强度', min: 0, max: 2, step: 0.05, value: m.aging.wear,
    format: (v) => v.toFixed(2), onInput: (v) => { m.aging.wear = v; ctx.save(m); },
  }));
  panel.append(slider({
    label: '油蜡整体强度', min: 0, max: 2, step: 0.05, value: m.aging.wax,
    format: (v) => v.toFixed(2), onInput: (v) => { m.aging.wax = v; ctx.save(m); },
  }));
  panel.append(slider({
    label: '折痕整体强度', min: 0, max: 2, step: 0.05, value: m.aging.crease,
    format: (v) => v.toFixed(2), onInput: (v) => { m.aging.crease = v; ctx.save(m); },
  }));

  // ---- 3D 视图 ----
  const viewWrap = el('div', 'view-wrap');
  const canvas = el('canvas', 'view3d') as HTMLCanvasElement;
  viewWrap.append(canvas);
  wrap.append(panel, viewWrap);

  const meshCache = new Map<BagKind, ReturnType<typeof makeBag>>();
  function ensureMesh() {
    if (!meshCache.has(bagKind)) meshCache.set(bagKind, makeBag(bagKind));
    ctx.renderer.uploadMesh(`aging-${bagKind}`, meshCache.get(bagKind)!);
  }
  ensureMesh();

  function updateInfo() { info.textContent = `${m.name} · ${m.id}`; }
  updateInfo();

  async function loadMask() {
    painter.clear();
    if (m.aging.maskPng) await painter.loadPng(m.aging.maskPng);
    if (painter.texture) ctx.maskTextures.set(m.id, painter.texture);
  }
  if (painter.texture) ctx.maskTextures.set(m.id, painter.texture);
  loadMask();

  // ---- 交互 ----
  let painting = false;
  let rotating = false;
  let lastX = 0, lastY = 0;

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    lastX = e.clientX; lastY = e.clientY;
    if (e.button === 2 || e.shiftKey) {
      rotating = true;
    } else {
      painting = true;
      painter.beginStroke();
      paintAt(e);
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (rotating) {
      ctx.renderer.camera.rotate(e.clientX - lastX, e.clientY - lastY);
    } else if (painting) {
      paintAt(e);
    }
    lastX = e.clientX; lastY = e.clientY;
  });
  const stop = () => {
    if (painting) painter.endStroke();
    painting = false; rotating = false;
  };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    ctx.renderer.camera.zoom(e.deltaY);
  }, { passive: false });

  function paintAt(e: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    const cam = ctx.renderer.camera;
    const view = cam.view();
    const viewInv = mat4InvertRigid(view);
    const proj = cam.proj(rect.width / rect.height);
    const ray = screenRay(ndcX, ndcY, viewInv, proj, rect.width / rect.height);
    const model = mat4Mul(mat4Translate(0, 0, 0), mat4RotateY(ctx.renderer.modelRotation));
    const hit = raycastMesh(ray.origin, ray.dir, meshCache.get(bagKind)!, model);
    if (hit) painter.stamp(hit.u, hit.v, brushSize, brushStrength * 0.25, channel);
  }

  // ---- 渲染循环 ----
  let raf = 0;
  let alive = true;
  const observer = new MutationObserver(() => {
    if (!document.contains(canvas)) { alive = false; cancelAnimationFrame(raf); observer.disconnect(); }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  function frame() {
    if (!alive) return;
    const tex = ctx.getTextures(m, ctx.previewSize);
    tex.mask = painter.texture;
    ctx.renderer.draw(canvas, `aging-${bagKind}`, tex,
      [m.aging.wear, m.aging.wax, m.aging.crease]);
    raf = requestAnimationFrame(frame);
  }
  frame();
}
