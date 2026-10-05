import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import Icon from './Icon.jsx';

export function FashionChooser({ onClose }) {
  const dialog = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const node = dialog.current;
    const opener = document.activeElement;
    const { overflow, paddingRight } = document.body.style;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    const padding = parseFloat(getComputedStyle(document.body).paddingRight) || 0;
    node.showModal(); // Native top layer, focus trap and Escape handling.
    document.body.style.overflow = 'hidden';
    if (gap > 0) document.body.style.paddingRight = `${padding + gap}px`;
    return () => {
      node.close();
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog ref={dialog} className="fashion-choice" aria-labelledby={titleId} onCancel={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="fashion-choice__inner">
        <button type="button" className="fashion-choice__close" aria-label="Close fashion selection" onClick={onClose} autoFocus><Icon name="x" size={22} /></button>
        <p className="fashion-choice__eyebrow">SORA LIFE / The fashion edit</p>
        <h2 id={titleId}>Find your kind of style.</h2>
        <p className="fashion-choice__intro">Three worlds. A style for every you.</p>
        <div className="fashion-choice__grid">
          <Link to="/fashion/men" className="fashion-choice__card fashion-choice__card--men" onClick={onClose}>
            <img src="/img/fashion-editorial/men-hero-desktop-1000.webp" alt="" width="1000" height="563" />
            <span><small>The everyday edit</small><strong>Men’s fashion <Icon name="arrowRight" size={22} /></strong><em>Explore the collection</em></span>
          </Link>
          <Link to="/fashion/women" className="fashion-choice__card fashion-choice__card--women" onClick={onClose}>
            <img src="/img/fashion-editorial/women-category-silk.webp" alt="" width="480" height="480" />
            <span><small>Tradition meets today</small><strong>Women’s fashion <Icon name="arrowRight" size={22} /></strong><em>Explore the collection</em></span>
          </Link>
          <div className="fashion-choice__card fashion-choice__card--kids" aria-disabled="true">
            <img src="/img/fashion-circle-kids.webp" alt="" width="640" height="640" />
            <span><small>Little personalities</small><strong>Kids’ fashion</strong><em>Coming soon</em></span>
          </div>
        </div>
        <Link to="/fashion" className="fashion-choice__all" onClick={onClose}>Browse all fashion <Icon name="arrowRight" size={15} /></Link>
      </div>
    </dialog>
  );
}

// Only the default Fashion doorway opens the chooser. Custom admin links
// and modified clicks retain normal link navigation and open-in-new-tab.
export default function FashionEntryLink({ to = '/fashion', children, onClick, ...props }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const isEntry = to === '/fashion' || to === '/fashion/';
  useEffect(() => { setOpen(false); }, [location.pathname, location.search]);
  function activate(event) {
    onClick?.(event);
    if (!isEntry || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || props.target === '_blank') return;
    event.preventDefault();
    setOpen(true);
  }
  return <>
    <Link {...props} to={to} onClick={activate} aria-haspopup={isEntry ? 'dialog' : undefined}>{children}</Link>
    {open && typeof document !== 'undefined' && createPortal(<FashionChooser onClose={() => setOpen(false)} />, document.body)}
  </>;
}
