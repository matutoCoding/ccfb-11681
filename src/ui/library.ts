// ---------- 皮料库页 ----------
import type { AppCtx } from '../main';
import { el, button, toast } from './components';
import { exportPack, importPack, listMaterials } from '../core/storage';
import { Material } from '../core/types';

export function renderLibrary(root: HTMLElement, ctx: AppCtx): void {
  const wrap = el('div', 'page-pad');
  const head = el('div', 'page-head');
  head.append(el('h2', '', '皮料库'));
  const actions = el('div', 'head-actions');
  actions.append(
    button('＋ 新建皮料', async () => {
      const m = await ctx.addMaterial();
      toast(`已创建 ${m.id}`);
      rerender();
    }),
    button('导出材质包', () => {
      if (!ctx.materials.length) return toast('没有可导出的皮料', false);
      exportPack(ctx.materials);
      toast(`已导出 ${ctx.materials.length} 个皮料`);
    }, 'btn btn-ghost'),
    button('导入材质包', () => {
      const input = el('input') as HTMLInputElement;
      input.type = 'file';
      input.accept = '.json';
      input.addEventListener('change', async () => {
        const f = input.files?.[0];
        if (!f) return;
        try {
          const { added, skipped } = await importPack(f);
          ctx.materials = await listMaterials();
          toast(`导入 ${added} 个皮料${skipped ? `, 跳过 ${skipped}` : ''}`);
          rerender();
        } catch (e) {
          toast(e instanceof Error ? e.message : '导入失败', false);
        }
      });
      input.click();
    }, 'btn btn-ghost'),
  );
  head.append(actions);
  wrap.append(head);

  const grid = el('div', 'mat-grid');
  wrap.append(grid);
  root.append(wrap);

  function rerender() {
    grid.innerHTML = '';
    if (!ctx.materials.length) {
      grid.append(el('div', 'empty', '还没有皮料,点「新建皮料」开始'));
      return;
    }
    for (const m of ctx.materials) grid.append(card(m));
  }

  function card(m: Material): HTMLElement {
    const c = el('div', 'mat-card');
    if (m.id === ctx.currentId) c.classList.add('selected');

    // 缩略图: 用 256px albedo
    const thumbWrap = el('div', 'mat-thumb');
    const { maps } = { maps: ctx.getMaps(m, 256) };
    const cv = el('canvas') as HTMLCanvasElement;
    cv.width = 256; cv.height = 256;
    cv.getContext('2d')!.putImageData(maps.albedo, 0, 0);
    thumbWrap.append(cv);
    // 平铺预览小条 (验证无缝)
    const strip = el('canvas', 'tile-strip') as HTMLCanvasElement;
    strip.width = 256; strip.height = 64;
    const sctx = strip.getContext('2d')!;
    const small = document.createElement('canvas');
    small.width = 64; small.height = 64;
    small.getContext('2d')!.drawImage(cv, 0, 0, 64, 64);
    for (let i = 0; i < 4; i++) sctx.drawImage(small, i * 64, 0);
    thumbWrap.append(strip);

    const info = el('div', 'mat-info');
    info.append(el('div', 'mat-name', m.name));
    info.append(el('div', 'mat-id', m.id));
    const kindName = { litchi: '荔枝纹', crosshatch: '十字纹', croc: '鳄鱼纹' }[m.emboss.kind];
    info.append(el('div', 'mat-sub', `${kindName} · 深度 ${(m.emboss.depth * 100) | 0}%`));

    const btns = el('div', 'mat-btns');
    btns.append(
      button('编辑压纹', () => { ctx.setCurrent(m.id); ctx.navigate('emboss'); }, 'btn btn-sm'),
      button('做旧', () => { ctx.setCurrent(m.id); ctx.navigate('aging'); }, 'btn btn-sm'),
      button('预览', () => { ctx.setCurrent(m.id); ctx.navigate('preview'); }, 'btn btn-sm'),
      button('复制', async () => { await ctx.duplicate(m); toast('已复制'); rerender(); }, 'btn btn-sm btn-ghost'),
      button('删除', async () => {
        if (!confirm(`删除皮料 ${m.name} (${m.id})?`)) return;
        await ctx.remove(m.id);
        ctx.invalidate(m);
        toast('已删除');
        rerender();
      }, 'btn btn-sm btn-danger'),
    );
    info.append(btns);
    c.append(thumbWrap, info);
    c.addEventListener('dblclick', () => { ctx.setCurrent(m.id); ctx.navigate('emboss'); });
    return c;
  }

  rerender();
}

export function materialOptions(ctx: AppCtx): [string, string][] {
  return ctx.materials.map((m: Material) => [m.id, `${m.name} (${m.id})`] as [string, string]);
}
