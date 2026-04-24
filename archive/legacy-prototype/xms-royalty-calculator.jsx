import React, { useState, useMemo } from 'react';
import { Plus, X, Search, Check } from 'lucide-react';

// -----------------------------------------------------------------------------
// STYLES
// Lexend across full weight range. Hairline dividers. Studio-grade sliders.
// Pear (#CFF533) and Picton Blue (#44CCFF) used as signal accents only.
// -----------------------------------------------------------------------------
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700;900&display=swap');

  * { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
  body, html { background: #0a0a0a; }

  .lx { font-family: 'Lexend', sans-serif; font-feature-settings: 'tnum' 1, 'ss01' 1; letter-spacing: -0.01em; }
  .tnum { font-variant-numeric: tabular-nums; }

  ::-webkit-scrollbar { width: 3px; height: 3px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #262626; }
  ::-webkit-scrollbar-thumb:hover { background: #3a3a3a; }

  input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.5); cursor: pointer; opacity: 0.35; transition: opacity 150ms; }
  input[type="date"]:hover::-webkit-calendar-picker-indicator { opacity: 0.9; }
  input[type="date"] { color-scheme: dark; }

  input[type=number]::-webkit-outer-spin-button,
  input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  input[type=number] { -moz-appearance: textfield; }

  ::selection { background: #CFF533; color: #000; }

  select {
    background-image: url("data:image/svg+xml,%3Csvg width='8' height='5' viewBox='0 0 8 5' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L4 4L7 1' stroke='%23525252' stroke-width='1' fill='none'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0 center;
    padding-right: 16px;
  }

  /* Studio fader sliders */
  .fader { -webkit-appearance: none; appearance: none; background: transparent; width: 100%; cursor: pointer; height: 20px; }
  .fader:focus { outline: none; }
  .fader::-webkit-slider-runnable-track { height: 1px; background: #1f1f1f; }
  .fader::-moz-range-track { height: 1px; background: #1f1f1f; border: 0; }

  .fader-pear::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 11px; height: 11px;
    background: #CFF533;
    border-radius: 50%;
    margin-top: -5px;
    box-shadow: 0 0 0 0 rgba(207,245,51,0);
    transition: box-shadow 150ms ease, transform 120ms ease;
  }
  .fader-pear:hover::-webkit-slider-thumb { box-shadow: 0 0 0 5px rgba(207,245,51,0.12); }
  .fader-pear:active::-webkit-slider-thumb { transform: scale(1.1); }
  .fader-pear::-moz-range-thumb { width: 11px; height: 11px; background: #CFF533; border-radius: 50%; border: none; }

  .fader-picton::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 11px; height: 11px;
    background: #44CCFF;
    border-radius: 50%;
    margin-top: -5px;
    box-shadow: 0 0 0 0 rgba(68,204,255,0);
    transition: box-shadow 150ms ease, transform 120ms ease;
  }
  .fader-picton:hover::-webkit-slider-thumb { box-shadow: 0 0 0 5px rgba(68,204,255,0.12); }
  .fader-picton:active::-webkit-slider-thumb { transform: scale(1.1); }
  .fader-picton::-moz-range-thumb { width: 11px; height: 11px; background: #44CCFF; border-radius: 50%; border: none; }

  /* Field focus — clean underline only */
  .field-input:focus { outline: none; border-color: #CFF533; }
  .field-input:hover { border-color: #2a2a2a; }
  .field-input:focus:hover { border-color: #CFF533; }

  .tick-divider { background-image: linear-gradient(to right, #1a1a1a 0, #1a1a1a 1px, transparent 1px, transparent 100%); background-size: 25% 1px; }

  @keyframes signalPulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 1; }
  }
  .signal-dot { animation: signalPulse 2s ease-in-out infinite; }
`;

// -----------------------------------------------------------------------------
// NCT MARK — inline SVG per brand guidelines. Five ellipses, Pear→Picton gradient.
// -----------------------------------------------------------------------------
const NCTMark = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="50" fill="#000" />
    <defs>
      <linearGradient id="nctGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#CFF533" />
        <stop offset="100%" stopColor="#44CCFF" />
      </linearGradient>
    </defs>
    <ellipse cx="26" cy="50" rx="3.2" ry="13" fill="#BBF0FF" opacity="0.9" />
    <ellipse cx="38" cy="50" rx="3.2" ry="25" fill="url(#nctGrad)" />
    <ellipse cx="50" cy="50" rx="3.2" ry="9" fill="#BBF0FF" opacity="0.9" />
    <ellipse cx="62" cy="50" rx="3.2" ry="25" fill="url(#nctGrad)" />
    <ellipse cx="74" cy="50" rx="3.2" ry="13" fill="#BBF0FF" opacity="0.9" />
  </svg>
);

// -----------------------------------------------------------------------------
// BUSINESS TYPES — short labels added for list density
// -----------------------------------------------------------------------------
const BUSINESS_TYPES = {
  cafe:          { label: 'Quán cà phê - giải khát', short: 'CAFÉ' },
  restaurant:    { label: 'Nhà hàng, phòng hội thảo, hội nghị', short: 'F&B' },
  store:         { label: 'Cửa hàng, showroom', short: 'RETAIL' },
  gym:           { label: 'CLB thể dục, chăm sóc sức khỏe - thẩm mỹ', short: 'FITNESS' },
  entertainment: { label: 'Khu vui chơi, giải trí', short: 'ENTERTAINMENT' },
  mall:          { label: 'Trung tâm thương mại, cao ốc văn phòng', short: 'MALL' },
  supermarket:   { label: 'Siêu thị', short: 'SUPERMARKET' },
};

// -----------------------------------------------------------------------------
// CALCULATION LOGIC — unchanged from MVP. ND 17/2023 Phụ lục 2 stepped coefficients.
// -----------------------------------------------------------------------------
const DEFAULT_BASE_SALARY = 2340000;

const calculateCoef = (type, area) => {
  let coef = 0;
  let maxCoef = Infinity;

  if (type === 'cafe') {
    maxCoef = 8;
    if (area <= 15) coef = 0.35;
    else if (area <= 50) coef = 0.35 + (area - 15) * 0.04;
    else coef = 0.35 + (35 * 0.04) + (area - 50) * 0.02;
  } else if (type === 'restaurant') {
    maxCoef = 8;
    if (area <= 50) coef = 2.0;
    else if (area <= 100) coef = 2.0 + (area - 50) * 0.05;
    else coef = 2.0 + (50 * 0.05) + (area - 100) * 0.03;
  } else if (type === 'store') {
    maxCoef = 5;
    if (area <= 50) coef = 0.35;
    else if (area <= 100) coef = 0.35 + (area - 50) * 0.008;
    else coef = 0.35 + (50 * 0.008) + (area - 100) * 0.006;
  } else if (type === 'gym') {
    maxCoef = 10;
    if (area <= 50) coef = 0.5;
    else if (area <= 100) coef = 0.5 + (area - 50) * 0.011;
    else coef = 0.5 + (50 * 0.011) + (area - 100) * 0.009;
  } else if (type === 'entertainment') {
    maxCoef = 12;
    if (area <= 200) coef = 0.7;
    else if (area <= 500) coef = 0.7 + (area - 200) * 0.003;
    else coef = 0.7 + (300 * 0.003) + (area - 500) * 0.001;
  } else if (type === 'mall') {
    maxCoef = 50;
    if (area <= 200) coef = 1.5;
    else if (area <= 500) coef = 1.5 + (area - 200) * 0.003;
    else coef = 1.5 + (300 * 0.003) + (area - 500) * 0.002;
  } else if (type === 'supermarket') {
    maxCoef = 10;
    if (area <= 500) coef = 1.25;
    else if (area <= 1000) coef = 1.25 + (area - 500) * 0.003;
    else coef = 1.25 + (500 * 0.003) + (area - 1000) * 0.002;
  }
  return Math.min(coef, maxCoef);
};

const calculateDurationMonths = (start, end) => {
  if (!start || !end) return 0;
  const d1 = new Date(start);
  const d2 = new Date(end);
  if (d2 < d1) return 0;
  const totalMonths = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
  let tempDate = new Date(d1);
  tempDate.setMonth(tempDate.getMonth() + totalMonths);
  let fullMonths = totalMonths;
  if (tempDate > d2) {
    fullMonths -= 1;
    tempDate = new Date(d1);
    tempDate.setMonth(tempDate.getMonth() + fullMonths);
  }
  const diffTime = d2.getTime() - tempDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
  let fraction = 0;
  if (diffDays <= 7) fraction = 0;
  else if (diffDays >= 8 && diffDays <= 17) fraction = 0.5;
  else if (diffDays >= 18) fraction = 1.0;
  return fullMonths + fraction;
};

const formatVND = (num) => new Intl.NumberFormat('vi-VN').format(Math.round(num));
const formatCompactVND = (num) => {
  const n = Math.round(num);
  if (n >= 1e9) return (n/1e9).toFixed(1).replace(/\.0$/,'') + 'B';
  if (n >= 1e6) return (n/1e6).toFixed(1).replace(/\.0$/,'') + 'M';
  if (n >= 1e3) return (n/1e3).toFixed(0) + 'K';
  return String(n);
};

// -----------------------------------------------------------------------------
// SHARED PRIMITIVES
// -----------------------------------------------------------------------------
const Eyebrow = ({ children, className = '' }) => (
  <div className={`lx text-[10px] font-medium tracking-[0.18em] text-[#525252] uppercase ${className}`}>
    {children}
  </div>
);

const SectionHeader = ({ index, title, subtitle, accent = '#CFF533' }) => (
  <div className="flex items-baseline gap-4 mb-6">
    <span className="lx text-[10px] font-normal tracking-[0.2em] text-[#3a3a3a] tnum">{index}</span>
    <div className="flex-1 flex items-baseline gap-3">
      <span className="lx text-[13px] font-medium tracking-[0.14em] text-white uppercase">{title}</span>
      <span className="h-px flex-1 bg-[#1a1a1a]" />
      {subtitle && <span className="lx text-[10px] tracking-[0.1em] text-[#525252] uppercase">{subtitle}</span>}
    </div>
  </div>
);

// -----------------------------------------------------------------------------
// MAIN COMPONENT
// -----------------------------------------------------------------------------
export default function XMSRoyaltyCalculator() {
  const [baseSalary, setBaseSalary] = useState(DEFAULT_BASE_SALARY);
  const [vatRate, setVatRate] = useState(0.1);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingSalary, setEditingSalary] = useState(false);

  const [stores, setStores] = useState(() => [{
    id: Date.now(),
    name: 'Chi nhánh 1',
    type: 'cafe',
    area: '100',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
    hasAccountFee: true,
    hasBoxFee: false,
    boxCount: 1,
    discountAccount: 0,
    discountQTG: 0,
    discountQLQ: 0,
  }]);

  const [activeTab, setActiveTab] = useState(stores[0].id);

  const addStore = () => {
    const newId = Date.now();
    setStores([...stores, {
      id: newId,
      name: `Chi nhánh ${stores.length + 1}`,
      type: 'cafe',
      area: '100',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
      hasAccountFee: true,
      hasBoxFee: false,
      boxCount: 1,
      discountAccount: 0,
      discountQTG: 0,
      discountQLQ: 0,
    }]);
    setActiveTab(newId);
    setSearchTerm('');
  };

  const removeStore = (id) => {
    if (stores.length === 1) return;
    const newStores = stores.filter(s => s.id !== id);
    setStores(newStores);
    if (activeTab === id) setActiveTab(newStores[0].id);
  };

  const updateStore = (id, field, value) => {
    setStores(stores.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const filteredStores = stores.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const activeStore = stores.find(s => s.id === activeTab) || stores[0];

  // Totals across all stores
  const totals = useMemo(() => {
    let subtotalAccount = 0, subtotalBox = 0, subtotalQTG = 0, subtotalQLQ = 0;
    stores.forEach(s => {
      const numericArea = Number(s.area) || 0;
      const duration = calculateDurationMonths(s.startDate, s.endDate);
      const coef = calculateCoef(s.type, numericArea);
      const yearlyFeeBase = coef * baseSalary;
      const periodFeeBase = (yearlyFeeBase / 12) * duration;
      subtotalQTG += periodFeeBase * (1 - s.discountQTG / 100);
      subtotalQLQ += periodFeeBase * (1 - s.discountQLQ / 100);
      subtotalAccount += s.hasAccountFee ? (600000 / 12) * duration * (1 - s.discountAccount / 100) : 0;
      subtotalBox += s.hasBoxFee ? 2000000 * s.boxCount : 0;
    });
    const subtotal = subtotalQTG + subtotalQLQ + subtotalAccount + subtotalBox;
    const vat = subtotal * vatRate;
    const total = subtotal + vat;
    return { subtotalQTG, subtotalQLQ, subtotalAccount, subtotalBox, subtotal, vat, total };
  }, [stores, baseSalary, vatRate]);

  // Helpers for active store display
  const currentNumericArea = Number(activeStore.area) || 0;
  const currentDuration = calculateDurationMonths(activeStore.startDate, activeStore.endDate);
  const currentCoef = calculateCoef(activeStore.type, currentNumericArea);
  const currentYearlyFee = currentCoef * baseSalary;
  const currentPeriodFee = (currentYearlyFee / 12) * currentDuration;
  const currentStoreTotal = 
    currentPeriodFee * (1 - activeStore.discountQTG / 100) +
    currentPeriodFee * (1 - activeStore.discountQLQ / 100) +
    (activeStore.hasAccountFee ? (600000 / 12) * currentDuration * (1 - activeStore.discountAccount / 100) : 0) +
    (activeStore.hasBoxFee ? 2000000 * activeStore.boxCount : 0);

  // Per-store totals for sidebar meta
  const getStoreTotal = (s) => {
    const area = Number(s.area) || 0;
    const dur = calculateDurationMonths(s.startDate, s.endDate);
    const coef = calculateCoef(s.type, area);
    const yearly = coef * baseSalary;
    const periodBase = (yearly / 12) * dur;
    return periodBase * (1 - s.discountQTG/100)
         + periodBase * (1 - s.discountQLQ/100)
         + (s.hasAccountFee ? (600000/12) * dur * (1 - s.discountAccount/100) : 0)
         + (s.hasBoxFee ? 2000000 * s.boxCount : 0);
  };

  return (
    <div className="lx flex h-screen w-full bg-[#0a0a0a] text-neutral-200 overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: styles }} />

      {/* =========================================================== */}
      {/* SIDEBAR — store registry                                     */}
      {/* =========================================================== */}
      <aside className="w-[288px] flex-shrink-0 bg-[#0c0c0c] border-r border-[#141414] flex flex-col">
        {/* Brand block */}
        <div className="px-6 pt-6 pb-5">
          <div className="flex items-center gap-3 mb-4">
            <NCTMark size={26} />
            <div>
              <div className="text-[13px] font-semibold text-white tracking-tight leading-tight">XMusic Station</div>
              <div className="text-[9px] font-medium tracking-[0.22em] text-[#525252] uppercase leading-tight mt-0.5">Royalty Calculator</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[9px] tracking-[0.18em] text-[#3a3a3a] uppercase font-medium">
            <span className="w-1 h-1 rounded-full bg-[#CFF533] signal-dot" />
            <span>ND 17/2023 · Phụ lục 2</span>
          </div>
        </div>

        {/* Search */}
        <div className="px-6 pb-3">
          <div className="relative flex items-center border-b border-[#1a1a1a] focus-within:border-[#CFF533] transition-colors">
            <Search className="w-3.5 h-3.5 text-[#3a3a3a]" strokeWidth={1.8} />
            <input
              type="text"
              placeholder="Tìm cửa hàng"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent text-[12px] text-white py-2.5 px-2.5 focus:outline-none placeholder:text-[#404040]"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="text-[#525252] hover:text-white p-1">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Store list — editorial index style */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {filteredStores.map((store, idx) => {
            const storeTotal = getStoreTotal(store);
            const isActive = activeTab === store.id;
            const realIdx = stores.findIndex(s => s.id === store.id);
            return (
              <div
                key={store.id}
                onClick={() => setActiveTab(store.id)}
                className={`group relative flex items-start gap-3 px-3 py-3 cursor-pointer transition-colors ${
                  isActive ? 'bg-[#141414]' : 'hover:bg-[#111111]'
                }`}
              >
                {/* active rail */}
                {isActive && <span className="absolute left-0 top-3 bottom-3 w-[2px] bg-[#CFF533]" />}

                <span className={`text-[10px] font-normal tracking-[0.1em] tnum mt-[3px] ${isActive ? 'text-[#CFF533]' : 'text-[#3a3a3a]'}`}>
                  {String(realIdx + 1).padStart(2, '0')}
                </span>

                <div className="flex-1 min-w-0">
                  <div className={`text-[13px] font-medium truncate leading-tight ${isActive ? 'text-white' : 'text-neutral-300'}`}>
                    {store.name}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 text-[9px] tracking-[0.1em] text-[#525252] font-medium uppercase">
                    <span>{BUSINESS_TYPES[store.type].short}</span>
                    <span className="text-[#2a2a2a]">·</span>
                    <span className="tnum">{store.area}m²</span>
                  </div>
                  <div className="text-[10px] text-[#525252] tnum mt-1">
                    {formatVND(storeTotal)} ₫
                  </div>
                </div>

                {stores.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); removeStore(store.id); }}
                    className="opacity-0 group-hover:opacity-100 text-[#525252] hover:text-[#CFF533] transition-all mt-1"
                  >
                    <X className="w-3.5 h-3.5" strokeWidth={1.6} />
                  </button>
                )}
              </div>
            );
          })}

          {filteredStores.length === 0 && (
            <div className="text-center text-[11px] text-[#3a3a3a] mt-8 tracking-wide">
              Không tìm thấy chi nhánh
            </div>
          )}
        </div>

        {/* Add store button */}
        <div className="p-3 border-t border-[#141414]">
          <button
            onClick={addStore}
            className="w-full flex items-center justify-center gap-2 py-3 text-[11px] tracking-[0.18em] uppercase font-medium text-[#8a8a8a] hover:text-[#CFF533] hover:bg-[#111] transition-colors group"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
            <span>Thêm chi nhánh</span>
          </button>
        </div>
      </aside>

      {/* =========================================================== */}
      {/* MAIN                                                         */}
      {/* =========================================================== */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0a0a0a]">
        {/* Top bar — global settings */}
        <header className="h-14 border-b border-[#141414] flex items-center justify-between px-10">
          <div className="flex items-center gap-8 text-[10px] tracking-[0.18em] text-[#525252] uppercase font-medium">
            <span>BD Tool</span>
            <span className="text-[#2a2a2a]">/</span>
            <span className="text-neutral-300">Quotation Builder</span>
            <span className="text-[#2a2a2a]">/</span>
            <span className="tnum">{stores.length} {stores.length > 1 ? 'locations' : 'location'}</span>
          </div>

          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3 text-[10px] tracking-[0.18em] uppercase">
              <span className="text-[#525252] font-medium">Lương cơ sở</span>
              {editingSalary ? (
                <input
                  type="number"
                  value={baseSalary}
                  onChange={e => setBaseSalary(Number(e.target.value))}
                  onBlur={() => setEditingSalary(false)}
                  onKeyDown={e => e.key === 'Enter' && setEditingSalary(false)}
                  autoFocus
                  className="bg-transparent border-b border-[#CFF533] text-white text-[12px] w-28 tnum focus:outline-none pb-0.5 tracking-normal"
                />
              ) : (
                <button
                  onClick={() => setEditingSalary(true)}
                  className="text-white text-[12px] tnum tracking-normal hover:text-[#CFF533] transition-colors font-medium"
                >
                  {formatVND(baseSalary)} ₫
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[920px] mx-auto px-10 pt-12 pb-40">

            {/* ============ STORE HEADLINE ============ */}
            <div className="mb-12">
              <div className="flex items-baseline gap-4 mb-2">
                <Eyebrow>Chi nhánh {String(stores.findIndex(s => s.id === activeStore.id) + 1).padStart(2, '0')} / {String(stores.length).padStart(2, '0')}</Eyebrow>
              </div>

              <div className="flex items-end justify-between gap-8 flex-wrap">
                <input
                  type="text"
                  value={activeStore.name}
                  onChange={e => updateStore(activeStore.id, 'name', e.target.value)}
                  className="bg-transparent text-[40px] font-semibold text-white leading-none tracking-[-0.02em] focus:outline-none min-w-0 flex-1 border-b border-transparent hover:border-[#1f1f1f] focus:border-[#CFF533] transition-colors pb-2"
                />
                <div className="flex items-baseline gap-8 text-right">
                  <div>
                    <Eyebrow className="mb-1">Chu kỳ</Eyebrow>
                    <div className="text-[18px] font-semibold text-white tnum">
                      {currentDuration.toFixed(1)}<span className="text-[11px] text-[#525252] ml-1.5 tracking-[0.15em] uppercase font-medium">tháng</span>
                    </div>
                  </div>
                  <div>
                    <Eyebrow className="mb-1">Hệ số</Eyebrow>
                    <div className="text-[18px] font-semibold text-white tnum">
                      {currentCoef.toFixed(2)}
                    </div>
                  </div>
                  <div className="pl-8 border-l border-[#1a1a1a]">
                    <Eyebrow className="mb-1">Tổng (pre-VAT)</Eyebrow>
                    <div className="text-[22px] font-semibold text-[#CFF533] tnum">
                      {formatVND(currentStoreTotal)}<span className="text-[11px] text-[#525252] ml-1.5 font-medium">₫</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ============ SECTION 01 — FACILITY ============ */}
            <section className="mb-14">
              <SectionHeader index="01" title="Cơ sở vật chất" subtitle="Facility Profile" />

              <div className="grid grid-cols-12 gap-x-8 gap-y-8">
                <div className="col-span-7">
                  <Eyebrow className="mb-3">Mô hình kinh doanh</Eyebrow>
                  <select
                    value={activeStore.type}
                    onChange={e => updateStore(activeStore.id, 'type', e.target.value)}
                    className="field-input w-full bg-transparent text-white text-[14px] py-2 border-b border-[#1f1f1f] focus:outline-none appearance-none cursor-pointer"
                  >
                    {Object.entries(BUSINESS_TYPES).map(([key, {label}]) => (
                      <option key={key} value={key} className="bg-[#0c0c0c]">{label}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-5">
                  <Eyebrow className="mb-3">Diện tích phát nhạc</Eyebrow>
                  <div className="flex items-baseline gap-2 border-b border-[#1f1f1f] py-2 hover:border-[#2a2a2a] focus-within:border-[#CFF533] transition-colors">
                    <input
                      type="number"
                      min="1"
                      value={activeStore.area}
                      onChange={e => updateStore(activeStore.id, 'area', e.target.value)}
                      className="flex-1 bg-transparent text-white text-[14px] focus:outline-none tnum min-w-0"
                    />
                    <span className="text-[11px] text-[#525252] tracking-[0.15em] uppercase font-medium">m²</span>
                  </div>
                </div>

                <div className="col-span-6">
                  <Eyebrow className="mb-3">Bắt đầu</Eyebrow>
                  <input
                    type="date"
                    value={activeStore.startDate}
                    onChange={e => updateStore(activeStore.id, 'startDate', e.target.value)}
                    className="field-input w-full bg-transparent text-white text-[14px] py-2 border-b border-[#1f1f1f] focus:outline-none tnum"
                  />
                </div>

                <div className="col-span-6">
                  <Eyebrow className="mb-3">Kết thúc</Eyebrow>
                  <input
                    type="date"
                    value={activeStore.endDate}
                    onChange={e => updateStore(activeStore.id, 'endDate', e.target.value)}
                    className="field-input w-full bg-transparent text-white text-[14px] py-2 border-b border-[#1f1f1f] focus:outline-none tnum"
                  />
                </div>
              </div>
            </section>

            {/* ============ SECTION 02 — PLATFORM & DEVICE ============ */}
            <section className="mb-14">
              <SectionHeader index="02" title="Nền tảng & Thiết bị" subtitle="Platform · Picton Blue line" accent="#44CCFF" />

              <div className="grid grid-cols-12 gap-x-8 gap-y-10">
                {/* Account Fee */}
                <div className="col-span-12">
                  <div className="grid grid-cols-12 gap-8 items-start">
                    <div className="col-span-7">
                      <div className="flex items-start gap-4">
                        <button
                          onClick={() => updateStore(activeStore.id, 'hasAccountFee', !activeStore.hasAccountFee)}
                          className={`mt-0.5 w-4 h-4 flex items-center justify-center border transition-colors ${
                            activeStore.hasAccountFee
                              ? 'bg-[#44CCFF] border-[#44CCFF]'
                              : 'bg-transparent border-[#2a2a2a] hover:border-[#44CCFF]'
                          }`}
                        >
                          {activeStore.hasAccountFee && <Check className="w-3 h-3 text-black" strokeWidth={3} />}
                        </button>
                        <div className="flex-1">
                          <div className="text-[14px] font-medium text-white mb-0.5">Phí tài khoản NCT</div>
                          <div className="text-[11px] text-[#525252] tracking-wide">600.000 ₫ / năm · prorated theo chu kỳ</div>
                        </div>
                      </div>
                    </div>

                    <div className="col-span-5">
                      {activeStore.hasAccountFee ? (
                        <div>
                          <div className="flex items-baseline justify-between mb-3">
                            <Eyebrow>Chiết khấu</Eyebrow>
                            <div className="flex items-baseline gap-1">
                              <span className="text-[14px] font-semibold text-[#44CCFF] tnum">{activeStore.discountAccount}</span>
                              <span className="text-[10px] text-[#525252] tracking-[0.1em]">%</span>
                            </div>
                          </div>
                          <input
                            type="range" min="0" max="100" step="5"
                            value={activeStore.discountAccount}
                            onChange={e => updateStore(activeStore.id, 'discountAccount', Number(e.target.value))}
                            className="fader fader-picton"
                          />
                        </div>
                      ) : (
                        <div className="text-[11px] text-[#3a3a3a] tracking-wide text-right">Bỏ qua</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Box Fee */}
                <div className="col-span-12">
                  <div className="grid grid-cols-12 gap-8 items-start">
                    <div className="col-span-7">
                      <div className="flex items-start gap-4">
                        <button
                          onClick={() => updateStore(activeStore.id, 'hasBoxFee', !activeStore.hasBoxFee)}
                          className={`mt-0.5 w-4 h-4 flex items-center justify-center border transition-colors ${
                            activeStore.hasBoxFee
                              ? 'bg-[#44CCFF] border-[#44CCFF]'
                              : 'bg-transparent border-[#2a2a2a] hover:border-[#44CCFF]'
                          }`}
                        >
                          {activeStore.hasBoxFee && <Check className="w-3 h-3 text-black" strokeWidth={3} />}
                        </button>
                        <div className="flex-1">
                          <div className="text-[14px] font-medium text-white mb-0.5">Box phát nhạc (streaming device)</div>
                          <div className="text-[11px] text-[#525252] tracking-wide">2.000.000 ₫ / thiết bị · chi phí một lần</div>
                        </div>
                      </div>
                    </div>

                    <div className="col-span-5">
                      {activeStore.hasBoxFee ? (
                        <div className="flex items-baseline justify-between">
                          <Eyebrow>Số lượng</Eyebrow>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => updateStore(activeStore.id, 'boxCount', Math.max(1, activeStore.boxCount - 1))}
                              className="w-6 h-6 border border-[#1f1f1f] text-[#525252] hover:text-[#44CCFF] hover:border-[#44CCFF] flex items-center justify-center transition-colors"
                            >
                              <span className="text-[14px] leading-none">−</span>
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={activeStore.boxCount}
                              onChange={e => updateStore(activeStore.id, 'boxCount', Math.max(1, Number(e.target.value) || 1))}
                              className="w-10 bg-transparent text-center text-white text-[14px] font-semibold tnum focus:outline-none"
                            />
                            <button
                              onClick={() => updateStore(activeStore.id, 'boxCount', activeStore.boxCount + 1)}
                              className="w-6 h-6 border border-[#1f1f1f] text-[#525252] hover:text-[#44CCFF] hover:border-[#44CCFF] flex items-center justify-center transition-colors"
                            >
                              <span className="text-[14px] leading-none">+</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[11px] text-[#3a3a3a] tracking-wide text-right">Bỏ qua</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* ============ SECTION 03 — COPYRIGHT ============ */}
            <section className="mb-8">
              <SectionHeader index="03" title="Bản quyền" subtitle="Nhà nước · Pear line" />

              <div className="space-y-10">
                {/* QTG */}
                <div className="grid grid-cols-12 gap-8 items-start">
                  <div className="col-span-6">
                    <div className="text-[14px] font-medium text-white mb-1">Quyền Tác Giả</div>
                    <div className="flex items-center gap-2 text-[10px] tracking-[0.12em] uppercase text-[#525252] font-medium">
                      <span>VCPMC</span>
                      <span className="text-[#2a2a2a]">·</span>
                      <span className="tnum">Hệ số {currentCoef.toFixed(2)}</span>
                      <span className="text-[#2a2a2a]">·</span>
                      <span className="tnum">{currentDuration.toFixed(1)}m</span>
                    </div>
                  </div>

                  <div className="col-span-3">
                    <div className="flex items-baseline justify-between mb-3">
                      <Eyebrow>Chiết khấu</Eyebrow>
                      <div className="flex items-baseline gap-1">
                        <span className="text-[14px] font-semibold text-[#CFF533] tnum">{activeStore.discountQTG}</span>
                        <span className="text-[10px] text-[#525252]">%</span>
                      </div>
                    </div>
                    <input
                      type="range" min="0" max="100" step="5"
                      value={activeStore.discountQTG}
                      onChange={e => updateStore(activeStore.id, 'discountQTG', Number(e.target.value))}
                      className="fader fader-pear"
                    />
                  </div>

                  <div className="col-span-3 text-right">
                    <Eyebrow className="mb-1">Thành tiền</Eyebrow>
                    <div className="text-[17px] font-semibold text-white tnum">
                      {formatVND(currentPeriodFee * (1 - activeStore.discountQTG / 100))}
                      <span className="text-[10px] text-[#525252] ml-1 font-medium">₫</span>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-[#141414]" />

                {/* QLQ */}
                <div className="grid grid-cols-12 gap-8 items-start">
                  <div className="col-span-6">
                    <div className="text-[14px] font-medium text-white mb-1">Quyền Liên Quan</div>
                    <div className="flex items-center gap-2 text-[10px] tracking-[0.12em] uppercase text-[#525252] font-medium">
                      <span>RIAV</span>
                      <span className="text-[#2a2a2a]">·</span>
                      <span className="tnum">Hệ số {currentCoef.toFixed(2)}</span>
                      <span className="text-[#2a2a2a]">·</span>
                      <span className="tnum">{currentDuration.toFixed(1)}m</span>
                    </div>
                  </div>

                  <div className="col-span-3">
                    <div className="flex items-baseline justify-between mb-3">
                      <Eyebrow>Chiết khấu</Eyebrow>
                      <div className="flex items-baseline gap-1">
                        <span className="text-[14px] font-semibold text-[#CFF533] tnum">{activeStore.discountQLQ}</span>
                        <span className="text-[10px] text-[#525252]">%</span>
                      </div>
                    </div>
                    <input
                      type="range" min="0" max="100" step="5"
                      value={activeStore.discountQLQ}
                      onChange={e => updateStore(activeStore.id, 'discountQLQ', Number(e.target.value))}
                      className="fader fader-pear"
                    />
                  </div>

                  <div className="col-span-3 text-right">
                    <Eyebrow className="mb-1">Thành tiền</Eyebrow>
                    <div className="text-[17px] font-semibold text-white tnum">
                      {formatVND(currentPeriodFee * (1 - activeStore.discountQLQ / 100))}
                      <span className="text-[10px] text-[#525252] ml-1 font-medium">₫</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

          </div>
        </div>

        {/* =========================================================== */}
        {/* BOTTOM BAR — grand totals                                    */}
        {/* =========================================================== */}
        <div className="border-t border-[#141414] bg-[#0c0c0c] flex-shrink-0">
          <div className="max-w-[920px] mx-auto px-10 py-5">
            <div className="grid grid-cols-12 gap-8 items-end">

              {/* Breakdown */}
              <div className="col-span-7 grid grid-cols-4 gap-6">
                <div>
                  <Eyebrow className="mb-1.5">Q. Tác Giả</Eyebrow>
                  <div className="text-[14px] font-medium text-neutral-300 tnum">{formatVND(totals.subtotalQTG)}</div>
                </div>
                <div>
                  <Eyebrow className="mb-1.5">Q. Liên Quan</Eyebrow>
                  <div className="text-[14px] font-medium text-neutral-300 tnum">{formatVND(totals.subtotalQLQ)}</div>
                </div>
                <div>
                  <Eyebrow className="mb-1.5">Tài khoản</Eyebrow>
                  <div className="text-[14px] font-medium text-neutral-300 tnum">{formatVND(totals.subtotalAccount)}</div>
                </div>
                <div>
                  <Eyebrow className="mb-1.5">Box</Eyebrow>
                  <div className="text-[14px] font-medium text-neutral-300 tnum">{formatVND(totals.subtotalBox)}</div>
                </div>
              </div>

              {/* Subtotal + VAT */}
              <div className="col-span-2 pl-6 border-l border-[#1a1a1a] space-y-1">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-[10px] tracking-[0.15em] uppercase text-[#525252] font-medium">Subtotal</span>
                  <span className="text-[12px] text-neutral-300 tnum">{formatVND(totals.subtotal)}</span>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <select
                    value={vatRate}
                    onChange={e => setVatRate(Number(e.target.value))}
                    className="bg-transparent text-[10px] tracking-[0.15em] uppercase text-[#525252] font-medium focus:outline-none cursor-pointer hover:text-white transition-colors appearance-none"
                    style={{ backgroundImage: 'none', paddingRight: 0 }}
                  >
                    <option value={0} className="bg-[#0c0c0c]">VAT 0%</option>
                    <option value={0.08} className="bg-[#0c0c0c]">VAT 8%</option>
                    <option value={0.1} className="bg-[#0c0c0c]">VAT 10%</option>
                  </select>
                  <span className="text-[12px] text-[#525252] tnum">+{formatVND(totals.vat)}</span>
                </div>
              </div>

              {/* GRAND TOTAL — hero */}
              <div className="col-span-3 text-right">
                <Eyebrow className="mb-1">Tổng thanh toán</Eyebrow>
                <div className="flex items-baseline justify-end gap-2">
                  <span className="text-[32px] font-black text-white tnum tracking-[-0.02em] leading-none">
                    {formatVND(totals.total)}
                  </span>
                  <span className="text-[13px] font-medium text-[#CFF533] leading-none">₫</span>
                </div>
              </div>

            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
