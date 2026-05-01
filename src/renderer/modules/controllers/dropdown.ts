export type DropdownSpec = {
  el: HTMLElement;
  onSelect: (value: string) => void;
};

const dropdownMap = new WeakMap<HTMLElement, DropdownSpec>();
const focusedIndexMap = new WeakMap<HTMLElement, number>();

export function attachDropdown(spec: DropdownSpec): void {
  dropdownMap.set(spec.el, spec);
  if (spec.el.dataset.dropdownBound === 'true') return;

  spec.el.dataset.dropdownBound = 'true';
  spec.el.setAttribute('role', 'combobox');
  spec.el.setAttribute('aria-expanded', 'false');

  spec.el.addEventListener('click', (event) => {
    const item = closest(event, '.x-dropdown__item');
    if (item?.dataset.value !== undefined) {
      selectDropdownItem(spec.el, item);
      return;
    }
    toggleDropdown(spec.el);
  });

  spec.el.addEventListener('keydown', (event) => handleKeydown(spec.el, event));

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Node ? event.target : null;
    if (target && spec.el.contains(target)) return;
    closeDropdown(spec.el);
  });
}

export function closeDropdown(el: HTMLElement): void {
  el.classList.remove('is-open');
  el.setAttribute('aria-expanded', 'false');
  setFocusedIndex(el, -1);
}

function toggleDropdown(el: HTMLElement): void {
  if (el.classList.contains('is-open')) {
    closeDropdown(el);
  } else {
    openDropdown(el);
  }
}

function openDropdown(el: HTMLElement): void {
  el.classList.add('is-open');
  el.setAttribute('aria-expanded', 'true');
  setFocusedIndex(el, selectedIndex(el));
  el.focus();
}

function handleKeydown(el: HTMLElement, event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    closeDropdown(el);
    return;
  }

  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    if (!el.classList.contains('is-open')) {
      openDropdown(el);
      return;
    }
    const item = items(el)[focusedIndexMap.get(el) ?? selectedIndex(el)];
    if (item) selectDropdownItem(el, item);
    return;
  }

  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

  event.preventDefault();
  if (!el.classList.contains('is-open')) openDropdown(el);
  moveFocus(el, event.key === 'ArrowDown' ? 1 : -1);
}

function selectDropdownItem(el: HTMLElement, item: HTMLElement): void {
  const spec = dropdownMap.get(el);
  if (!spec || item.dataset.value === undefined) return;

  spec.onSelect(item.dataset.value);
  closeDropdown(el);
}

function moveFocus(el: HTMLElement, delta: number): void {
  const itemList = items(el);
  if (itemList.length === 0) return;

  const current = focusedIndexMap.get(el) ?? selectedIndex(el);
  const next = (current + delta + itemList.length) % itemList.length;
  setFocusedIndex(el, next);
}

function setFocusedIndex(el: HTMLElement, index: number): void {
  focusedIndexMap.set(el, index);
  items(el).forEach((item, itemIndex) => {
    item.classList.toggle('is-focused', itemIndex === index);
  });
}

function selectedIndex(el: HTMLElement): number {
  const itemList = items(el);
  const selected = itemList.findIndex((item) => item.classList.contains('is-selected'));
  return selected >= 0 ? selected : 0;
}

function items(el: HTMLElement): HTMLElement[] {
  return Array.from(el.querySelectorAll<HTMLElement>('.x-dropdown__item'));
}

function closest(event: Event, selector: string): HTMLElement | null {
  return event.target instanceof Element ? event.target.closest(selector) as HTMLElement | null : null;
}
