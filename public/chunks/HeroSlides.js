import { aY as sanitizeHeroCta, j as jsxRuntimeExports, aZ as HERO_CTA_FIELDS, r as reactExports, m as adminListHeroSlides, a as adminGetSetting, p as adminSeedDefaultHeroSlides, a_ as adminUpsertHeroSlide, a$ as mergeHeroCta, e as adminSetSetting, b0 as announceHomepageSaved, b1 as adminDeleteHeroSlide, b2 as adminReorderHeroSlides, b3 as uploadImage, b4 as uploadHeroVideo } from '../bundle.js';
import { u as uploadHomepageImage } from './homepageImageUpload.js';

const GROUPS = [['Position', ['desktopPosition', 'x', 'y', 'mobilePosition', 'mobileX', 'mobileY']], ['Button', ['width', 'paddingX', 'paddingY', 'backgroundColor', 'textColor', 'borderColor', 'borderWidth', 'radius', 'fontSize', 'fontWeight', 'opacity', 'shadow']], ['Texture', ['textureUrl', 'textureOpacity', 'textureFit']], ['Icon', ['iconUrl', 'iconSide', 'iconSize']]];
function VisualField({
  name,
  field,
  value,
  onChange,
  onUploading,
  setError,
  disabled = false
}) {
  async function upload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    onUploading(1);
    setError('');
    try {
      const url = await uploadHomepageImage(file);
      // Functional update prevents upload completion from reverting newer edits.
      onChange(latest => ({
        ...latest,
        [name]: url
      }));
    } catch (error) {
      setError(`Upload failed: ${error.message || error}`);
    } finally {
      onUploading(-1);
      e.target.value = '';
    }
  }
  if (field.type === 'image') return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    className: "field",
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
      className: "label",
      children: field.label
    }), value && /*#__PURE__*/jsxRuntimeExports.jsx("img", {
      src: value,
      alt: `${field.label} preview`,
      style: {
        display: 'block',
        maxWidth: 240,
        maxHeight: 100,
        objectFit: 'contain',
        marginBottom: 8
      }
    }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
      type: "file",
      accept: "image/png,image/jpeg,image/webp",
      onChange: upload
    }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
      className: "input",
      style: {
        marginTop: 8
      },
      value: value || '',
      onChange: e => onChange(latest => ({
        ...latest,
        [name]: e.target.value
      })),
      placeholder: "or paste a public HTTPS image URL"
    }), value && /*#__PURE__*/jsxRuntimeExports.jsx("button", {
      type: "button",
      className: "btn btn-outline btn-sm",
      style: {
        marginTop: 8
      },
      onClick: () => onChange(latest => ({
        ...latest,
        [name]: ''
      })),
      children: "Clear image"
    })]
  });
  if (field.type === 'select') return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    className: "field",
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
      className: "label",
      children: field.label
    }), /*#__PURE__*/jsxRuntimeExports.jsx("select", {
      className: "select",
      value: value,
      onChange: e => onChange(latest => ({
        ...latest,
        [name]: field.options.includes(Number(e.target.value)) ? Number(e.target.value) : e.target.value
      })),
      children: field.options.map(option => /*#__PURE__*/jsxRuntimeExports.jsx("option", {
        value: option,
        children: option === 'auto' ? 'Auto — safe default' : option === 'custom' ? 'Custom — use X/Y below' : String(option).replace(/\b\w/g, c => c.toUpperCase())
      }, option))
    })]
  });
  if (field.type === 'color') return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    className: "field",
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
      className: "label",
      children: field.label
    }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
      className: "input",
      value: value || '',
      onChange: e => onChange(latest => ({
        ...latest,
        [name]: e.target.value
      })),
      placeholder: "#1E3A2F or leave blank"
    })]
  });
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    className: "field",
    style: disabled ? {
      opacity: 0.48
    } : undefined,
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
      className: "label",
      children: field.label
    }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
      className: "input",
      type: "number",
      min: field.min,
      max: field.max,
      step: field.step,
      value: value,
      disabled: disabled,
      onChange: e => onChange(latest => ({
        ...latest,
        [name]: e.target.value
      }))
    })]
  });
}
function HeroCtaAppearanceControls({
  value,
  onChange,
  onUploading,
  setError
}) {
  const appearance = {
    ...sanitizeHeroCta(),
    ...value
  };
  return /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
    className: "surface",
    style: {
      marginTop: 16,
      padding: 16
    },
    children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        alignItems: 'start',
        marginBottom: 12
      },
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h3", {
          style: {
            margin: 0
          },
          children: "CTA appearance"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          className: "hint",
          style: {
            margin: '4px 0 0'
          },
          children: "Safe settings saved only for this slide. Auto keeps text-led slides in flow and places artwork-only mobile CTAs lower."
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
        type: "button",
        className: "btn btn-outline btn-sm",
        onClick: () => onChange(sanitizeHeroCta()),
        children: "Reset defaults"
      })]
    }), GROUPS.map(([title, names]) => /*#__PURE__*/jsxRuntimeExports.jsxs("fieldset", {
      style: {
        border: 0,
        borderTop: '1px solid var(--border)',
        margin: '12px 0 0',
        padding: '12px 0 0'
      },
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("legend", {
        style: {
          paddingRight: 8,
          fontWeight: 700
        },
        children: title
      }), title === 'Position' && /*#__PURE__*/jsxRuntimeExports.jsx("p", {
        className: "hint",
        children: "X runs left (0%) to right (100%); Y runs top (0%) to bottom (100%). Auto uses the safe default and ignores X/Y."
      }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
        className: "adm-grid2",
        children: names.map(name => /*#__PURE__*/jsxRuntimeExports.jsx(VisualField, {
          name: name,
          field: HERO_CTA_FIELDS[name],
          value: appearance[name],
          onChange: onChange,
          onUploading: onUploading,
          setError: setError,
          disabled: name === 'x' || name === 'y' ? appearance.desktopPosition !== 'custom' : name === 'mobileX' || name === 'mobileY' ? appearance.mobilePosition !== 'custom' : false
        }, name))
      })]
    }, title))]
  });
}

const empty = {
  kind: 'image',
  image_url: '',
  video_url: '',
  poster_url: '',
  kicker: '',
  title: '',
  subtitle: '',
  lede: '',
  cta_label: 'SHOP NOW',
  cta_link: '/shop',
  is_active: true
};
function HeroSlides() {
  const [list, setList] = reactExports.useState([]);
  const [loading, setLoading] = reactExports.useState(true);
  const [editing, setEditing] = reactExports.useState(null);
  const [form, setForm] = reactExports.useState(empty);
  const [saving, setSaving] = reactExports.useState(false);
  const [uploading, setUploading] = reactExports.useState(false);
  const [ctaUploading, setCtaUploading] = reactExports.useState(0);
  const [ctaAppearance, setCtaAppearance] = reactExports.useState(() => sanitizeHeroCta());
  const [heroCtas, setHeroCtas] = reactExports.useState({});
  const [err, setErr] = reactExports.useState('');
  const [videoUpload, setVideoUpload] = reactExports.useState(null); // { name, status: 'uploading'|'done'|'error', url? }

  async function load() {
    setLoading(true);
    try {
      const [slides, hp] = await Promise.all([adminListHeroSlides(), adminGetSetting('homepage')]);
      setList(slides);
      setHeroCtas(hp?.heroCtas || {});
    } catch (e) {
      setErr(e.message || String(e));
    }
    setLoading(false);
  }
  reactExports.useEffect(() => {
    load();
  }, []);
  async function seedDefaults() {
    setSaving(true);
    try {
      await adminSeedDefaultHeroSlides();
      await load();
    } catch (e) {
      setErr(e.message || String(e));
    }
    setSaving(false);
  }
  function startEdit(slide) {
    setForm(slide ? {
      ...slide
    } : empty);
    setCtaAppearance(sanitizeHeroCta(slide ? heroCtas[slide.id] : null));
    setEditing(slide || 'new');
    setVideoUpload(null);
    setErr('');
  }
  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try {
      const savedSlide = await adminUpsertHeroSlide(form);
      // Re-read immediately before writing: update only this slide's CTA map
      // while preserving every unrelated Homepage setting and other slide.
      const currentHomepage = (await adminGetSetting('homepage')) || {};
      const nextHomepage = mergeHeroCta(currentHomepage, savedSlide.id, ctaAppearance);
      await adminSetSetting('homepage', nextHomepage);
      announceHomepageSaved(nextHomepage);
      setEditing(null);
      await load();
    } catch (ex) {
      setErr(ex.message || String(ex));
    }
    setSaving(false);
  }
  async function remove(slide) {
    if (!window.confirm(`Delete the "${slide.title}" slide?`)) return;
    try {
      await adminDeleteHeroSlide(slide.id);
      await load();
    } catch (ex) {
      setErr(ex.message || String(ex));
    }
  }
  async function move(slide, dir) {
    const idx = list.findIndex(x => x.id === slide.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= list.length) return;
    const next = [...list];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    setList(next);
    try {
      await adminReorderHeroSlides(next.map(x => x.id));
    } catch (ex) {
      setErr(ex.message || String(ex));
    }
  }
  async function onFile(e, field) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file, 'hero');
      setForm(f => ({
        ...f,
        [field]: url
      }));
    } catch (ex) {
      setErr('Upload failed: ' + (ex.message || String(ex)));
    }
    setUploading(false);
  }
  async function onVideoFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr('');
    setVideoUpload({
      name: file.name,
      status: 'uploading'
    });
    setUploading(true);
    try {
      const url = await uploadHeroVideo(file);
      setForm(f => ({
        ...f,
        video_url: url
      }));
      setVideoUpload({
        name: file.name,
        status: 'done',
        url
      });
    } catch (ex) {
      setVideoUpload({
        name: file.name,
        status: 'error'
      });
      setErr('Video upload failed: ' + (ex.message || String(ex)));
    }
    setUploading(false);
  }
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm__head",
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h1", {
          children: "Hero Slides"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          children: loading ? 'Loading…' : `${list.length} slides`
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        style: {
          display: 'flex',
          gap: 8
        },
        children: [list.length === 0 && !loading && /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          className: "btn btn-outline btn-sm",
          onClick: seedDefaults,
          disabled: saving,
          children: "Seed current 2 slides"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          className: "btn btn-sm",
          onClick: () => startEdit(null),
          children: "+ Add slide"
        })]
      })]
    }), err && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-banner err",
      children: err
    }), editing && /*#__PURE__*/jsxRuntimeExports.jsxs("form", {
      className: "surface pad-lg",
      onSubmit: save,
      style: {
        marginBottom: 20,
        maxWidth: 680
      },
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
        style: {
          fontFamily: 'var(--font-display)',
          marginBottom: 14
        },
        children: editing === 'new' ? 'New slide' : `Edit "${editing.title}"`
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "field",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
          className: "label",
          children: "Type"
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("select", {
          className: "select",
          value: form.kind,
          onChange: e => setForm(f => ({
            ...f,
            kind: e.target.value
          })),
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("option", {
            value: "image",
            children: "Image"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("option", {
            value: "video",
            children: "Video"
          })]
        })]
      }), form.kind === 'image' ? /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "field",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
          className: "label",
          children: "Slide image"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
          type: "file",
          accept: "image/jpeg,image/png,image/webp,image/gif,image/avif",
          onChange: e => onFile(e, 'image_url'),
          disabled: uploading
        }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
          className: "input",
          style: {
            marginTop: 8
          },
          value: form.image_url || '',
          onChange: e => setForm(f => ({
            ...f,
            image_url: e.target.value
          })),
          placeholder: "or paste an image URL"
        })]
      }) : /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "Upload video"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            type: "file",
            accept: "video/mp4,video/webm",
            onChange: onVideoFile,
            disabled: uploading
          }), videoUpload && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: `adm-banner ${videoUpload.status === 'error' ? 'err' : videoUpload.status === 'done' ? 'ok' : 'info'}`,
            style: {
              marginTop: 10,
              marginBottom: 0
            },
            children: [videoUpload.status === 'uploading' && /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
              children: ["Uploading ", /*#__PURE__*/jsxRuntimeExports.jsx("strong", {
                children: videoUpload.name
              }), "\u2026"]
            }), videoUpload.status === 'done' && /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
              children: ["Uploaded ", /*#__PURE__*/jsxRuntimeExports.jsx("strong", {
                children: videoUpload.name
              }), " \u2014 public URL saved below."]
            }), videoUpload.status === 'error' && /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
              children: ["Failed to upload ", /*#__PURE__*/jsxRuntimeExports.jsx("strong", {
                children: videoUpload.name
              }), ". See error above."]
            })]
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            style: {
              marginTop: 8
            },
            value: form.video_url || '',
            onChange: e => setForm(f => ({
              ...f,
              video_url: e.target.value
            })),
            placeholder: "or paste a video URL"
          }), form.video_url && /*#__PURE__*/jsxRuntimeExports.jsx("video", {
            src: form.video_url,
            muted: true,
            controls: true,
            style: {
              marginTop: 10,
              width: '100%',
              maxWidth: 320,
              borderRadius: 8,
              background: '#000'
            }
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "Poster image (shown while the video loads, or if it fails)"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            type: "file",
            accept: "image/jpeg,image/png,image/webp,image/gif,image/avif",
            onChange: e => onFile(e, 'poster_url'),
            disabled: uploading
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            style: {
              marginTop: 8
            },
            value: form.poster_url || '',
            onChange: e => setForm(f => ({
              ...f,
              poster_url: e.target.value
            })),
            placeholder: "or paste a poster image URL"
          })]
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-grid2",
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "Eyebrow / kicker"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            value: form.kicker,
            onChange: e => setForm(f => ({
              ...f,
              kicker: e.target.value
            }))
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "Title"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            required: true,
            value: form.title,
            onChange: e => setForm(f => ({
              ...f,
              title: e.target.value
            }))
          })]
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "field",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
          className: "label",
          children: "Subtitle"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
          className: "input",
          value: form.subtitle,
          onChange: e => setForm(f => ({
            ...f,
            subtitle: e.target.value
          }))
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "field",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
          className: "label",
          children: "Supporting line (lede)"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
          className: "input",
          value: form.lede,
          onChange: e => setForm(f => ({
            ...f,
            lede: e.target.value
          }))
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-grid2",
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "CTA button text"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            value: form.cta_label,
            onChange: e => setForm(f => ({
              ...f,
              cta_label: e.target.value
            }))
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "CTA link"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            value: form.cta_link,
            onChange: e => setForm(f => ({
              ...f,
              cta_link: e.target.value
            })),
            placeholder: "/category/wellness"
          })]
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsx(HeroCtaAppearanceControls, {
        value: ctaAppearance,
        onChange: setCtaAppearance,
        onUploading: delta => setCtaUploading(n => Math.max(0, n + delta)),
        setError: setErr
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-checkrow",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
          type: "checkbox",
          id: "slide-active",
          checked: form.is_active !== false,
          onChange: e => setForm(f => ({
            ...f,
            is_active: e.target.checked
          }))
        }), /*#__PURE__*/jsxRuntimeExports.jsx("label", {
          htmlFor: "slide-active",
          children: "Active (shown in carousel)"
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        style: {
          display: 'flex',
          gap: 10,
          marginTop: 14
        },
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
          className: "btn btn-sm",
          type: "submit",
          disabled: saving || uploading || ctaUploading > 0,
          children: saving ? 'Saving…' : ctaUploading ? 'Uploading CTA image…' : 'Save slide'
        }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          type: "button",
          className: "btn btn-outline btn-sm",
          disabled: saving || uploading || ctaUploading > 0,
          onClick: () => setEditing(null),
          children: "Cancel"
        })]
      })]
    }), !loading && list.length === 0 && !editing && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-empty",
      children: "No hero slides yet. Seed the current 2, or add a new one."
    }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-slide-list",
      children: list.map(s => /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-slide-card",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
          className: "adm-slide-thumb",
          children: s.kind === 'video' ? /*#__PURE__*/jsxRuntimeExports.jsx("video", {
            src: s.video_url,
            muted: true
          }) : s.image_url && /*#__PURE__*/jsxRuntimeExports.jsx("img", {
            src: s.image_url,
            alt: ""
          })
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
            children: s.title
          }), " ", !s.is_active && /*#__PURE__*/jsxRuntimeExports.jsx("span", {
            className: "badge badge-out",
            children: "Hidden"
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "hint",
            children: [s.kicker, " \xB7 ", s.cta_label, " \u2192 ", s.cta_link]
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "adm-actions",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
            className: "btn btn-sm btn-light",
            onClick: () => move(s, -1),
            children: "\u2191"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
            className: "btn btn-sm btn-light",
            onClick: () => move(s, 1),
            children: "\u2193"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
            className: "btn btn-sm btn-light",
            onClick: () => startEdit(s),
            children: "Edit"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
            className: "btn btn-sm btn-ghost",
            style: {
              color: 'var(--color-sale)'
            },
            onClick: () => remove(s),
            children: "Delete"
          })]
        })]
      }, s.id))
    })]
  });
}

export { HeroSlides as default };
//# sourceMappingURL=HeroSlides.js.map
