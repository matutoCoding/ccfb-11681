// ---------- 应用主框架 ----------
import { Gpu } from './core/gpu';
import { TextureGen } from './core/textureGen';
import { listMaterials, saveMaterial, deleteMaterial } from './core/storage';
import { defaultMaterial, Material, TexMaps } from './core/types';
import { MaterialTextures, PreviewRenderer } from './render/renderer';
import { renderLibrary } from './ui/library';
import { renderEmboss } from './ui/emboss';
import { renderAging } from './ui/aging';
import { renderPreview } from './ui/previewPage';
import { renderColorcard } from './ui/colorcard';
import { renderSettings } from './ui/settings';

export interface AppCtx {
  gpu: Gpu;
  texGen: TextureGen;
  renderer: PreviewRenderer;
  materials: Material[];
  currentId: string | null;
  /** 预览用贴图分辨率 */
  previewSize: number;
  /** 贴图缓存: key = id:updatedAt:size */
  mapCache: Map<string, { maps: TexMaps; textures: MaterialTextures }>;
  getMaps(m: Material, size: number): TexMaps;
  getTextures(m: Material, size: number): MaterialTextures;
  invalidate(m: Material): void;
  save(m: Material): Promise<void>;
  remove(id: string): Promise<void>;
  addMaterial(): Promise<Material>;
  duplicate(m: Material): Promise<Material>;
  setCurrent(id: string | null): void;
  current(): Material | null;
  navigate(page: string): void;
  maskTextures: Map<string, WebGLTexture>;
}

async function boot() {
  const glCanvas = document.createElement('canvas');
  const gpu = new Gpu(glCanvas);
  const texGen = new TextureGen(gpu);
  const renderer = new PreviewRenderer(gpu);

  const ctx: AppCtx = {
    gpu, texGen, renderer,
    materials: await listMaterials(),
    currentId: null,
    previewSize: 1024,
    mapCache: new Map(),
    maskTextures: new Map(),

    getMaps(m, size) {
      const key = `${m.id}:${m.updatedAt}:${size}`;
      let entry = this.mapCache.get(key);
      if (!entry) {
        const { maps } = texGen.generate(m, size);
        const textures = uploadMaps(gpu, maps);
        entry = { maps, textures };
        this.mapCache.set(key, entry);
        // 清理同材质旧缓存
        for (const k of [...this.mapCache.keys()]) {
          if (k.startsWith(`${m.id}:`) && k !== key) {
            const old = this.mapCache.get(k)!;
            gpu.gl.deleteTexture(old.textures.albedo);
            gpu.gl.deleteTexture(old.textures.normal);
            gpu.gl.deleteTexture(old.textures.roughness);
            this.mapCache.delete(k);
          }
        }
      }
      return entry.maps;
    },

    getTextures(m, size) {
      this.getMaps(m, size);
      const entry = this.mapCache.get(`${m.id}:${m.updatedAt}:${size}`)!;
      return { ...entry.textures, mask: this.maskTextures.get(m.id) ?? null };
    },

    invalidate(m) {
      for (const k of [...this.mapCache.keys()]) {
        if (k.startsWith(`${m.id}:`)) this.mapCache.delete(k);
      }
      this.maskTextures.delete(m.id);
    },

    async save(m) { await saveMaterial(m); },
    async remove(id) {
      await deleteMaterial(id);
      this.materials = this.materials.filter((x) => x.id !== id);
      if (this.currentId === id) this.currentId = null;
    },
    async addMaterial() {
      const m = defaultMaterial(this.materials.length + 1 + Math.floor(Math.random() * 1000));
      await saveMaterial(m);
      this.materials.push(m);
      this.currentId = m.id;
      return m;
    },
    async duplicate(m) {
      const copy: Material = JSON.parse(JSON.stringify(m));
      copy.id = `${m.id}-C${(this.materials.length % 36).toString(36).toUpperCase()}`;
      copy.name = `${m.name} 副本`;
      copy.createdAt = Date.now();
      copy.updatedAt = Date.now();
      await saveMaterial(copy);
      this.materials.push(copy);
      return copy;
    },
    setCurrent(id) { this.currentId = id; },
    current() { return this.materials.find((x) => x.id === this.currentId) ?? null; },
    navigate(page) { location.hash = `#${page}`; },
  };

  function route() {
    const page = (location.hash || '#library').slice(1);
    document.querySelectorAll('.nav-btn').forEach((b) => {
      b.classList.toggle('active', (b as HTMLElement).dataset.page === page);
    });
    const main = document.getElementById('page')!;
    main.innerHTML = '';
    const pages: Record<string, (c: HTMLElement, ctx: AppCtx) => void> = {
      library: renderLibrary,
      emboss: renderEmboss,
      aging: renderAging,
      preview: renderPreview,
      colorcard: renderColorcard,
      settings: renderSettings,
    };
    (pages[page] ?? renderLibrary)(main, ctx);
  }

  document.querySelectorAll('.nav-btn').forEach((b) => {
    b.addEventListener('click', () => { location.hash = `#${(b as HTMLElement).dataset.page}`; });
  });
  window.addEventListener('hashchange', route);
  route();

  // 暴露给自检/调试
  (window as unknown as { __app: unknown }).__app = { ctx, texGen };
}

function uploadMaps(gpu: Gpu, maps: TexMaps): MaterialTextures {
  const gl = gpu.gl;
  const up = (img: ImageData): WebGLTexture => {
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, img.width, img.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    return t;
  };
  return { albedo: up(maps.albedo), normal: up(maps.normal), roughness: up(maps.roughness), mask: null };
}

boot().catch((e) => {
  document.getElementById('page')!.innerHTML =
    `<div class="fatal">初始化失败: ${e instanceof Error ? e.message : String(e)}</div>`;
});
