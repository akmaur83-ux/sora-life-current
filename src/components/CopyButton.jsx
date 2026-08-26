import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';

/**
 * Copy-to-clipboard button.
 *
 * Copying a tracking link is the single most common action in the Creator
 * Program, so it gets a real affordance and clear confirmation. Falls back to
 * a temporary textarea when the async Clipboard API is unavailable (insecure
 * context or older mobile browsers), which is exactly where creators live.
 */
export default function CopyButton({ value, className = 'btn btn-sm', label = 'Copy', copiedLabel = 'Copied' }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* nothing else to try */ }
      document.body.removeChild(ta);
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button type="button" className={className} onClick={copy} aria-live="polite">
      <Icon name={copied ? 'check' : 'copy'} size={15} />
      {copied ? copiedLabel : label}
    </button>
  );
}
