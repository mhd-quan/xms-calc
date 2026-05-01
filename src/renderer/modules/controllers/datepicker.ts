export type DatepickerSpec = {
  el: HTMLElement;
  getValue: () => string;
  onSelect: (value: string) => void;
};

const monthNames = [
  'Tháng 1',
  'Tháng 2',
  'Tháng 3',
  'Tháng 4',
  'Tháng 5',
  'Tháng 6',
  'Tháng 7',
  'Tháng 8',
  'Tháng 9',
  'Tháng 10',
  'Tháng 11',
  'Tháng 12'
];

const datepickerMap = new WeakMap<HTMLElement, DatepickerSpec>();
const viewDateMap = new WeakMap<HTMLElement, Date>();
const focusDateMap = new WeakMap<HTMLElement, Date>();

export function attachDatepicker(spec: DatepickerSpec): void {
  datepickerMap.set(spec.el, spec);
  if (spec.el.dataset.datepickerBound === 'true') return;

  spec.el.dataset.datepickerBound = 'true';
  spec.el.setAttribute('role', 'group');

  spec.el.addEventListener('click', (event) => {
    const cell = closest(event, '.x-datepicker__cell');
    if (cell?.dataset.date) {
      spec.onSelect(cell.dataset.date);
      closeDatepicker(spec.el);
      return;
    }

    const nav = closest(event, '.x-datepicker__nav');
    if (nav) {
      moveMonth(spec.el, Number(nav.dataset.dir) || 0);
      return;
    }

    toggleDatepicker(spec.el);
  });

  spec.el.addEventListener('keydown', (event) => handleKeydown(spec.el, event));

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Node ? event.target : null;
    if (target && spec.el.contains(target)) return;
    closeDatepicker(spec.el);
  });
}

export function closeDatepicker(el: HTMLElement): void {
  el.classList.remove('is-open');
}

function toggleDatepicker(el: HTMLElement): void {
  if (el.classList.contains('is-open')) {
    closeDatepicker(el);
    return;
  }
  openDatepicker(el);
}

function openDatepicker(el: HTMLElement): void {
  const spec = datepickerMap.get(el);
  if (!spec) return;

  const selectedDate = parseISODate(spec.getValue());
  viewDateMap.set(el, new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  focusDateMap.set(el, selectedDate);
  renderCalendar(el);
  el.classList.add('is-open');
  el.focus();
}

function moveMonth(el: HTMLElement, dir: number): void {
  const current = viewDateMap.get(el) ?? parseISODate(datepickerMap.get(el)?.getValue() ?? '');
  viewDateMap.set(el, new Date(current.getFullYear(), current.getMonth() + dir, 1));
  renderCalendar(el);
}

function handleKeydown(el: HTMLElement, event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    closeDatepicker(el);
    return;
  }

  if (!el.classList.contains('is-open')) {
    if (event.key === 'Enter' || event.key === ' ' || event.key.startsWith('Arrow')) {
      event.preventDefault();
      openDatepicker(el);
    }
    return;
  }

  const dayDeltaByKey: Record<string, number> = {
    ArrowLeft: -1,
    ArrowRight: 1,
    ArrowUp: -7,
    ArrowDown: 7
  };
  const dayDelta = dayDeltaByKey[event.key];
  if (dayDelta) {
    event.preventDefault();
    moveFocusDate(el, dayDelta);
  } else if (event.key === 'PageUp' || event.key === 'PageDown') {
    event.preventDefault();
    moveFocusMonth(el, event.key === 'PageUp' ? -1 : 1);
  } else if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault();
    moveFocusToWeekEdge(el, event.key === 'Home' ? 0 : 6);
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    selectFocusedDate(el);
  }
}

function moveFocusDate(el: HTMLElement, deltaDays: number): void {
  const current = focusDateMap.get(el) ?? parseISODate(datepickerMap.get(el)?.getValue() ?? '');
  const next = new Date(current);
  next.setDate(current.getDate() + deltaDays);
  focusDateMap.set(el, next);
  viewDateMap.set(el, new Date(next.getFullYear(), next.getMonth(), 1));
  renderCalendar(el);
}

function moveFocusMonth(el: HTMLElement, deltaMonths: number): void {
  const current = focusDateMap.get(el) ?? parseISODate(datepickerMap.get(el)?.getValue() ?? '');
  const next = new Date(current.getFullYear(), current.getMonth() + deltaMonths, current.getDate());
  focusDateMap.set(el, next);
  viewDateMap.set(el, new Date(next.getFullYear(), next.getMonth(), 1));
  renderCalendar(el);
}

function moveFocusToWeekEdge(el: HTMLElement, mondayIndex: number): void {
  const current = focusDateMap.get(el) ?? parseISODate(datepickerMap.get(el)?.getValue() ?? '');
  const currentMondayIndex = (current.getDay() + 6) % 7;
  const next = new Date(current);
  next.setDate(current.getDate() + mondayIndex - currentMondayIndex);
  focusDateMap.set(el, next);
  viewDateMap.set(el, new Date(next.getFullYear(), next.getMonth(), 1));
  renderCalendar(el);
}

function selectFocusedDate(el: HTMLElement): void {
  const spec = datepickerMap.get(el);
  if (!spec) return;
  spec.onSelect(formatISODate(focusDateMap.get(el) ?? parseISODate(spec.getValue())));
  closeDatepicker(el);
}

function renderCalendar(el: HTMLElement): void {
  const spec = datepickerMap.get(el);
  if (!spec) return;

  const selectedDate = parseISODate(spec.getValue());
  const focusDate = focusDateMap.get(el) ?? selectedDate;
  const viewDate = viewDateMap.get(el) ?? new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  const curYear = viewDate.getFullYear();
  const curMonth = viewDate.getMonth();
  const title = el.querySelector<HTMLElement>('.x-datepicker__monthyear');
  const grid = el.querySelector<HTMLElement>('.x-datepicker__grid');
  if (!title || !grid) return;

  title.textContent = `${monthNames[curMonth]}, ${curYear}`;
  const today = startOfDay(new Date());
  const firstDayOffset = (new Date(curYear, curMonth, 1).getDay() + 6) % 7;
  const gridStart = new Date(curYear, curMonth, 1 - firstDayOffset);

  grid.innerHTML = Array.from({ length: 42 }, (_, index) => {
    const cellDate = new Date(gridStart);
    cellDate.setDate(gridStart.getDate() + index);
    const dateValue = formatISODate(cellDate);
    const classes = [
      'x-datepicker__cell',
      cellDate.getMonth() !== curMonth ? 'is-dim' : '',
      sameDay(cellDate, selectedDate) ? 'is-selected' : '',
      sameDay(cellDate, today) ? 'is-today' : '',
      sameDay(cellDate, focusDate) ? 'is-focused' : ''
    ].filter(Boolean).join(' ');

    return `<div class="${classes}" role="gridcell" tabindex="-1" aria-selected="${sameDay(cellDate, selectedDate)}" data-date="${dateValue}">${cellDate.getDate()}</div>`;
  }).join('');
}

function parseISODate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return startOfDay(new Date());

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(date.getTime()) ? startOfDay(new Date()) : date;
}

function formatISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function closest(event: Event, selector: string): HTMLElement | null {
  return event.target instanceof Element ? event.target.closest(selector) as HTMLElement | null : null;
}
