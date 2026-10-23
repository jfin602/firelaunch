import React, { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

let openModalCount = 0;
let originalBodyOverflow = '';

const focusable = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/** Shared Desert Heat modal behavior. A backdrop click is intentionally inert so forms are not discarded. */
export function StudioModal({ titleId, descriptionId, className = '', children, onClose, closeDisabled = false, initialFocus, guardUnsaved = false, resetDirtyKey }: {
  titleId: string; descriptionId?: string; className?: string; children: ReactNode;
  onClose: () => void; closeDisabled?: boolean; initialFocus?: RefObject<HTMLElement | null>; guardUnsaved?: boolean; resetDirtyKey?: string | number | undefined;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [changed, setChanged] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  useEffect(() => { setChanged(false); }, [resetDirtyKey]);
  const requestClose = () => {
    if (closeDisabled) return;
    if (guardUnsaved && changed) { setConfirmDiscard(true); return; }
    onClose();
  };
  useEffect(() => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const shell = document.querySelector<HTMLElement>('.app-shell');
    if (openModalCount === 0) originalBodyOverflow = document.body.style.overflow;
    openModalCount++;
    if (shell) shell.inert = true;
    document.body.style.overflow = 'hidden';
    const frame = window.setTimeout(() => {
      const first = dialog.current?.querySelector<HTMLElement>(focusable);
      (initialFocus?.current ?? first ?? dialog.current)?.focus();
    });
    return () => {
      window.clearTimeout(frame);
      openModalCount = Math.max(0, openModalCount - 1);
      if (openModalCount === 0) {
        if (shell) shell.inert = false;
        document.body.style.overflow = originalBodyOverflow;
      }
      if (opener.current?.isConnected) opener.current.focus();
    };
  }, []);
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation(); event.preventDefault();
      requestClose();
      return;
    }
    if (event.key !== 'Tab') return;
    event.stopPropagation();
    const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>(focusable) ?? [])
      .filter(element => element.getClientRects().length > 0);
    if (!controls.length) { event.preventDefault(); dialog.current?.focus(); return; }
    const first = controls[0]!; const last = controls.at(-1)!;
    if (event.shiftKey && (document.activeElement === first || !dialog.current?.contains(document.activeElement))) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !dialog.current?.contains(document.activeElement))) {
      event.preventDefault(); first.focus();
    }
  };
  return createPortal(<div className="fl-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) event.preventDefault(); }}>
    <div ref={dialog} className={`fl-modal ${className}`} role="dialog" aria-modal="true" aria-labelledby={titleId}
      aria-describedby={descriptionId} tabIndex={-1} onKeyDown={onKeyDown}
      onChangeCapture={event => { if ((event.target as HTMLElement).matches?.('input, select, textarea')) setChanged(true); }}
      onClickCapture={event => { if ((event.target as Element).closest?.('[data-modal-close]')) { event.preventDefault(); event.stopPropagation(); requestClose(); } }}>
      {children}</div>
    {confirmDiscard && <StudioModal titleId={`${titleId}-discard-title`} descriptionId={`${titleId}-discard-description`}
      className="fl-modal-compact" onClose={() => setConfirmDiscard(false)}>
      <ModalHeader title="Discard changes?" titleId={`${titleId}-discard-title`} descriptionId={`${titleId}-discard-description`}
        description="Your unsaved changes in this dialog will be lost."/>
      <ModalFooter><button type="button" onClick={() => setConfirmDiscard(false)}>Keep editing</button>
        <button className="primary" type="button" onClick={onClose}>Discard changes</button></ModalFooter>
    </StudioModal>}
  </div>, document.body);
}

export function ModalHeader({ eyebrow, title, titleId, description, descriptionId, onClose, closeDisabled = false, closeLabel }: {
  eyebrow?: string; title: string; titleId: string; description?: string; descriptionId?: string;
  onClose?: () => void; closeDisabled?: boolean; closeLabel?: string;
}) {
  return <header className="fl-modal-header"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}
    <h2 id={titleId}>{title}</h2>{description && <p id={descriptionId}>{description}</p>}</div>
    {onClose && <button className="fl-modal-close" type="button" disabled={closeDisabled} onClick={onClose} aria-label={closeLabel ?? `Close ${title}`} data-modal-close>Close ×</button>}
  </header>;
}

export function ModalFooter({ children }: { children: ReactNode }) {
  return <div className="fl-modal-footer">{children}</div>;
}

/** Reuses the New Page illustrated radio-card geometry for future visual choices. */
export function ModalOptionCard({ name, value, label, description, selected, onSelect, previewClass }: {
  name: string; value: string; label: string; description: string; selected: boolean;
  onSelect: () => void; previewClass: string;
}) {
  return <label className={`page-template-option ${selected ? 'selected' : ''}`}>
    <input type="radio" name={name} value={value} checked={selected} onChange={onSelect}/>
    <span className={`page-template-preview ${previewClass}`} aria-hidden="true"><i/><i/><i/><i/></span>
    <strong>{label}</strong><small>{description}</small>
  </label>;
}
