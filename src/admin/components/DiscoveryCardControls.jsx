import { useState } from 'react';
import { safeVisualUrl } from '../../lib/homepageAppearance.js';
import { uploadHomepageImage } from '../../lib/homepageImageUpload.js';
import { makeDiscoveryId, MAX_DISCOVERY_CARDS } from '../../lib/homeDiscovery.js';
import DiscoveryProductPicker from './DiscoveryProductPicker.jsx';

// ============================================================
// Admin editor for the two homepage discovery rails.
//
// Each rail is an ordered list of cards. A card owns its display name, its
// artwork, its hand-picked products, its position and whether it is shown at
// all. Everything is stored in the existing `homepage` site_settings row —
// no new key, no table, no migration.
//
// WHAT THIS IS NOT: it is not a catalogue editor. Adding a card here does not
// create a category; deleting one does not delete a category, a product or an
// order. These cards are homepage merchandising, and the confirmation on
// delete says so in as many words.
//
// The rows are collapsed by default because there are a lot of them — the
// summary carries the thumbnail, the name and the status so the list stays
// scannable, and only the row being worked on is open.
// ============================================================

function ImageField({ label, value, onChange, onBusy }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const preview = safeVisualUrl(value);
  const invalid = !!value && !preview;

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true); onBusy(1); setErr('');
    try {
      onChange(await uploadHomepageImage(file));
    } catch (ex) {
      setErr(ex.message || 'Upload failed.');
    }
    setBusy(false); onBusy(-1);
  }

  return (
    <div className="adm-dc__image">
      <label className="label">Image</label>
      <input
        className="input"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Leave empty to use the built-in image"
        aria-label={`${label} image URL`}
      />
      {invalid && <p className="hint err">Not a usable image URL — it will be ignored.</p>}
      {err && <p className="hint err">{err}</p>}
      <div className="adm-disc-row__actions">
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={pick} disabled={busy}
          aria-label={`Upload an image for ${label}`} />
        {value && (
          <button type="button" className="btn btn-sm btn-light" onClick={() => onChange('')}>
            Use default
          </button>
        )}
        {busy && <span className="hint">Uploading…</span>}
      </div>
    </div>
  );
}

function CardEditor({ card, index, total, kind, catalogue, onPatch, onMove, onRemove, onBusy }) {
  const patch = (fields) => onPatch({ ...card, ...fields });

  return (
    <details className={`adm-dc${card.enabled ? '' : ' adm-dc--off'}`}>
      <summary className="adm-dc__sum">
        <span className="adm-disc-row__thumb">
          {safeVisualUrl(card.image)
            ? <img src={safeVisualUrl(card.image)} alt="" />
            : <span className="adm-disc-row__empty">Default</span>}
        </span>
        <span className="adm-dc__title">
          <strong>{card.name}</strong>
          <span className="hint">
            {card.productSlugs.length
              ? `${card.productSlugs.length} product${card.productSlugs.length === 1 ? '' : 's'}`
              : 'No products chosen'}
            {card.group ? ` · ${card.group}` : ''}
            {` · ${card.id}`}
          </span>
        </span>
        {!card.enabled && <span className="adm-dc__badge">Hidden</span>}
      </summary>

      <div className="adm-dc__body">
        <div className="field">
          <label className="label">Display name</label>
          <input className="input" value={card.name} maxLength={60}
            onChange={(e) => patch({ name: e.target.value })} />
          {/* The id is generated once and shown, never edited: it is what the
              saved image, the saved products and any shared link hang on. */}
          <p className="hint">Internal id <code>{card.id}</code> — fixed, so renaming is always safe.</p>
        </div>

        {kind === 'concern' && (
          <div className="field">
            <label className="label">Group <span className="hint">(optional)</span></label>
            <input className="input" value={card.group || ''} maxLength={40}
              placeholder="Skin, Hair, Wellness, Personal care"
              onChange={(e) => patch({ group: e.target.value })} />
          </div>
        )}

        <ImageField label={card.name} value={card.image} onBusy={onBusy}
          onChange={(image) => patch({ image })} />

        <DiscoveryProductPicker
          label={card.name}
          catalogue={catalogue}
          value={card.productSlugs}
          onChange={(productSlugs) => patch({ productSlugs })}
          fallbackHint={kind === 'concern'
            ? 'None chosen. A built-in concern falls back to matching the catalogue automatically; a concern you created stays hidden until you choose products.'
            : 'None chosen. A card matching a real catalogue category opens that category; a card you created stays hidden until you choose products.'}
        />

        <div className="adm-dc__foot">
          <button type="button" className="btn btn-sm btn-light" onClick={() => onMove(-1)} disabled={index === 0}>
            ↑ Move up
          </button>
          <button type="button" className="btn btn-sm btn-light" onClick={() => onMove(1)} disabled={index === total - 1}>
            ↓ Move down
          </button>
          <button type="button" className="btn btn-sm btn-light" onClick={() => patch({ enabled: !card.enabled })}>
            {card.enabled ? 'Disable' : 'Enable'}
          </button>
          <button type="button" className="btn btn-sm adm-dc__del" onClick={onRemove}>
            Delete
          </button>
        </div>
      </div>
    </details>
  );
}

function CardList({ title, hint, kind, cards, catalogue, onChange, onBusy }) {
  const [draft, setDraft] = useState('');
  const noun = kind === 'concern' ? 'concern' : 'category';
  const full = cards.length >= MAX_DISCOVERY_CARDS;

  const patchAt = (i) => (next) => onChange(cards.map((c, j) => (j === i ? next : c)));
  const moveAt = (i) => (delta) => {
    const target = i + delta;
    if (target < 0 || target >= cards.length) return;
    const next = [...cards];
    [next[i], next[target]] = [next[target], next[i]];
    onChange(next);
  };
  const removeAt = (i) => () => {
    // Deleting a card removes a tile from the homepage. Nothing in the
    // catalogue is touched, and the confirmation has to say so plainly —
    // a Delete button next to a product list invites the wrong assumption.
    const ok = typeof window === 'undefined' || window.confirm(
      'Remove this Homepage discovery card? Products will not be deleted.',
    );
    if (ok) onChange(cards.filter((_, j) => j !== i));
  };
  const add = () => {
    const name = draft.trim();
    if (!name || full) return;
    onChange([...cards, {
      id: makeDiscoveryId(name, cards.map((c) => c.id)),
      name,
      image: '',
      productSlugs: [],
      enabled: true,
      ...(kind === 'concern' ? { group: '' } : {}),
    }]);
    setDraft('');
  };

  return (
    <div className="surface">
      <h2>{title}</h2>
      <p className="hint">{hint}</p>

      {cards.length === 0 && <p className="hint">No cards yet — add one below.</p>}

      {cards.map((card, i) => (
        <CardEditor
          key={card.id}
          card={card}
          index={i}
          total={cards.length}
          kind={kind}
          catalogue={catalogue}
          onPatch={patchAt(i)}
          onMove={moveAt(i)}
          onRemove={removeAt(i)}
          onBusy={onBusy}
        />
      ))}

      <div className="adm-dc__add">
        <input
          className="input"
          value={draft}
          maxLength={60}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={full ? `Limit of ${MAX_DISCOVERY_CARDS} cards reached` : `New ${noun} name…`}
          disabled={full}
          aria-label={`Name for a new ${noun} card`}
        />
        <button type="button" className="btn btn-sm" onClick={add} disabled={full || !draft.trim()}>
          + Add {noun}
        </button>
      </div>
    </div>
  );
}

export default function DiscoveryCardControls({
  categoryCards, concernCards, onCategoryCardsChange, onConcernCardsChange, catalogue = [], onBusy,
}) {
  return (
    <>
      <CardList
        title="Shop by Category"
        hint="The homepage category rail, in this order. These cards are merchandising — they do not create or change catalogue categories, and the round rail under the hero keeps following the real catalogue."
        kind="category"
        cards={categoryCards}
        catalogue={catalogue}
        onChange={onCategoryCardsChange}
        onBusy={onBusy}
      />
      <CardList
        title="Shop by Concerns"
        hint="The homepage concerns rail, in this order. Choose products to control a card exactly; a built-in concern with no products keeps matching the catalogue automatically."
        kind="concern"
        cards={concernCards}
        catalogue={catalogue}
        onChange={onConcernCardsChange}
        onBusy={onBusy}
      />
    </>
  );
}
