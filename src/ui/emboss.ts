// ---------- 压纹编辑页 ----------
import type { AppCtx } from '../main';
import { el, button, slider, selectBox, colorPicker, intField, textField, toast } from './components';
import { downloadPng } from '../core/textureGen';
import { PatternKind } from '../core/types';

export function renderEmboss(root: HTMLElement, ctx: AppCtx): void {
  const m = ctx.current();
  const wrap = el('div', 'page-pad emboss-layout');
  root.append(wrap);

  if (!m) {
    wrap.append(el('div', 'empty', '请先在皮料库选择或新建一个皮料'));
    wrap.append(button('去皮料库', () => ctx.navigate('library')));
    return;
  }

  // ---- 左: 参数面板 ----
  const panel = el('div', 'panel');
  panel.append(el('h3', '', `${m.name} · ${m.id}`));

  panel.append(textField('名称', m.name, (v) => { m.name = v; save(); }));
  panel.append(intField('种子 (同种子结果完全一致)', m.seed, (v) => { m.seed = v >>> 0; regen(); }));
  panel.append(button('随机种子', () => {
    m.seed = (m.seed * 1664525 + 1013904223) >>> 0;
    regen();
    rerenderPanel();
  }, 'btn btn-sm btn-ghost'));

  panel.append(selectBox<PatternKind>('纹样', [
    ['litchi', '荔枝纹'], ['crosshatch', '十字纹'], ['croc', '鳄鱼纹'],
  ], m.emboss.kind, (v) => { m.emboss.kind = v; regen(); rerenderPanel(); }));

  const paramArea = el('div');
  panel.append(paramArea);

  panel.append(colorPicker('底色', m.baseColor, (v) => { m.baseColor = v; regen(); }));
  panel.append(slider({
    label: '基础粗糙度', min: 0.05, max: 1, step: 0.01, value: m.roughness,
    format: (v) => v.toFixed(2),
    onInput: (v) => { m.roughness = v; regen(); },
  }));
  panel.append(slider({
    label: '法线强度', min: 0, max: 3, step: 0.05, value: m.normalStrength,
    format: (v) => v.toFixed(2),
    onInput: (v) => { m.normalStrength = v; regen(); },
  }));

  const dlRow = el('div', 'btn-row');
  dlRow.append(
    button('下载法线 PNG', () => download('normal'), 'btn btn-sm'),
    button('下载粗糙度 PNG', () => download('roughness'), 'btn btn-sm'),
    button('下载颜色 PNG', () => download('albedo'), 'btn btn-sm'),
    button('下载高度 PNG', () => download('height'), 'btn btn-sm'),
  );
  panel.append(dlRow);
  panel.append(el('div', 'hint', '贴图为 2048×2048,四边像素严格对齐,可直接平铺使用'));

  // ---- 右: 预览 ----
  const right = el('div', 'emboss-right');
  const previewTitle = el('div', 'preview-title');
  right.append(previewTitle);
  const flatWrap = el('div', 'flat-previews');
  const flatCanvas = el('canvas', 'flat-canvas') as HTMLCanvasElement;   // 单张
  const tiledCanvas = el('canvas', 'flat-canvas') as HTMLCanvasElement;  // 3x3 平铺
  flatWrap.append(
    labeled('颜色 (单张)', flatCanvas),
    labeled('3×3 平铺 (检查接缝)', tiledCanvas),
  );
  const flatCanvas2 = el('canvas', 'flat-canvas') as HTMLCanvasElement;
  const flatCanvas3 = el('canvas', 'flat-canvas') as HTMLCanvasElement;
  flatWrap.append(labeled('法线', flatCanvas2), labeled('粗糙度', flatCanvas3));
  right.append(flatWrap);
  const stats = el('div', 'stats');
  right.append(stats);

  wrap.append(panel, right);

  function labeled(label: string, cv: HTMLCanvasElement): HTMLElement {
    const w = el('div', 'flat-item');
    w.append(el('div', 'flat-label', label), cv);
    return w;
  }

  function regen() {
    save();
    ctx.invalidate(m!);
    draw();
  }

  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  function save() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => ctx.save(m!), 300);
  }

  function draw() {
    const t0 = performance.now();
    const maps = ctx.getMaps(m!, 1024);
    const genMs = performance.now() - t0;

    const put = (cv: HTMLCanvasElement, img: ImageData) => {
      cv.width = img.width; cv.height = img.height;
      cv.getContext('2d')!.putImageData(img, 0, 0);
    };
    put(flatCanvas, maps.albedo);
    put(flatCanvas2, maps.normal);
    put(flatCanvas3, maps.roughness);

    // 3x3 平铺
    tiledCanvas.width = 768; tiledCanvas.height = 768;
    const tc = tiledCanvas.getContext('2d')!;
    const tmp = document.createElement('canvas');
    tmp.width = 256; tmp.height = 256;
    tmp.getContext('2d')!.putImageData(maps.albedo, 0, 0);
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
      tc.drawImage(tmp, x * 256, y * 256);
    }
    previewTitle.textContent = `${m!.name} · ${m!.id}`;
    stats.textContent = `本次生成(1024): ${genMs.toFixed(0)} ms`;
  }

  function download(which: 'albedo' | 'normal' | 'roughness' | 'height') {
    toast('正在生成 2048 贴图…');
    setTimeout(() => {
      const maps = ctx.getMaps(m!, 2048);
      downloadPng(maps[which], `${m!.id}_${which}_2048.png`);
    }, 30);
  }

  function rerenderPanel() {
    paramArea.innerHTML = '';
    const e = m!.emboss;
    paramArea.append(slider({
      label: '纹理尺度 (晶格数, 整数保证无缝)', min: 4, max: 64, step: 1, value: e.cells,
      format: (v) => `${v | 0}`,
      onInput: (v) => { e.cells = Math.round(v); regen(); },
    }));
    paramArea.append(slider({
      label: '压纹深度', min: 0, max: 1, step: 0.01, value: e.depth,
      format: (v) => `${(v * 100) | 0}%`,
      onInput: (v) => { e.depth = v; regen(); },
    }));
    paramArea.append(slider({
      label: '细纹强度', min: 0, max: 1, step: 0.01, value: e.grain,
      format: (v) => `${(v * 100) | 0}%`,
      onInput: (v) => { e.grain = v; regen(); },
    }));
    if (e.kind === 'crosshatch') {
      paramArea.append(slider({
        label: '斜纹角度', min: 0, max: 90, step: 1, value: e.angle,
        format: (v) => `${v | 0}°`,
        onInput: (v) => { e.angle = v; regen(); },
      }));
    }
    if (e.kind !== 'crosshatch') {
      paramArea.append(slider({
        label: e.kind === 'croc' ? '裂纹宽度' : '沟壑宽度', min: 0, max: 1, step: 0.01, value: e.crack,
        format: (v) => `${(v * 100) | 0}%`,
        onInput: (v) => { e.crack = v; regen(); },
      }));
    }
  }

  rerenderPanel();
  draw();
}
