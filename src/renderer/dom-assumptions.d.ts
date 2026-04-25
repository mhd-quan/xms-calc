type AnimatedNumberTween = {
  val: number;
};

declare global {
  interface HTMLElement {
    value: string;
    select(): void;
    _lastValue?: number;
    _tweenObj?: AnimatedNumberTween;
  }

  interface Element {
    value: string;
    dataset: DOMStringMap;
    style: CSSStyleDeclaration;
    focus(): void;
    select(): void;
  }

  interface EventTarget {
    value: string;
    closest(selectors: string): Element | null;
  }

  interface Document {
    getElementById(elementId: string): HTMLElement;
  }

  interface ParentNode {
    querySelector(selectors: string): HTMLElement;
  }
}

export {};
