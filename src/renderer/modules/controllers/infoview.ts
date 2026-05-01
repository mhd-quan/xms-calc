const DEFAULT_INFO = {
  name: 'XMS Calculator',
  desc: 'Hover bất kỳ control nào để xem mô tả + phím tắt.',
  shortcut: ''
} as const;

let lastTarget: HTMLElement | null = null;
let resetTimer: number | null = null;

export function attachInfoView(root: HTMLElement): void {
  if (root.dataset.infoviewBound === 'true') return;
  root.dataset.infoviewBound = 'true';

  const nameEl = document.getElementById('infoName');
  const descEl = document.getElementById('infoDesc');
  const shortcutEl = document.getElementById('infoShortcut');
  if (!nameEl || !descEl || !shortcutEl) return;

  root.addEventListener('mouseover', (event) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-info]') : null;
    if (!target || target === lastTarget) return;
    lastTarget = target;
    if (resetTimer) window.clearTimeout(resetTimer);

    const [name, desc, shortcut] = (target.dataset.info ?? '').split('|');
    nameEl.textContent = name || DEFAULT_INFO.name;
    descEl.textContent = desc || DEFAULT_INFO.desc;
    renderShortcut(shortcutEl, shortcut || DEFAULT_INFO.shortcut);
  });

  root.addEventListener('mouseout', (event) => {
    if (!(event.target instanceof Element)) return;
    const related = event.relatedTarget instanceof Element ? event.relatedTarget : null;
    if (related?.closest('[data-info]')) return;
    if (resetTimer) window.clearTimeout(resetTimer);

    resetTimer = window.setTimeout(() => {
      lastTarget = null;
      nameEl.textContent = DEFAULT_INFO.name;
      descEl.textContent = DEFAULT_INFO.desc;
      shortcutEl.replaceChildren();
    }, 60);
  });
}

function renderShortcut(container: HTMLElement, spec: string): void {
  container.replaceChildren();
  if (!spec || spec === '-' || spec === '—') return;

  const keys = spec.split('+').map((key) => key.trim()).filter(Boolean);
  keys.forEach((key) => {
    const node = document.createElement('span');
    node.className = 'x-infoview__key';
    node.textContent = key === 'Cmd' ? '⌘' : key;
    container.appendChild(node);
  });
}
