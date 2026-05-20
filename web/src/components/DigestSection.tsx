import type { DigestSection as DigestSectionType } from '@fd/shared';

type Props = { sections: DigestSectionType };

type SectionItem = { key: keyof DigestSectionType; heading: string; icon: string };

const SECTIONS: SectionItem[] = [
  { key: 'hard_data', heading: '硬數據', icon: '📊' },
  { key: 'framework', heading: '框架解讀', icon: '🔍' },
  { key: 'sentiment', heading: '情緒', icon: '🌡️' },
];

export const DigestSection = ({ sections }: Props) => (
  <div className="flex flex-col gap-4">
    {SECTIONS.map(({ key, heading, icon }) => (
      <div
        key={key}
        className="border border-ink-700 rounded-lg p-4 bg-ink-900/50"
      >
        <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
          <span>{icon}</span>
          <span>{heading}</span>
        </h3>
        <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
          {sections[key]}
        </p>
      </div>
    ))}
  </div>
);
