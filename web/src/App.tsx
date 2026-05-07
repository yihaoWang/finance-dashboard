import { useState } from 'react';
import { StockDetail } from './pages/StockDetail';

export const App = () => {
  const [symbol, setSymbol] = useState('2330');
  const [input, setInput] = useState('2330');

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6">
      <header className="flex gap-3 mb-6">
        <input
          className="flex-1 max-w-md bg-ink-900 border border-ink-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="輸入股票代號（例：2330）"
        />
        <button
          type="button"
          onClick={() => setSymbol(input.trim().toUpperCase())}
          className="px-4 py-2 rounded-lg bg-accent text-white text-sm"
        >
          查詢
        </button>
      </header>
      <StockDetail symbol={symbol} />
    </div>
  );
};
