'use client';

import { useEffect, useRef } from 'react';

/** The desk's sheet: a native modal dialog styled as a bottom sheet — focus
 *  is held inside while open, Escape and the scrim close it, and focus
 *  returns to whatever opened it. The phone's situation board, and in
 *  picture mode the full text of a slip or a call. */
export default function Sheet({ open, onClose, title, id = 'cr-sheet-title', className, children }: {
  open: boolean; onClose: () => void; title: string; id?: string; className?: string; children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className={`cr-sheet${className ? ` ${className}` : ''}`} aria-labelledby={id} onClose={onClose}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cr-sheet-head">
        <h2 id={id}>{title}</h2>
        <button type="button" className="cr-sheet-close" onClick={onClose}>Close</button>
      </div>
      {open && children}
    </dialog>
  );
}
