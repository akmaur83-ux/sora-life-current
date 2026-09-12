import { j as jsxRuntimeExports, bl as HOMEPAGE_VISUAL_FIELDS, r as reactExports, bm as safeVisualUrl, bn as MAX_CONCERN_PRODUCTS, bo as searchCatalogueForPicker, bp as productGallery, bq as MAX_DISCOVERY_CARDS, br as makeDiscoveryId, bs as sanitizeHomepageVisuals, bt as normalizeDiscovery, a as adminGetSetting, bu as products, e as adminSetSetting, bv as discoveryPayload, bw as mergeHomepageVisuals, b5 as announceHomepageSaved } from '../bundle.js';
import { u as uploadHomepageImage } from './homepageImageUpload.js';

function ImageControl({
  id,
  label,
  value,
  onChange,
  onUploading
}) {
  const [busy, setBusy] = reactExports.useState(false);
  const [error, setError] = reactExports.useState('');
  const preview = safeVisualUrl(value);
  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    onUploading(1);
    setError('');
    try {
      onChange(await uploadHomepageImage(file));
    } catch (e) {
      setError(e.message || 'Upload failed.');
    } finally {
      setBusy(false);
      onUploading(-1);
    }
  }
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    className: "field hp-admin-image",
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
      className: "label",
      htmlFor: id,
      children: label
    }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
      id: id,
      className: "input",
      value: value,
      placeholder: "https://\u2026 or /public/\u2026",
      disabled: busy,
      onChange: e => {
        onChange(e.target.value);
        setError('');
      },
      "aria-describedby": `${id}-help`
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "hp-admin-image__actions",
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("label", {
        className: "btn btn-sm",
        children: [busy ? 'Uploading…' : 'Upload image', /*#__PURE__*/jsxRuntimeExports.jsx("input", {
          type: "file",
          accept: "image/png,image/jpeg,image/webp",
          disabled: busy,
          onChange: upload
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
        className: "btn btn-sm",
        type: "button",
        disabled: busy || !value,
        onClick: () => {
          onChange('');
          setError('');
        },
        children: "Clear image"
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "hint",
      id: `${id}-help`,
      children: "PNG, JPEG or WebP, up to 6 MB. Public HTTPS or local image path. Upload stores the file; Save publishes its appearance. Clear removes the reference, not the shared file."
    }), value && !preview && /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "error-text",
      role: "alert",
      children: "Enter a public HTTPS image URL or a local path. Private hosts, scripts, SVG and HTML are not allowed."
    }), error && /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "error-text",
      role: "alert",
      children: error
    }), preview && /*#__PURE__*/jsxRuntimeExports.jsx("img", {
      className: "hp-admin-image__preview",
      src: preview,
      alt: `${label} preview`,
      onError: () => setError('Image could not load. Check its public URL.')
    }, preview)]
  });
}
function HomepageVisualControls({
  value,
  onChange,
  onUploading
}) {
  return /*#__PURE__*/jsxRuntimeExports.jsx("div", {
    className: "hp-admin-visuals",
    children: Object.entries(HOMEPAGE_VISUAL_FIELDS).map(([group, fields]) => /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
      className: "surface",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
        children: group === 'categoryStrip' ? 'Category strip appearance' : 'Offers appearance'
      }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
        className: "hint",
        children: group === 'categoryStrip' ? 'Decorate the strip behind the existing category images and links. Enable the background to show images and decorations. Height always follows the categories.' : 'Style the curated Homepage promotions gallery. Only existing active, in-window Homepage promotions appear; these settings never create offers or change prices.'
      }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
        className: "hp-admin-fields",
        children: Object.entries(fields).map(([key, field]) => {
          const id = `homepage-${group}-${key}`;
          const current = value[group][key];
          // An upload may finish after other fields change; patch the latest state.
          const change = next => onChange(latest => ({
            ...latest,
            [group]: {
              ...latest[group],
              [key]: next
            }
          }));
          if (field.type === 'image') return /*#__PURE__*/jsxRuntimeExports.jsx(ImageControl, {
            id: id,
            label: field.label,
            value: current,
            onChange: change,
            onUploading: onUploading
          }, key);
          return /*#__PURE__*/jsxRuntimeExports.jsx("div", {
            className: "field",
            children: field.type === 'boolean' ? /*#__PURE__*/jsxRuntimeExports.jsxs("label", {
              className: "hp-admin-check",
              htmlFor: id,
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
                id: id,
                type: "checkbox",
                checked: current,
                onChange: e => change(e.target.checked)
              }), field.label]
            }) : /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
                className: "label",
                htmlFor: id,
                children: field.label
              }), field.type === 'select' ? /*#__PURE__*/jsxRuntimeExports.jsx("select", {
                id: id,
                className: "input",
                value: current,
                onChange: e => change(typeof field.value === 'number' ? Number(e.target.value) : e.target.value),
                children: field.options.map(option => /*#__PURE__*/jsxRuntimeExports.jsx("option", {
                  value: option,
                  children: option
                }, option))
              }) : /*#__PURE__*/jsxRuntimeExports.jsx("input", {
                id: id,
                className: "input",
                type: field.type,
                value: current,
                min: field.min,
                max: field.max,
                step: field.step,
                onChange: e => change(field.type === 'number' && e.target.value !== '' ? Number(e.target.value) : e.target.value)
              })]
            })
          }, key);
        })
      })]
    }, group))
  });
}

const RESULT_LIMIT = 8;
function thumbUrl(product) {
  const first = productGallery(product)[0];
  return first?.url || product?.image || '';
}
function Thumb({
  product
}) {
  const url = thumbUrl(product);
  return /*#__PURE__*/jsxRuntimeExports.jsx("span", {
    className: "adm-pp__thumb",
    children: url ? /*#__PURE__*/jsxRuntimeExports.jsx("img", {
      src: url,
      alt: "",
      loading: "lazy",
      decoding: "async"
    }) : null
  });
}
function DiscoveryProductPicker({
  label,
  catalogue,
  value,
  onChange,
  fallbackHint
}) {
  const [term, setTerm] = reactExports.useState('');
  const selected = Array.isArray(value) ? value : [];
  const full = selected.length >= MAX_CONCERN_PRODUCTS;
  const bySlug = reactExports.useMemo(() => new Map((catalogue || []).map(p => [p.slug, p])), [catalogue]);
  const results = reactExports.useMemo(() => searchCatalogueForPicker(catalogue, term, {
    exclude: selected,
    limit: RESULT_LIMIT
  }), [term, catalogue, selected]);
  const add = slug => {
    if (!full && !selected.includes(slug)) onChange([...selected, slug]);
    setTerm('');
  };
  const remove = slug => onChange(selected.filter(s => s !== slug));
  const move = (index, delta) => {
    const next = [...selected];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    className: "adm-pp",
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
      className: "label",
      htmlFor: `pp-${label}`,
      children: "Linked products"
    }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "hint",
      children: selected.length ? `${selected.length} chosen — this card opens exactly these, in this order.` : fallbackHint
    }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
      id: `pp-${label}`,
      className: "input",
      type: "search",
      autoComplete: "off",
      value: term,
      onChange: e => setTerm(e.target.value),
      placeholder: full ? `Limit of ${MAX_CONCERN_PRODUCTS} reached` : 'Search products by name…',
      disabled: full,
      "aria-label": `Search products to link to ${label}`
    }), term.trim() && /*#__PURE__*/jsxRuntimeExports.jsx("ul", {
      className: "adm-pp__results",
      children: results.length ? results.map(p => /*#__PURE__*/jsxRuntimeExports.jsx("li", {
        children: /*#__PURE__*/jsxRuntimeExports.jsxs("button", {
          type: "button",
          className: "adm-pp__result",
          onClick: () => add(p.slug),
          children: [/*#__PURE__*/jsxRuntimeExports.jsx(Thumb, {
            product: p
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
            className: "adm-pp__name",
            children: [p.name, p.form ? /*#__PURE__*/jsxRuntimeExports.jsxs("em", {
              children: [" \xB7 ", p.form]
            }) : null]
          }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
            className: "adm-pp__add",
            children: "Add"
          })]
        })
      }, p.slug)) : /*#__PURE__*/jsxRuntimeExports.jsxs("li", {
        className: "adm-pp__none",
        children: ["No product matches \u201C", term.trim(), "\u201D."]
      })
    }), selected.length > 0 && /*#__PURE__*/jsxRuntimeExports.jsx("ol", {
      className: "adm-pp__chosen",
      children: selected.map((slug, i) => {
        const product = bySlug.get(slug);
        return /*#__PURE__*/jsxRuntimeExports.jsxs("li", {
          children: [product ? /*#__PURE__*/jsxRuntimeExports.jsx(Thumb, {
            product: product
          }) : /*#__PURE__*/jsxRuntimeExports.jsx("span", {
            className: "adm-pp__thumb"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
            className: "adm-pp__name",
            children: product ? product.name : /*#__PURE__*/jsxRuntimeExports.jsxs("em", {
              children: ["Not in the catalogue \u2014 ", slug]
            })
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
            className: "adm-pp__order",
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
              type: "button",
              onClick: () => move(i, -1),
              disabled: i === 0,
              "aria-label": `Move ${product?.name || slug} up`,
              children: "\u2191"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
              type: "button",
              onClick: () => move(i, 1),
              disabled: i === selected.length - 1,
              "aria-label": `Move ${product?.name || slug} down`,
              children: "\u2193"
            })]
          }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
            type: "button",
            className: "adm-pp__rm",
            onClick: () => remove(slug),
            "aria-label": `Remove ${product?.name || slug} from ${label}`,
            children: "\xD7"
          })]
        }, slug);
      })
    })]
  });
}

function ImageField({
  label,
  value,
  onChange,
  onBusy
}) {
  const [busy, setBusy] = reactExports.useState(false);
  const [err, setErr] = reactExports.useState('');
  const preview = safeVisualUrl(value);
  const invalid = !!value && !preview;
  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    onBusy(1);
    setErr('');
    try {
      onChange(await uploadHomepageImage(file));
    } catch (ex) {
      setErr(ex.message || 'Upload failed.');
    }
    setBusy(false);
    onBusy(-1);
  }
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    className: "adm-dc__image",
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
      className: "label",
      children: "Image"
    }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
      className: "input",
      value: value || '',
      onChange: e => onChange(e.target.value),
      placeholder: "Leave empty to use the built-in image",
      "aria-label": `${label} image URL`
    }), invalid && /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "hint err",
      children: "Not a usable image URL \u2014 it will be ignored."
    }), err && /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "hint err",
      children: err
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm-disc-row__actions",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
        type: "file",
        accept: "image/png,image/jpeg,image/webp",
        onChange: pick,
        disabled: busy,
        "aria-label": `Upload an image for ${label}`
      }), value && /*#__PURE__*/jsxRuntimeExports.jsx("button", {
        type: "button",
        className: "btn btn-sm btn-light",
        onClick: () => onChange(''),
        children: "Use default"
      }), busy && /*#__PURE__*/jsxRuntimeExports.jsx("span", {
        className: "hint",
        children: "Uploading\u2026"
      })]
    })]
  });
}
function CardEditor({
  card,
  index,
  total,
  kind,
  catalogue,
  onPatch,
  onMove,
  onRemove,
  onBusy
}) {
  const patch = fields => onPatch({
    ...card,
    ...fields
  });
  return /*#__PURE__*/jsxRuntimeExports.jsxs("details", {
    className: `adm-dc${card.enabled ? '' : ' adm-dc--off'}`,
    children: [/*#__PURE__*/jsxRuntimeExports.jsxs("summary", {
      className: "adm-dc__sum",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
        className: "adm-disc-row__thumb",
        children: safeVisualUrl(card.image) ? /*#__PURE__*/jsxRuntimeExports.jsx("img", {
          src: safeVisualUrl(card.image),
          alt: ""
        }) : /*#__PURE__*/jsxRuntimeExports.jsx("span", {
          className: "adm-disc-row__empty",
          children: "Default"
        })
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
        className: "adm-dc__title",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
          children: card.name
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
          className: "hint",
          children: [card.productSlugs.length ? `${card.productSlugs.length} product${card.productSlugs.length === 1 ? '' : 's'}` : 'No products chosen', card.group ? ` · ${card.group}` : '', ` · ${card.id}`]
        })]
      }), !card.enabled && /*#__PURE__*/jsxRuntimeExports.jsx("span", {
        className: "adm-dc__badge",
        children: "Hidden"
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm-dc__body",
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "field",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
          className: "label",
          children: "Display name"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
          className: "input",
          value: card.name,
          maxLength: 60,
          onChange: e => patch({
            name: e.target.value
          })
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
          className: "hint",
          children: ["Internal id ", /*#__PURE__*/jsxRuntimeExports.jsx("code", {
            children: card.id
          }), " \u2014 fixed, so renaming is always safe."]
        })]
      }), kind === 'concern' && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "field",
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("label", {
          className: "label",
          children: ["Group ", /*#__PURE__*/jsxRuntimeExports.jsx("span", {
            className: "hint",
            children: "(optional)"
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
          className: "input",
          value: card.group || '',
          maxLength: 40,
          placeholder: "Skin, Hair, Wellness, Personal care",
          onChange: e => patch({
            group: e.target.value
          })
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsx(ImageField, {
        label: card.name,
        value: card.image,
        onBusy: onBusy,
        onChange: image => patch({
          image
        })
      }), /*#__PURE__*/jsxRuntimeExports.jsx(DiscoveryProductPicker, {
        label: card.name,
        catalogue: catalogue,
        value: card.productSlugs,
        onChange: productSlugs => patch({
          productSlugs
        }),
        fallbackHint: kind === 'concern' ? 'None chosen. A built-in concern falls back to matching the catalogue automatically; a concern you created stays hidden until you choose products.' : 'None chosen. A card matching a real catalogue category opens that category; a card you created stays hidden until you choose products.'
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-dc__foot",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
          type: "button",
          className: "btn btn-sm btn-light",
          onClick: () => onMove(-1),
          disabled: index === 0,
          children: "\u2191 Move up"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          type: "button",
          className: "btn btn-sm btn-light",
          onClick: () => onMove(1),
          disabled: index === total - 1,
          children: "\u2193 Move down"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          type: "button",
          className: "btn btn-sm btn-light",
          onClick: () => patch({
            enabled: !card.enabled
          }),
          children: card.enabled ? 'Disable' : 'Enable'
        }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          type: "button",
          className: "btn btn-sm adm-dc__del",
          onClick: onRemove,
          children: "Delete"
        })]
      })]
    })]
  });
}
function CardList({
  title,
  hint,
  kind,
  cards,
  catalogue,
  onChange,
  onBusy
}) {
  const [draft, setDraft] = reactExports.useState('');
  const noun = kind === 'concern' ? 'concern' : 'category';
  const full = cards.length >= MAX_DISCOVERY_CARDS;
  const patchAt = i => next => onChange(cards.map((c, j) => j === i ? next : c));
  const moveAt = i => delta => {
    const target = i + delta;
    if (target < 0 || target >= cards.length) return;
    const next = [...cards];
    [next[i], next[target]] = [next[target], next[i]];
    onChange(next);
  };
  const removeAt = i => () => {
    // Deleting a card removes a tile from the homepage. Nothing in the
    // catalogue is touched, and the confirmation has to say so plainly —
    // a Delete button next to a product list invites the wrong assumption.
    const ok = typeof window === 'undefined' || window.confirm('Remove this Homepage discovery card? Products will not be deleted.');
    if (ok) onChange(cards.filter((_, j) => j !== i));
  };
  const add = () => {
    const name = draft.trim();
    if (!name || full) return;
    onChange([...cards, {
      id: makeDiscoveryId(name, cards.map(c => c.id)),
      name,
      image: '',
      productSlugs: [],
      enabled: true,
      ...(kind === 'concern' ? {
        group: ''
      } : {})
    }]);
    setDraft('');
  };
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    className: "surface",
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
      children: title
    }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "hint",
      children: hint
    }), cards.length === 0 && /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "hint",
      children: "No cards yet \u2014 add one below."
    }), cards.map((card, i) => /*#__PURE__*/jsxRuntimeExports.jsx(CardEditor, {
      card: card,
      index: i,
      total: cards.length,
      kind: kind,
      catalogue: catalogue,
      onPatch: patchAt(i),
      onMove: moveAt(i),
      onRemove: removeAt(i),
      onBusy: onBusy
    }, card.id)), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm-dc__add",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
        className: "input",
        value: draft,
        maxLength: 60,
        onChange: e => setDraft(e.target.value),
        onKeyDown: e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add();
          }
        },
        placeholder: full ? `Limit of ${MAX_DISCOVERY_CARDS} cards reached` : `New ${noun} name…`,
        disabled: full,
        "aria-label": `Name for a new ${noun} card`
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("button", {
        type: "button",
        className: "btn btn-sm",
        onClick: add,
        disabled: full || !draft.trim(),
        children: ["+ Add ", noun]
      })]
    })]
  });
}
function DiscoveryCardControls({
  categoryCards,
  concernCards,
  onCategoryCardsChange,
  onConcernCardsChange,
  catalogue = [],
  onBusy
}) {
  return /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
    children: [/*#__PURE__*/jsxRuntimeExports.jsx(CardList, {
      title: "Shop by Category",
      hint: "The homepage category rail, in this order. These cards are merchandising \u2014 they do not create or change catalogue categories, and the round rail under the hero keeps following the real catalogue.",
      kind: "category",
      cards: categoryCards,
      catalogue: catalogue,
      onChange: onCategoryCardsChange,
      onBusy: onBusy
    }), /*#__PURE__*/jsxRuntimeExports.jsx(CardList, {
      title: "Shop by Concerns",
      hint: "The homepage concerns rail, in this order. Choose products to control a card exactly; a built-in concern with no products keeps matching the catalogue automatically.",
      kind: "concern",
      cards: concernCards,
      catalogue: catalogue,
      onChange: onConcernCardsChange,
      onBusy: onBusy
    })]
  });
}

function HomepageSettings() {
  const [notices, setNotices] = reactExports.useState(['', '', '']);
  const [bsTitle, setBsTitle] = reactExports.useState('Bestsellers');
  const [bsSub, setBsSub] = reactExports.useState('Our most loved products by our customers');
  const [loading, setLoading] = reactExports.useState(true);
  const [saving, setSaving] = reactExports.useState(false);
  const [msg, setMsg] = reactExports.useState('');
  const [err, setErr] = reactExports.useState('');
  const [visuals, setVisuals] = reactExports.useState(() => sanitizeHomepageVisuals());
  const [uploads, setUploads] = reactExports.useState(0);
  // The two discovery rails, as ordered card lists under `homepage.discovery`.
  // Before an admin has saved anything these are the built-in rails expressed
  // as cards, so the editor opens on exactly what the homepage is showing.
  const [categoryCards, setCategoryCards] = reactExports.useState(() => normalizeDiscovery({}).categoryCards);
  const [concernCards, setConcernCards] = reactExports.useState(() => normalizeDiscovery({}).concernCards);
  reactExports.useEffect(() => {
    (async () => {
      try {
        const ann = await adminGetSetting('announcement');
        const hp = await adminGetSetting('homepage');
        if (ann) {
          setNotices(ann.notices || ['', '', '']);
        }
        if (hp) {
          setBsTitle(hp.bestseller_title || 'Bestsellers');
          setBsSub(hp.bestseller_subtitle || '');
          setVisuals(sanitizeHomepageVisuals(hp.visuals));
          const cards = normalizeDiscovery(hp.discovery);
          setCategoryCards(cards.categoryCards);
          setConcernCards(cards.concernCards);
        }
      } catch (e) {
        setErr(e.message || String(e));
      }
      setLoading(false);
    })();
  }, []);
  async function save(e) {
    e.preventDefault();
    if (uploads) return;
    for (const [group, fields] of Object.entries(HOMEPAGE_VISUAL_FIELDS)) {
      for (const [key, field] of Object.entries(fields)) {
        if (field.type === 'image' && visuals[group][key] && !safeVisualUrl(visuals[group][key])) {
          setErr(`Please correct or clear ${field.label.toLowerCase()} before saving.`);
          return;
        }
      }
    }
    setSaving(true);
    setErr('');
    setMsg('');
    try {
      // Preserve existing story/editorial/unknown keys instead of replacing the
      // entire homepage JSON with just the fields this editor knows about.
      const [currentAnnouncement, currentHomepage] = await Promise.all([adminGetSetting('announcement'), adminGetSetting('homepage')]);
      // `free_shipping_threshold` is retired — shipping is a flat per-method
      // fee with no basket-value threshold. It is dropped rather than
      // preserved, so saving this page scrubs the stale key that migration
      // 0001 seeded into site_settings.
      const {
        free_shipping_threshold: _retiredThreshold,
        ...keptAnnouncement
      } = currentAnnouncement || {};
      await adminSetSetting('announcement', {
        ...keptAnnouncement,
        notices: notices.filter(Boolean)
      });
      // Sanitised on the way out too: an unusable image URL, a malformed id,
      // a duplicate or a slug that is not a product never reaches storage.
      const cleanDiscovery = discoveryPayload(categoryCards, concernCards);
      const next = mergeHomepageVisuals({
        ...currentHomepage,
        bestseller_title: bsTitle,
        bestseller_subtitle: bsSub,
        discovery: cleanDiscovery
      }, visuals);
      await adminSetSetting('homepage', next);
      setVisuals(next.visuals);
      setCategoryCards(cleanDiscovery.categoryCards);
      setConcernCards(cleanDiscovery.concernCards);
      announceHomepageSaved(next);
      setMsg('Saved. Homepage appearance is live; open storefront tabs update automatically.');
    } catch (ex) {
      setErr(ex.message || String(ex));
    }
    setSaving(false);
  }
  if (loading) return /*#__PURE__*/jsxRuntimeExports.jsx("p", {
    className: "muted",
    children: "Loading\u2026"
  });
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    className: "adm-form",
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm__head",
      children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h1", {
          children: "Homepage"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          children: "Homepage copy, appearance, the offers gallery and the two discovery rails."
        })]
      })
    }), err && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-banner err",
      children: err
    }), msg && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-banner ok",
      children: msg
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("form", {
      onSubmit: save,
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "surface",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
          children: "Announcement bar"
        }), [0, 1, 2].map(i => /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsxs("label", {
            className: "label",
            children: ["Notice ", i + 1]
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            value: notices[i] || '',
            onChange: e => setNotices(n => {
              const c = [...n];
              c[i] = e.target.value;
              return c;
            })
          })]
        }, i))]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "surface",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
          children: "Bestsellers section"
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "Title"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            value: bsTitle,
            onChange: e => setBsTitle(e.target.value)
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "Subtitle"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            value: bsSub,
            onChange: e => setBsSub(e.target.value)
          })]
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsx(HomepageVisualControls, {
        value: visuals,
        onChange: setVisuals,
        onUploading: delta => setUploads(n => n + delta)
      }), /*#__PURE__*/jsxRuntimeExports.jsx(DiscoveryCardControls, {
        categoryCards: categoryCards,
        concernCards: concernCards,
        onCategoryCardsChange: setCategoryCards,
        onConcernCardsChange: setConcernCards,
        catalogue: products,
        onBusy: delta => setUploads(n => n + delta)
      }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
        className: "btn",
        type: "submit",
        disabled: saving || uploads > 0,
        children: saving ? 'Saving…' : uploads ? 'Uploading images…' : 'Save changes'
      })]
    })]
  });
}

export { HomepageSettings as default };
//# sourceMappingURL=Homepage.js.map
