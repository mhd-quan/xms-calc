import type { BillingCycle } from '../../shared/types';

const CYCLE_DIVISOR: Record<BillingCycle, number> = {
  m: 12,
  q: 4,
  y: 1
};

const CYCLE_LABEL: Record<BillingCycle, string> = {
  m: 'monthly',
  q: 'quarterly',
  y: 'yearly'
};

export function cycleDivisor(cycle: BillingCycle): number {
  return CYCLE_DIVISOR[cycle] || 1;
}

export function cycleLabel(cycle: BillingCycle): string {
  return CYCLE_LABEL[cycle] || CYCLE_LABEL.y;
}

export function cycleDisplayAmount(value: number, cycle: BillingCycle): number {
  return value / cycleDivisor(cycle);
}
