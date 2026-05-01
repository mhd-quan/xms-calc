import { setVu } from './controllers/vu';
import { cycleDisplayAmount, cycleLabel } from './billing-cycle';
import { formatVND } from './format';

import type { RenderSnapshot } from '../app';

const GRAND_TOTAL_CEILING = 50000000;

export function renderBottombar(snapshot: RenderSnapshot): void {
  const { totals } = snapshot.quote;
  const displayCycle = snapshot.billingCycle;

  setMoney('totalQTG', cycleDisplayAmount(totals.subtotalQTG, displayCycle));
  setMoney('totalQLQ', cycleDisplayAmount(totals.subtotalQLQ, displayCycle));
  setMoney('totalAccount', cycleDisplayAmount(totals.subtotalAccount, displayCycle));
  setMoney('totalBox', cycleDisplayAmount(totals.subtotalBox, displayCycle));
  setText('grandTotal', formatVND(cycleDisplayAmount(totals.grand, displayCycle)));
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

function setText(id: string, value: string): void {
  const element = getElement(id);
  if (element && element.textContent !== value) {
    element.textContent = value;
  }
}

function getElement(id: string): HTMLElement | null {
  return document.getElementById(id) as HTMLElement | null;
}
