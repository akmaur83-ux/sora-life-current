import { r as reactExports, bS as normalizeFashionStorefront, bT as normalizeLifestyleStorefront, a as adminGetSetting, j as jsxRuntimeExports, b as Link, bU as mergeStorefrontCustomization, e as adminSetSetting, br as announceHomepageSaved, bp as safeVisualUrl } from '../bundle.js';
import { u as uploadHomepageImage } from './homepageImageUpload.js';

function Field({
  id,
  label,
  value,
  onChange,
  multiline = false,
  hint = ''
}) {
  const control = multiline ? /*#__PURE__*/jsxRuntimeExports.jsx("textarea", {
    id: id,
    className: "input",
    rows: "3",
    value: value,
    onChange: event => onChange(event.target.value)
  }) : /*#__PURE__*/jsxRuntimeExports.jsx("input", {
    id: id,
    className: "input",
    value: value,
    onChange: event => onChange(event.target.value)
  });
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    className: "field",
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
      className: "label",
      htmlFor: id,
      children: label
    }), control, hint && /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "hint",
      children: hint
    })]
  });
}
function ImageField({
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
    setError('');
    onUploading(1);
    try {
      onChange(await uploadHomepageImage(file));
    } catch (uploadError) {
      setError(uploadError.message || 'Upload failed.');
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
      disabled: busy,
      onChange: event => {
        onChange(event.target.value);
        setError('');
      }
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
        children: "Use built-in image"
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "hint",
      children: "PNG, JPEG or WebP, up to 6 MB. Upload first, then save the storefront."
    }), value && !preview && /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "error-text",
      role: "alert",
      children: "Enter a public HTTPS image URL or a local image path."
    }), error && /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "error-text",
      role: "alert",
      children: error
    }), preview && /*#__PURE__*/jsxRuntimeExports.jsx("img", {
      className: "hp-admin-image__preview",
      src: preview,
      alt: `${label} preview`
    })]
  });
}
function FashionEditor({
  value,
  onChange,
  onUploading
}) {
  const patch = (group, key, next) => onChange(current => ({
    ...current,
    [group]: {
      ...current[group],
      [key]: next
    }
  }));
  return /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
    children: [/*#__PURE__*/jsxRuntimeExports.jsxs("section", {
      className: "surface",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
        children: "Header"
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-grid2",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx(Field, {
          id: "fashion-tagline",
          label: "Logo tagline",
          value: value.header.tagline,
          onChange: next => patch('header', 'tagline', next)
        }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
          id: "fashion-search",
          label: "Search placeholder",
          value: value.header.searchPlaceholder,
          onChange: next => patch('header', 'searchPlaceholder', next)
        })]
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
      className: "surface",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
        children: "Hero"
      }), /*#__PURE__*/jsxRuntimeExports.jsx(ImageField, {
        id: "fashion-hero-image",
        label: "Hero image",
        value: value.hero.image,
        onChange: next => patch('hero', 'image', next),
        onUploading: onUploading
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-grid2",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx(Field, {
          id: "fashion-hero-eyebrow",
          label: "Eyebrow",
          value: value.hero.eyebrow,
          onChange: next => patch('hero', 'eyebrow', next)
        }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
          id: "fashion-hero-title",
          label: "Title",
          value: value.hero.title,
          onChange: next => patch('hero', 'title', next)
        }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
          id: "fashion-hero-subtitle",
          label: "Subtitle",
          value: value.hero.subtitle,
          onChange: next => patch('hero', 'subtitle', next)
        }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
          id: "fashion-hero-note",
          label: "Offer note",
          value: value.hero.note,
          onChange: next => patch('hero', 'note', next)
        }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
          id: "fashion-hero-cta",
          label: "Button label",
          value: value.hero.ctaLabel,
          onChange: next => patch('hero', 'ctaLabel', next)
        }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
          id: "fashion-hero-link",
          label: "Button route",
          value: value.hero.ctaLink,
          onChange: next => patch('hero', 'ctaLink', next),
          hint: "Use an internal route beginning with /."
        })]
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
      className: "surface",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
        children: "Section headings"
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-grid2",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx(Field, {
          id: "fashion-category-title",
          label: "Category heading",
          value: value.sections.categoriesTitle,
          onChange: next => patch('sections', 'categoriesTitle', next)
        }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
          id: "fashion-category-cta",
          label: "Category link label",
          value: value.sections.categoriesCta,
          onChange: next => patch('sections', 'categoriesCta', next)
        }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
          id: "fashion-brand-title",
          label: "Brand heading",
          value: value.sections.brandsTitle,
          onChange: next => patch('sections', 'brandsTitle', next)
        }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
          id: "fashion-brand-cta",
          label: "Brand link label",
          value: value.sections.brandsCta,
          onChange: next => patch('sections', 'brandsCta', next)
        }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
          id: "fashion-product-title",
          label: "Product heading",
          value: value.sections.productsTitle,
          onChange: next => patch('sections', 'productsTitle', next)
        })]
      })]
    })]
  });
}
function LifestyleSlide({
  index,
  value,
  onChange,
  onUploading
}) {
  const set = (key, next) => onChange(current => ({
    ...current,
    heroSlides: current.heroSlides.map((slide, slideIndex) => slideIndex === index ? {
      ...slide,
      [key]: next
    } : slide)
  }));
  return /*#__PURE__*/jsxRuntimeExports.jsxs("details", {
    className: "surface adm-storefronts__slide",
    open: index === 0,
    children: [/*#__PURE__*/jsxRuntimeExports.jsxs("summary", {
      children: ["Hero slide ", index + 1, ": ", value.headlineOne, " ", value.headlineTwo]
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm-storefronts__imagegrid",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx(ImageField, {
        id: `lifestyle-slide-${index}-tall`,
        label: "Mobile portrait image",
        value: value.tall,
        onChange: next => set('tall', next),
        onUploading: onUploading
      }), /*#__PURE__*/jsxRuntimeExports.jsx(ImageField, {
        id: `lifestyle-slide-${index}-wide`,
        label: "Desktop wide image",
        value: value.wide,
        onChange: next => set('wide', next),
        onUploading: onUploading
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
      id: `lifestyle-slide-${index}-alt`,
      label: "Image description",
      value: value.alt,
      onChange: next => set('alt', next)
    }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-grid2",
      children: [['eyebrowOne', 'Eyebrow line 1'], ['eyebrowTwo', 'Eyebrow line 2'], ['headlineOne', 'Headline line 1'], ['headlineTwo', 'Headline line 2'], ['subtitle', 'Subtitle'], ['note', 'Decorative note'], ['ctaLabel', 'Button label'], ['ctaLink', 'Button route']].map(([key, label]) => /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
        id: `lifestyle-slide-${index}-${key}`,
        label: label,
        value: value[key],
        onChange: next => set(key, next),
        hint: key === 'ctaLink' ? 'Use an internal route beginning with /.' : ''
      }, key))
    })]
  });
}
function LifestyleEditor({
  value,
  onChange,
  onUploading
}) {
  const patch = (group, key, next) => onChange(current => ({
    ...current,
    [group]: {
      ...current[group],
      [key]: next
    }
  }));
  return /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
    children: [/*#__PURE__*/jsxRuntimeExports.jsxs("section", {
      className: "surface",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
        children: "Header"
      }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
        id: "lifestyle-tagline",
        label: "Logo tagline",
        value: value.header.tagline,
        onChange: next => patch('header', 'tagline', next)
      })]
    }), value.heroSlides.map((slide, index) => /*#__PURE__*/jsxRuntimeExports.jsx(LifestyleSlide, {
      index: index,
      value: slide,
      onChange: onChange,
      onUploading: onUploading
    }, slide.id)), /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
      className: "surface",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
        children: "Fashion doorway banner"
      }), /*#__PURE__*/jsxRuntimeExports.jsx(ImageField, {
        id: "lifestyle-banner-image",
        label: "Banner image",
        value: value.fashionBanner.image,
        onChange: next => patch('fashionBanner', 'image', next),
        onUploading: onUploading
      }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
        id: "lifestyle-banner-alt",
        label: "Image description",
        value: value.fashionBanner.alt,
        onChange: next => patch('fashionBanner', 'alt', next)
      }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
        className: "adm-grid2",
        children: [['eyebrowOne', 'Eyebrow line 1'], ['eyebrowTwo', 'Eyebrow line 2'], ['headlineOne', 'Headline line 1'], ['headlineTwo', 'Headline line 2'], ['subtitle', 'Subtitle'], ['note', 'Decorative note'], ['ctaLabel', 'Button label'], ['ctaLink', 'Button route']].map(([key, label]) => /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
          id: `lifestyle-banner-${key}`,
          label: label,
          value: value.fashionBanner[key],
          onChange: next => patch('fashionBanner', key, next),
          hint: key === 'ctaLink' ? 'Use an internal route beginning with /.' : ''
        }, key))
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
      className: "surface",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
        children: "Section headings"
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-grid2",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx(Field, {
          id: "lifestyle-category-title",
          label: "Fashion category heading",
          value: value.sections.fashionCategoriesTitle,
          onChange: next => patch('sections', 'fashionCategoriesTitle', next)
        }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
          id: "lifestyle-category-cta",
          label: "Fashion category link label",
          value: value.sections.fashionCategoriesCta,
          onChange: next => patch('sections', 'fashionCategoriesCta', next)
        }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
          id: "lifestyle-trending-title",
          label: "Trending heading",
          value: value.sections.trendingTitle,
          onChange: next => patch('sections', 'trendingTitle', next)
        }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
          id: "lifestyle-trending-cta",
          label: "Trending link label",
          value: value.sections.trendingCta,
          onChange: next => patch('sections', 'trendingCta', next)
        })]
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
      className: "surface",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
        children: "Home & Living promo"
      }), /*#__PURE__*/jsxRuntimeExports.jsx(ImageField, {
        id: "lifestyle-promo-image",
        label: "Promo image",
        value: value.promo.image,
        onChange: next => patch('promo', 'image', next),
        onUploading: onUploading
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-grid2",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx(Field, {
          id: "lifestyle-promo-title",
          label: "Headline",
          value: value.promo.headline,
          onChange: next => patch('promo', 'headline', next)
        }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
          id: "lifestyle-promo-cta",
          label: "Button label",
          value: value.promo.ctaLabel,
          onChange: next => patch('promo', 'ctaLabel', next)
        }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
          id: "lifestyle-promo-link",
          label: "Button route",
          value: value.promo.ctaLink,
          onChange: next => patch('promo', 'ctaLink', next),
          hint: "Use an internal route beginning with /."
        })]
      })]
    })]
  });
}
function Storefronts() {
  const [tab, setTab] = reactExports.useState('fashion');
  const [fashion, setFashion] = reactExports.useState(() => normalizeFashionStorefront());
  const [lifestyle, setLifestyle] = reactExports.useState(() => normalizeLifestyleStorefront());
  const [loading, setLoading] = reactExports.useState(true);
  const [saving, setSaving] = reactExports.useState(false);
  const [uploads, setUploads] = reactExports.useState(0);
  const [message, setMessage] = reactExports.useState('');
  const [error, setError] = reactExports.useState('');
  reactExports.useEffect(() => {
    (async () => {
      try {
        const homepage = await adminGetSetting('homepage');
        setFashion(normalizeFashionStorefront(homepage?.fashion_storefront));
        setLifestyle(normalizeLifestyleStorefront(homepage?.lifestyle_storefront));
      } catch (loadError) {
        setError(loadError.message || String(loadError));
      }
      setLoading(false);
    })();
  }, []);
  async function save(event) {
    event.preventDefault();
    if (uploads) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const current = await adminGetSetting('homepage');
      const next = mergeStorefrontCustomization(current, fashion, lifestyle);
      await adminSetSetting('homepage', next);
      setFashion(next.fashion_storefront);
      setLifestyle(next.lifestyle_storefront);
      announceHomepageSaved(next);
      setMessage('Saved. Open storefront tabs update automatically.');
    } catch (saveError) {
      setError(saveError.message || String(saveError));
    }
    setSaving(false);
  }
  if (loading) return /*#__PURE__*/jsxRuntimeExports.jsx("p", {
    className: "muted",
    children: "Loading\u2026"
  });
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    className: "adm-form adm-storefronts",
    children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm__head",
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h1", {
          children: "Fashion & Lifestyle"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          children: "Customize storefront copy and campaign images without changing products, prices or commerce behavior."
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-storefronts__preview",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("a", {
          className: "btn btn-outline btn-sm",
          href: "/fashion",
          target: "_blank",
          rel: "noreferrer",
          children: "Preview Fashion"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("a", {
          className: "btn btn-outline btn-sm",
          href: "/lifestyle",
          target: "_blank",
          rel: "noreferrer",
          children: "Preview Lifestyle"
        })]
      })]
    }), error && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-banner err",
      children: error
    }), message && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-banner ok",
      children: message
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "surface sc-panel",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
        children: "Products & categories"
      }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
        children: "Add products to a specific category, manage images, prices, stock and variants. Lifestyle shows products from both stores."
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "sc-actions",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx(Link, {
          className: "btn btn-sm",
          to: "/admin/store-catalogue/fashion",
          children: "Manage Fashion products"
        }), /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
          className: "btn btn-outline btn-sm",
          to: "/admin/store-catalogue/homeliving",
          children: "Manage Home & Living products"
        })]
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm-chipbar",
      role: "tablist",
      "aria-label": "Storefront editor",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
        className: `adm-chip${tab === 'fashion' ? ' active' : ''}`,
        type: "button",
        role: "tab",
        "aria-selected": tab === 'fashion',
        onClick: () => setTab('fashion'),
        children: "Fashion Store"
      }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
        className: `adm-chip${tab === 'lifestyle' ? ' active' : ''}`,
        type: "button",
        role: "tab",
        "aria-selected": tab === 'lifestyle',
        onClick: () => setTab('lifestyle'),
        children: "Lifestyle Store"
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("form", {
      onSubmit: save,
      children: [tab === 'fashion' ? /*#__PURE__*/jsxRuntimeExports.jsx(FashionEditor, {
        value: fashion,
        onChange: setFashion,
        onUploading: delta => setUploads(count => count + delta)
      }) : /*#__PURE__*/jsxRuntimeExports.jsx(LifestyleEditor, {
        value: lifestyle,
        onChange: setLifestyle,
        onUploading: delta => setUploads(count => count + delta)
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-storefronts__actions",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
          className: "btn",
          type: "submit",
          disabled: saving || uploads > 0,
          children: saving ? 'Saving…' : uploads ? 'Uploading images…' : 'Save both storefronts'
        }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
          className: "hint",
          children: "Saving keeps catalogue, pricing, cart and checkout data untouched."
        })]
      })]
    })]
  });
}

export { Storefronts as default };
//# sourceMappingURL=Storefronts.js.map
