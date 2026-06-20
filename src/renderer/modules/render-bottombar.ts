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
  setMoney('totalQLQ', cycleDisplayAmount(totals.subtotalQLQ, displayCycle));
  setMoney('totalAccount', cycleDisplayAmount(totals.subtotalAccount, displayCycle));
  setMoney('totalWebsite', cycleDisplayAmount(totals.subtotalWebsite, displayCycle));
  setMoney('totalBox', cycleDisplayAmount(totals.subtotalBox, displayCycle));

  const grand = cycleDisplayAmount(totals.grand, displayCycle);
  const grandOriginal = cycleDisplayAmount(totals.grandOriginal, displayCycle);
  const grandSavingsRatio = savingsRatio(grandOriginal, grand);
  setStrikeMoney('grandTotalOriginal', grandOriginal, grand);
  setText('grandTotal', formatVND(grand));
  setText('grandTotalLabel', `Grand total · ${cycleLabel(displayCycle)}`);
  renderSavingsMeter(grandSavingsRatio, Math.max(0, grandOriginal - grand));

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

function savingsRatio(originalValue: number, currentValue: number): number {
  if (originalValue <= currentValue + STRIKE_PRICE_EPSILON || originalValue <= 0) return 0;
  return clamp((originalValue - currentValue) / originalValue, 0, 1);
}

function renderSavingsMeter(ratio: number, savedAmount: number): void {
  const clampedRatio = clamp(ratio, 0, 1);
  const roundedPercent = Math.round(clampedRatio * 100);
  const meter = getElement('grandSavingsMeter');
  if (meter) {
    meter.classList.toggle('is-zero', roundedPercent === 0);
    meter.style.setProperty('--savings-ratio', String(clampedRatio));
    meter.setAttribute('aria-label', `Savings ${roundedPercent}%`);
  }
  setText('grandSavingsValue', `${roundedPercent}%`);
  setText('grandSavingsAmount', `${formatVND(savedAmount)} ₫`);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
