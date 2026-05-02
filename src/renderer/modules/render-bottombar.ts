import { setVu } from './controllers/vu';
import { cycleDisplayAmount, cycleLabel } from './billing-cycle';
import { formatVND } from './format';

import type { RenderSnapshot } from '../app';

const GRAND_TOTAL_CEILING = 50000000;
const STRIKE_PRICE_EPSILON = 0.5;

export function renderBottombar(snapshot: RenderSnapshot): void {
  const { totals } = snapshot.quote;
  const displayCycle = snapshot.billingCycle;

  setMoney('totalQTG', cycleDisplayAmount(totals.subtotalQTG, displayCycle));
  setStrikeMoney(
    'totalQTGOriginal',
    cycleDisplayAmount(totals.subtotalQTGOriginal, displayCycle),
    cycleDisplayAmount(totals.subtotalQTG, displayCycle)
  );
  setMoney('totalQLQ', cycleDisplayAmount(totals.subtotalQLQ, displayCycle));
  setStrikeMoney(
    'totalQLQOriginal',
    cycleDisplayAmount(totals.subtotalQLQOriginal, displayCycle),
    cycleDisplayAmount(totals.subtotalQLQ, displayCycle)
  );
  setMoney('totalAccount', cycleDisplayAmount(totals.subtotalAccount, displayCycle));
  setStrikeMoney(
    'totalAccountOriginal',
    cycleDisplayAmount(totals.subtotalAccountOriginal, displayCycle),
    cycleDisplayAmount(totals.subtotalAccount, displayCycle)
  );
  setMoney('totalBox', cycleDisplayAmount(totals.subtotalBox, displayCycle));
  setStrikeMoney(
    'totalBoxOriginal',
    cycleDisplayAmount(totals.subtotalBoxOriginal, displayCycle),
    cycleDisplayAmount(totals.subtotalBox, displayCycle)
  );

  const grand = cycleDisplayAmount(totals.grand, displayCycle);
  const grandOriginal = cycleDisplayAmount(totals.grandOriginal, displayCycle);
  setStrikeMoney('grandTotalOriginal', grandOriginal, grand);
  setText('grandTotal', formatVND(grand));
  setText('grandTotalLabel', `Grand total · ${cycleLabel(displayCycle)}`);

  document.querySelectorAll<HTMLElement>('#vatControl .x-seg__btn').forEach((button) => {
    const buttonRate = Number(button.dataset.vat);
    button.classList.toggle('is-active', Math.abs(buttonRate - totals.vatRate) < 0.0001);
  });

  const grandVu = getElement('grandVu');
  if (grandVu) setVu(grandVu, cycleDisplayAmount(totals.grand, displayCycle) / GRAND_TOTAL_CEILING);
}

function setMoney(id: string, value: number): void {
  setText(id, `${formatVND(value)} ₫`);
}

function setStrikeMoney(id: string, originalValue: number, currentValue: number): void {
  const element = getElement(id);
  if (!element) return;
  const shouldShow = originalValue > currentValue + STRIKE_PRICE_EPSILON;
  element.toggleAttribute('hidden', !shouldShow);
  if (shouldShow) {
    setText(id, `${formatVND(originalValue)} ₫`);
  }
}

function setText(id: string, value: string): void {
  const element = getElement(id);
  if (element && element.textContent !== value) {
    element.textContent = value;
  }
}

function getElement(id: string): HTMLElement | null {
  return document.getElementById(id) as HTMLElement | null;
}
