import { useRef } from 'react';

// ============================================================
// RollNumber (round 37, owner 2026-11-21): an amount whose changed digits roll in from
// below, like an odometer, when it changes. The text is exactly the amount (each changed
// character simply re-mounts with a CSS roll), so readers and copy-paste see "₹6,030".
// Only characters that are new since the amount last changed roll; nothing rolls on first show,
// and reduced motion keeps everything still (CSS).
// ============================================================
export const rollKeys = (text) => { const c = [...String(text ?? '')]; return c.map((ch, i) => `${c.length - i}-${ch}`); };

export default function RollNumber({ text }) {
  // { text, keys, fresh }: `fresh` holds the keys that rolled in with the latest change and
  // stays until the amount changes again, so other re-renders never cut a roll short.
  const memo = useRef(null);
  const value = String(text ?? '');
  const keys = rollKeys(value);
  const m = memo.current;
  if (!m) memo.current = { text: value, keys, fresh: new Set() };
  else if (m.text !== value) { const old = new Set(m.keys); memo.current = { text: value, keys, fresh: new Set(keys.filter((k) => !old.has(k))) }; }
  const { fresh } = memo.current;
  const chars = [...value];
  return (
    <span className="roll">
      {chars.map((ch, i) => <span key={keys[i]} className={fresh.has(keys[i]) && /\d/.test(ch) ? 'roll__d' : undefined}>{ch}</span>)}
    </span>
  );
}
