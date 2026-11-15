// ---------- 设置页 ----------
import type { AppCtx } from '../main';
import { el, button, selectBox, toast } from './components';
import { clearAll, listMaterials } from '../core/storage';
import { runSelfTest } from '../core/textureGen';
import { defaultMaterial } from '../core/types';

export function renderSettings(root: HTMLElement, ctx: AppCtx): void {
  const wrap = el('div', 'page-pad settings-layout');
  root.append(wrap);

  wrap.append(el('h2', '', '设置'));

  // 预览分辨率
  const resBox = el('div', 'panel');
  resBox.append(el('h3', '', '预览'));
  resBox.append(selectBox('预览贴图分辨率', [
    ['512', '512 × 512 (快)'],
    ['1024', '1024 × 1024 (推荐)'],
    ['2048', '2048 × 2048 (精细)'],
  ], String(ctx.previewSize) as '512' | '1024' | '2048', (v) => {
    ctx.previewSize = parseInt(v, 10);
    toast('已切换, 新贴图将按此分辨率生成');
  }));
  wrap.append(resBox);

  // 自检
  const testBox = el('div', 'panel');
  testBox.append(el('h3', '', '质量自检'));
  testBox.append(el('div', 'hint',
    '验证三项硬指标: ① 四边接缝像素差 = 0 ② 同一种子两次生成完全一致 ③ 2048 贴图生成 < 3 秒'));
  const testOut = el('pre', 'test-out');
  const runBtn = button('运行自检', () => {
    runBtn.disabled = true;
    testOut.textContent = '运行中…';
    setTimeout(() => {
      try {
        const probe = defaultMaterial(42);
        const result = runSelfTest(ctx.texGen, probe);
        testOut.textContent =
          `${result.details.join('\n')}\n\n` +
          (result.pass ? '✅ 全部通过' : '❌ 存在未通过项');
        testOut.className = `test-out ${result.pass ? 'pass' : 'fail'}`;
      } catch (e) {
        testOut.textContent = `自检出错: ${e instanceof Error ? e.message : String(e)}`;
        testOut.className = 'test-out fail';
      }
      runBtn.disabled = false;
    }, 30);
  });
  testBox.append(runBtn, testOut);
  wrap.append(testBox);

  // 数据
  const dataBox = el('div', 'panel');
  dataBox.append(el('h3', '', '数据'));
  const usage = el('div', 'hint', '统计中…');
  dataBox.append(usage);
  if (navigator.storage?.estimate) {
    navigator.storage.estimate().then((e) => {
      usage.textContent = `本地存储占用: ${((e.usage ?? 0) / 1024 / 1024).toFixed(1)} MB` +
        (e.quota ? ` / 配额 ${(e.quota / 1024 / 1024).toFixed(0)} MB` : '');
    });
  }
  dataBox.append(button('清空全部数据', async () => {
    if (!confirm('确定删除所有皮料和设置? 此操作不可恢复!')) return;
    await clearAll();
    ctx.materials = await listMaterials();
    ctx.currentId = null;
    ctx.mapCache.clear();
    toast('已清空');
    ctx.navigate('library');
  }, 'btn btn-danger'));
  wrap.append(dataBox);
}
