type Props = {
  input: string;
  onInputChange: (v: string) => void;
  onSubmit: () => void;
};

const TABS = ['總覽', '基本面', '技術面', '籌碼', '宏觀'];

export const TopNav = ({ input, onInputChange, onSubmit }: Props) => (
  <header className="sticky top-0 z-20 backdrop-blur bg-ink-950/80 border-b border-ink-700">
    <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent to-accent-soft" />
        <span className="font-semibold text-zinc-100">Tickr</span>
      </div>
      <div className="flex-1 min-w-[240px] max-w-md ml-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="relative"
        >
          <input
            className="w-full bg-ink-900 border border-ink-700 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-accent"
            placeholder="輸入股票代號或名稱（例：2330、台積電）"
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
          />
          <svg
            className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
            />
          </svg>
        </form>
      </div>
      <nav className="flex items-center gap-1 text-sm text-zinc-400">
        {TABS.map((t, i) => (
          <button
            key={t}
            type="button"
            className={`px-3 py-1.5 rounded-md hover:bg-ink-800 ${
              i === 0 ? 'text-zinc-100 bg-ink-800' : ''
            }`}
          >
            {t}
          </button>
        ))}
      </nav>
      <button
        type="button"
        onClick={onSubmit}
        className="ml-auto px-3 py-1.5 rounded-md bg-accent text-white text-sm"
      >
        查詢
      </button>
    </div>
  </header>
);
