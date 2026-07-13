import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import vm from 'node:vm';
import { buildQuoteIdentity } from '../src/services/quote-identity-service';
import { buildQuotePayload } from '../src/services/quote-payload';
import { DEFAULT_BASE_SALARY } from '../src/shared/calculator';

function compileTemplateRenderer(): string {
  const sourcePath = path.resolve(process.cwd(), 'src/templates/quote/template-renderer.ts');
  const source = readFileSync(sourcePath, 'utf8');
  return ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      strict: true,
      removeComments: false
    },
    fileName: sourcePath
  }).outputText;
}

test('quote template renderer compiles as a classic browser script', () => {
  const output = compileTemplateRenderer();

  assert.doesNotMatch(output, /\bexport\s*\{\s*\};?/);
  assert.doesNotMatch(output, /^\s*import\s/m);
  assert.match(output, /templateWindow\.renderQuote\s*=/);
  assert.match(output, /__quoteTemplateRendererReady\s*=\s*true/);
});

test('QSC PDF template wording identifies NCT without leaking VCPMC', () => {
  type FakeElement = {
    textContent: string;
    innerHTML: string;
    style: Record<string, string>;
  };

  const elements = new Map<string, FakeElement>();
  const templateWindow: { renderQuote?: (payload: unknown) => true } = {};
  const document = {
    getElementById(id: string): FakeElement {
      const existing = elements.get(id);
      if (existing) return existing;
      const element = { textContent: '', innerHTML: '', style: {} };
      elements.set(id, element);
      return element;
    }
  };

  vm.runInNewContext(compileTemplateRenderer(), {
    window: templateWindow,
    document,
    console
  });

  const payload = buildQuotePayload(
    {
      customer: { companyName: 'Công ty QSC' },
      preparedBy: { name: 'BD QSC' },
      calcOptions: {
        baseSalary: DEFAULT_BASE_SALARY,
        vatRate: 0,
        boxMode: 'none',
        accountFeeMode: 'standard',
        platformFeeMode: 'website',
        billingCycle: 'y',
        copyrightMode: 'qsc',
        globalBoxCount: 1,
        globalPlatformStoreCount: 1,
        hasAccountFee: false,
        hasWebsiteFee: false,
        hasQTG: true,
        hasQLQ: true,
        globalDiscounts: { account: 0, website: 0, box: 0, qtg: 0, qlq: 0 },
        discountEnabled: { account: false, website: false, box: false, qtg: false, qlq: false }
      },
      stores: [
        {
          id: 1,
          name: 'Chi nhánh 1',
          type: 'cafe',
          area: '100',
          startDate: '2026-01-01',
          endDate: '2026-12-31'
        }
      ],
      totals: {}
    },
    { companyName: 'Công ty QSC' },
    { name: 'BD QSC' },
    {
      quoteDateInput: new Date('2026-07-13T00:00:00.000Z'),
      quoteIdentity: buildQuoteIdentity('XMS-260713-002', 0)
    }
  );

  assert.equal(templateWindow.renderQuote?.(payload), true);
  const pricingRows = elements.get('pricingRows')?.innerHTML ?? '';
  assert.match(pricingRows, /Phương án QSC/);
  assert.match(pricingRows, /Quyền tác giả âm nhạc do NCT Media/);
  assert.match(pricingRows, /Quyền liên quan.*NCT Media/s);
  assert.doesNotMatch(pricingRows, /VCPMC/);
});
