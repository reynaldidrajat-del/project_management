import { useEffect } from 'react';

// Ukuran modal yang tersedia dan class Tailwind-nya.
const sizeClassNames = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-2xl',
  xl: 'max-w-3xl',
  '2xl': 'max-w-5xl',
};

// Komponen modal umum untuk form dan detail data.
function Modal({ open, title, description, size = 'md', children, footer, onClose }) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    // Menutup modal ketika user menekan tombol Escape.
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div
        aria-modal="true"
        className={`card max-h-[92vh] w-full overflow-hidden ${sizeClassNames[size] || sizeClassNames.md}`}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-text-dark">{title}</h2>
            {description ? <p className="mt-1 text-sm text-text-muted">{description}</p> : null}
          </div>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-white text-xl leading-none text-text-muted transition hover:bg-slate-50 hover:text-text-dark"
            type="button"
            onClick={onClose}
          >
            x
          </button>
        </div>

        <div className="max-h-[calc(92vh-150px)] overflow-y-auto px-5 py-5">{children}</div>

        {footer ? <div className="flex justify-end gap-2 border-t border-border bg-slate-50 px-5 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}

export default Modal;
