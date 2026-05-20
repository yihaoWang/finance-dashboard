import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  children: ReactNode;
  width?: number;
  className?: string;  // applied to popover
};

export const InfoTooltip = ({ children, width = 280, className }: Props) => {
  const iconRef = useRef<HTMLSpanElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const computePos = () => {
    const icon = iconRef.current;
    if (!icon) return;
    const r = icon.getBoundingClientRect();
    const margin = 8;
    const vw = window.innerWidth;
    // prefer left-aligned with icon; flip to right-anchored if it would overflow
    let left = r.left;
    if (left + width + margin > vw) left = Math.max(margin, vw - width - margin);
    const top = r.bottom + 6;
    setPos({ top: top + window.scrollY, left: left + window.scrollX });
  };

  useLayoutEffect(() => {
    if (!open) return;
    computePos();
    const onScrollOrResize = () => computePos();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open]);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (iconRef.current?.contains(t)) return;
      if (popRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <>
      <span
        ref={iconRef}
        className="relative inline-flex"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <span className="cursor-help inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-200 text-[10px] text-slate-600 hover:bg-slate-300 transition">
          i
        </span>
      </span>
      {open && pos !== null &&
        createPortal(
          <div
            ref={popRef}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            className={`fixed z-[1000] rounded-lg bg-white border border-slate-200 p-3 text-xs text-left text-slate-700 leading-relaxed shadow-xl ${className ?? ''}`}
            style={{ top: pos.top - window.scrollY, left: pos.left - window.scrollX, width }}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
};
