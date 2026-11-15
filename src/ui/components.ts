// ---------- 轻量 UI 组件 ----------
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, cls?: string, text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export interface SliderOpts {
  label: string;
  min: number; max: number; step: number;
  value: number;
  format?: (v: number) => string;
  onInput: (v: number) => void;
}

export function slider(opts: SliderOpts): HTMLElement {
  const wrap = el('div', 'ctl');
  const head = el('div', 'ctl-head');
  const lab = el('span', '', opts.label);
  const val = el('span', 'ctl-val', opts.format ? opts.format(opts.value) : String(opts.value));
  head.append(lab, val);
  const input = el('input') as HTMLInputElement;
  input.type = 'range';
  input.min = String(opts.min); input.max = String(opts.max); input.step = String(opts.step);
  input.value = String(opts.value);
  input.addEventListener('input', () => {
    const v = parseFloat(input.value);
    val.textContent = opts.format ? opts.format(v) : String(v);
    opts.onInput(v);
  });
  wrap.append(head, input);
  return wrap;
}

export function colorPicker(label: string, value: string, onInput: (v: string) => void): HTMLElement {
  const wrap = el('div', 'ctl ctl-row');
  const lab = el('span', '', label);
  const input = el('input') as HTMLInputElement;
  input.type = 'color';
  input.value = value;
  input.addEventListener('input', () => onInput(input.value));
  wrap.append(lab, input);
  return wrap;
}

export function selectBox<T extends string>(label: string, options: [T, string][], value: T,
                                            onChange: (v: T) => void): HTMLElement {
  const wrap = el('div', 'ctl ctl-row');
  const lab = el('span', '', label);
  const sel = el('select') as HTMLSelectElement;
  for (const [v, name] of options) {
    const o = el('option', '', name) as HTMLOptionElement;
    o.value = v;
    sel.append(o);
  }
  sel.value = value;
  sel.addEventListener('change', () => onChange(sel.value as T));
  wrap.append(lab, sel);
  return wrap;
}

export function button(text: string, onClick: () => void, cls = 'btn'): HTMLButtonElement {
  const b = el('button', cls, text) as HTMLButtonElement;
  b.addEventListener('click', onClick);
  return b;
}

export function intField(label: string, value: number, onChange: (v: number) => void): HTMLElement {
  const wrap = el('div', 'ctl ctl-row');
  const lab = el('span', '', label);
  const input = el('input') as HTMLInputElement;
  input.type = 'number';
  input.value = String(value);
  input.addEventListener('change', () => {
    const v = parseInt(input.value, 10);
    if (Number.isFinite(v)) onChange(v);
  });
  wrap.append(lab, input);
  return wrap;
}

export function textField(label: string, value: string, onChange: (v: string) => void): HTMLElement {
  const wrap = el('div', 'ctl ctl-row');
  const lab = el('span', '', label);
  const input = el('input') as HTMLInputElement;
  input.type = 'text';
  input.value = value;
  input.addEventListener('change', () => onChange(input.value));
  wrap.append(lab, input);
  return wrap;
}

export function toast(msg: string, ok = true): void {
  const t = el('div', `toast ${ok ? 'toast-ok' : 'toast-err'}`, msg);
  document.body.append(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2600);
}
