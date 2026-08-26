// Reference-counted body scroll lock.
//
// Previously the header locked scrolling by writing document.body.style.overflow
// directly from two independent effects (the nav drawer and the mobile search
// overlay). Whichever closed FIRST cleared the lock, so closing the search
// overlay while the drawer was still open let the page scroll behind it.
// Counting the locks fixes that: scrolling resumes only when the last holder
// releases.
//
// It also compensates for the scrollbar width, so locking no longer shifts the
// layout horizontally on desktop when the scrollbar disappears.

let locks = 0;
let previousOverflow = '';
let previousPaddingRight = '';

export function lockScroll() {
  if (typeof document === 'undefined') return;
  locks += 1;
  if (locks > 1) return;

  const body = document.body;
  previousOverflow = body.style.overflow;
  previousPaddingRight = body.style.paddingRight;

  const gap = window.innerWidth - document.documentElement.clientWidth;
  body.style.overflow = 'hidden';
  if (gap > 0) {
    const current = parseFloat(window.getComputedStyle(body).paddingRight) || 0;
    body.style.paddingRight = `${current + gap}px`;
  }
}

export function unlockScroll() {
  if (typeof document === 'undefined') return;
  if (locks === 0) return;
  locks -= 1;
  if (locks > 0) return;

  document.body.style.overflow = previousOverflow;
  document.body.style.paddingRight = previousPaddingRight;
}
