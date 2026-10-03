import { bY as buildTree, bK as safeVisualUrl, bZ as validatePlacement, bH as supabase, bw as uploadImage, u as useParams, Z as useNavigate, j as jsxRuntimeExports, b as Link, b_ as useSearchParams, r as reactExports, s as money } from '../bundle.js';

const CATALOGUE_STORES = {
  fashion: 'Fashion',
  homeliving: 'Home & Living'
};
function requireCatalogueStore(store) {
  if (!Object.hasOwn(CATALOGUE_STORES, store)) throw new Error('Choose Fashion or Home & Living.');
  return store;
}
const text = value => String(value ?? '').trim();
const catalogueSlug = value => text(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function slug(value, name) {
  const result = text(value) || catalogueSlug(name);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(result)) throw new Error('Use lowercase letters, numbers and hyphens in the slug.');
  return result;
}
function number(value, label, {
  integer = false,
  optional = false,
  min = 0,
  max = 99999999.99
} = {}) {
  if (optional && (value == null || text(value) === '')) return null;
  const n = Number(value);
  if (value == null || text(value) === '' || !Number.isFinite(n) || n < min || n > max || integer && !Number.isInteger(n)) throw new Error(`${label} must be a valid ${integer ? 'whole number' : 'amount'} between ${min} and ${max}.`);
  return n;
}
function categoryOptions(categories) {
  const tree = buildTree(categories);
  return tree.list.map(row => ({
    ...row,
    label: tree.ancestors(row.id).map(item => item.name).join(' / ')
  })).sort((a, b) => a.label.localeCompare(b.label));
}
function catalogueProductPayload(input, categories) {
  const name = text(input.name);
  if (!name) throw new Error('Enter a product name.');
  const category = categories.find(row => row.id === input.category_id);
  if (!category) throw new Error('Choose a category in this store.');
  if (input.is_active && buildTree(categories).ancestors(category.id).some(row => !row.is_active)) throw new Error('Activate this category and its parent categories before publishing.');
  const mrp = number(input.mrp, 'MRP', {
    min: 0.01
  });
  const sale_price = number(input.sale_price, 'Selling price', {
    optional: true,
    min: 0.01,
    max: mrp
  });
  const sku = text(input.sku) || null;
  if (sku && !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,63}$/.test(sku)) throw new Error('SKU must be 1–64 letters, numbers, dots, slashes, hyphens or underscores.');
  return {
    name,
    slug: slug(input.slug, name),
    category_id: category.id,
    brand: text(input.brand),
    description: text(input.description),
    mrp,
    sale_price,
    sku,
    net_content: text(input.net_content) || null,
    stock: number(input.stock ?? 0, 'Stock', {
      integer: true,
      max: 2147483647
    }),
    sort_order: number(input.sort_order ?? 0, 'Display order', {
      integer: true,
      min: -2147483648,
      max: 2147483647
    }),
    is_active: input.is_active === true,
    is_new: input.is_new === true,
    is_bestseller: input.is_bestseller === true
  };
}
function catalogueCategoryPayload(input, categories, id = null) {
  const name = text(input.name);
  if (!name) throw new Error('Enter a category name.');
  const parent_id = input.parent_id || null;
  if (parent_id && !categories.some(row => row.id === parent_id)) throw new Error('Choose a parent category in this store.');
  const placement = validatePlacement(categories, {
    id,
    parentId: parent_id
  });
  if (!placement.ok) throw new Error('Categories allow up to three levels and cannot contain a circular parent.');
  const image_url = text(input.image_url) ? safeVisualUrl(input.image_url) : null;
  if (text(input.image_url) && !image_url) throw new Error('Enter a public HTTPS image URL or a local image path.');
  return {
    name,
    slug: slug(input.slug, name),
    parent_id,
    tagline: text(input.tagline),
    image_url,
    sort_order: number(input.sort_order ?? 0, 'Display order', {
      integer: true,
      min: -2147483648,
      max: 2147483647
    }),
    is_active: input.is_active !== false
  };
}
function catalogueVariantPayload(input, store) {
  requireCatalogueStore(store);
  const size = text(input.size),
    colour = text(input.colour);
  if (!size || store === 'fashion' && !colour) throw new Error('Enter a size and, for Fashion, a colour. Use “One size” / “Default” for a single option.');
  const colour_hex = text(input.colour_hex) || null;
  if (colour_hex && !/^#[0-9a-f]{6}$/i.test(colour_hex)) throw new Error('Colour hex must look like #123ABC.');
  return {
    size,
    colour,
    colour_hex,
    sku: text(input.sku) || null,
    stock: number(input.stock, 'Variant stock', {
      integer: true,
      max: 2147483647
    }),
    price_override: number(input.price_override, 'Variant price', {
      optional: true,
      min: 0.01
    }),
    is_active: input.is_active !== false,
    sort_order: number(input.sort_order ?? 0, 'Display order', {
      integer: true,
      min: -2147483648,
      max: 2147483647
    })
  };
}
function assertCataloguePublishable(store, product) {
  requireCatalogueStore(store);
  if (!(product.images || []).some(url => safeVisualUrl(url))) throw new Error('Add a product image before publishing.');
  if (store === 'fashion' && !(product.variants || []).some(row => row.is_active !== false)) throw new Error('Add at least one active size/colour variant with stock before publishing. Zero stock is allowed for sold-out products.');
}
function catalogueProductHref(store, slug) {
  requireCatalogueStore(store);
  return `/${store}/p/${encodeURIComponent(slug)}`;
}

// Uses existing admin RLS. No service credentials, schema changes or wellness writes.
const PRODUCT_SELECT = '*, variants:catalogue_variants (*), media:catalogue_product_media (*)';
async function result(query) {
  const {
    data,
    error
  } = await query;
  if (error) throw error;
  return data;
}
async function allRows(table, store, select = '*') {
  requireCatalogueStore(store);
  const rows = [];
  for (let start = 0;; start += 500) {
    const page = await result(supabase.from(table).select(select).eq('store', store).order('sort_order', {
      ascending: true
    }).order('id', {
      ascending: true
    }).range(start, start + 499));
    rows.push(...(page || []));
    if (!page || page.length < 500) return rows;
  }
}
const listStoreCategories = store => allRows('catalogue_categories', store);
const listStoreProducts = store => allRows('catalogue_products', store, PRODUCT_SELECT);
async function getStoreProduct(store, id) {
  requireCatalogueStore(store);
  const row = await result(supabase.from('catalogue_products').select(PRODUCT_SELECT).eq('store', store).eq('id', id).single());
  if (!row) throw new Error('Product not found in this store.');
  return row;
}
async function saveStoreProduct(store, id, input) {
  requireCatalogueStore(store);
  const categories = await listStoreCategories(store);
  const row = catalogueProductPayload(input, categories);
  // First create a draft; images/variants can then be saved against its real id.
  if (!id) return result(supabase.from('catalogue_products').insert({
    ...row,
    store,
    is_active: false
  }).select().single());
  if (row.is_active) assertCataloguePublishable(store, await getStoreProduct(store, id));
  return result(supabase.from('catalogue_products').update(row).eq('store', store).eq('id', id).select().single());
}
async function saveStoreCategory(store, id, input) {
  requireCatalogueStore(store);
  const categories = await listStoreCategories(store);
  if (id && !categories.some(row => row.id === id)) throw new Error('Category not found in this store.');
  const row = catalogueCategoryPayload(input, categories, id);
  const query = id ? supabase.from('catalogue_categories').update(row).eq('store', store).eq('id', id) : supabase.from('catalogue_categories').insert({
    ...row,
    store
  });
  return result(query.select().single());
}
async function saveStoreVariant(store, productId, id, input) {
  requireCatalogueStore(store);
  const row = catalogueVariantPayload(input, store);
  const product = await getStoreProduct(store, productId);
  if (id && !(product.variants || []).some(v => v.id === id)) throw new Error('Variant not found on this product.');
  const query = id ? supabase.from('catalogue_variants').update(row).eq('store', store).eq('product_id', productId).eq('id', id) : supabase.from('catalogue_variants').insert({
    ...row,
    store,
    product_id: productId
  });
  return result(query.select().single());
}
async function uploadStoreImage(store, file) {
  requireCatalogueStore(store);
  return uploadImage(file, `catalogue/${store}`);
}
async function saveStoreMedia(store, productId, id, input) {
  requireCatalogueStore(store);
  const public_url = safeVisualUrl(input.public_url);
  if (!public_url) throw new Error('Enter a public HTTPS image URL or a local image path.');
  const product = await getStoreProduct(store, productId);
  if (id && !(product.media || []).some(m => m.id === id)) throw new Error('Image not found on this product.');
  if (id && product.media.find(m => m.id === id)?.is_primary && input.is_primary !== true) throw new Error('Choose another gallery image as primary before clearing this one.');
  const sort_order = Number(input.sort_order ?? 0);
  if (!Number.isInteger(sort_order) || sort_order < -2147483648 || sort_order > 2147483647) throw new Error('Image order must be a whole number.');
  const row = {
    public_url,
    alt_text: String(input.alt_text || '').trim(),
    sort_order,
    is_primary: input.is_primary === true || !(product.media || []).length
  };
  const query = id ? supabase.from('catalogue_product_media').update(row).eq('product_id', productId).eq('id', id) : supabase.from('catalogue_product_media').insert({
    ...row,
    product_id: productId
  });
  // Existing media trigger updates images[] for both storefronts. Never write the cache directly.
  return result(query.select().single());
}
async function removeStoreMedia(store, productId, id) {
  const product = await getStoreProduct(store, productId);
  if (!(product.media || []).some(m => m.id === id)) throw new Error('Image not found on this product.');
  if (product.is_active && product.media.length < 2) throw new Error('Keep one image on a published product, or save it as a draft first.');
  // Detach only; never delete an original Storage object.
  await result(supabase.from('catalogue_product_media').delete().eq('product_id', productId).eq('id', id).select('id').single());
}

const EMPTY_PRODUCT = {
  name: '',
  slug: '',
  brand: '',
  description: '',
  category_id: '',
  mrp: '',
  sale_price: '',
  sku: '',
  net_content: '',
  stock: 0,
  sort_order: 0,
  is_active: false,
  is_new: false,
  is_bestseller: false
};
const EMPTY_CATEGORY = {
  name: '',
  slug: '',
  parent_id: '',
  tagline: '',
  image_url: '',
  sort_order: 0,
  is_active: true
};
const EMPTY_VARIANT = {
  size: '',
  colour: '',
  colour_hex: '',
  sku: '',
  stock: 0,
  price_override: '',
  is_active: true,
  sort_order: 0
};
function Field({
  label,
  field,
  value,
  set,
  type = 'text',
  required = false,
  hint,
  min,
  max,
  step,
  multiline = false
}) {
  return /*#__PURE__*/jsxRuntimeExports.jsxs("label", {
    className: "field sc-field",
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
      className: "label",
      children: label
    }), multiline ? /*#__PURE__*/jsxRuntimeExports.jsx("textarea", {
      className: "textarea",
      rows: "4",
      value: value[field] ?? '',
      onChange: e => set({
        ...value,
        [field]: e.target.value
      })
    }) : /*#__PURE__*/jsxRuntimeExports.jsx("input", {
      className: "input",
      type: type,
      required: required,
      min: min,
      max: max,
      step: step,
      value: value[field] ?? '',
      onChange: e => set({
        ...value,
        [field]: e.target.value
      })
    }), hint && /*#__PURE__*/jsxRuntimeExports.jsx("span", {
      className: "hint",
      children: hint
    })]
  });
}
function Check({
  label,
  field,
  value,
  set
}) {
  return /*#__PURE__*/jsxRuntimeExports.jsxs("label", {
    className: "adm-checkrow",
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
      type: "checkbox",
      checked: !!value[field],
      onChange: e => set({
        ...value,
        [field]: e.target.checked
      })
    }), label]
  });
}
function CategorySelect({
  categories,
  value,
  onChange,
  label = 'Category / subcategory',
  optional = false
}) {
  return /*#__PURE__*/jsxRuntimeExports.jsxs("label", {
    className: "field sc-field",
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
      className: "label",
      children: label
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("select", {
      className: "select",
      required: !optional,
      value: value || '',
      onChange: e => onChange(e.target.value),
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("option", {
        value: "",
        children: optional ? 'Top-level category' : 'Choose a category'
      }), categoryOptions(categories).map(row => /*#__PURE__*/jsxRuntimeExports.jsxs("option", {
        value: row.id,
        children: [row.label, row.is_active ? '' : ' (hidden)']
      }, row.id))]
    })]
  });
}
function Messages({
  error,
  message
}) {
  return /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
    children: [error && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-banner err",
      role: "alert",
      children: error
    }), message && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-banner ok",
      role: "status",
      children: message
    })]
  });
}
function Upload({
  store,
  onUpload,
  onBusy,
  onError,
  disabled = false
}) {
  const [busy, setBusy] = reactExports.useState(false);
  async function upload(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    onBusy(true);
    onError('');
    try {
      onUpload(await uploadStoreImage(store, file));
    } catch (error) {
      onError(error.message || 'Image upload failed.');
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  return /*#__PURE__*/jsxRuntimeExports.jsxs("label", {
    className: "sc-upload",
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
      children: busy ? 'Uploading image…' : 'Upload image'
    }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
      type: "file",
      accept: "image/jpeg,image/png,image/webp",
      disabled: busy || disabled,
      onChange: upload
    })]
  });
}
function CategoryEditor({
  store,
  categories,
  initial,
  onSaved,
  onCancel
}) {
  const [form, setForm] = reactExports.useState(initial || EMPTY_CATEGORY);
  const [busy, setBusy] = reactExports.useState(false),
    [uploading, setUploading] = reactExports.useState(false),
    [error, setError] = reactExports.useState('');
  async function save(e) {
    e.preventDefault();
    if (busy || uploading) return;
    setBusy(true);
    setError('');
    try {
      await saveStoreCategory(store, initial?.id, form);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return /*#__PURE__*/jsxRuntimeExports.jsxs("form", {
    className: "surface sc-panel",
    onSubmit: save,
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
      children: initial ? 'Edit category' : 'Add category'
    }), /*#__PURE__*/jsxRuntimeExports.jsx(Messages, {
      error: error
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("fieldset", {
      disabled: busy || uploading,
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-grid2",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx(Field, {
          label: "Category name",
          field: "name",
          value: form,
          set: setForm,
          required: true
        }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
          label: "Slug",
          field: "slug",
          value: form,
          set: setForm,
          hint: form.slug ? 'Changing a slug changes its storefront link.' : `Automatic: ${catalogueSlug(form.name) || 'category-name'}`
        }), /*#__PURE__*/jsxRuntimeExports.jsx(CategorySelect, {
          categories: categories.filter(row => row.id !== initial?.id),
          value: form.parent_id,
          optional: true,
          label: "Parent category (up to 3 levels)",
          onChange: parent_id => setForm({
            ...form,
            parent_id
          })
        }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
          label: "Display order",
          field: "sort_order",
          type: "number",
          step: "1",
          value: form,
          set: setForm
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
        label: "Tagline",
        field: "tagline",
        value: form,
        set: setForm
      }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
        label: "Category image URL",
        field: "image_url",
        value: form,
        set: setForm
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsx(Upload, {
      store: store,
      disabled: busy,
      onUpload: image_url => setForm(old => ({
        ...old,
        image_url
      })),
      onBusy: setUploading,
      onError: setError
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("fieldset", {
      disabled: busy || uploading,
      children: [/*#__PURE__*/jsxRuntimeExports.jsx(Check, {
        label: "Visible on storefront",
        field: "is_active",
        value: form,
        set: setForm
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "sc-actions",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
          className: "btn btn-sm",
          type: "submit",
          children: busy ? 'Saving…' : 'Save category'
        }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          className: "btn btn-outline btn-sm",
          type: "button",
          onClick: onCancel,
          children: "Cancel"
        })]
      })]
    })]
  });
}
function CatalogueList({
  store
}) {
  const [params, setParams] = useSearchParams();
  const [categories, setCategories] = reactExports.useState([]),
    [products, setProducts] = reactExports.useState([]);
  const [loading, setLoading] = reactExports.useState(true),
    [error, setError] = reactExports.useState(''),
    [editing, setEditing] = reactExports.useState(null);
  const [revision, setRevision] = reactExports.useState(0);
  const tab = params.get('tab') === 'categories' ? 'categories' : 'products';
  const category = params.get('category') || '',
    search = params.get('q') || '';
  reactExports.useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    Promise.all([listStoreCategories(store), listStoreProducts(store)]).then(([cats, rows]) => {
      if (current) {
        setCategories(cats);
        setProducts(rows);
      }
    }).catch(err => {
      if (current) setError(err.message);
    }).finally(() => {
      if (current) setLoading(false);
    });
    return () => {
      current = false;
    };
  }, [store, revision]);
  const update = patch => setParams(old => {
    const next = new URLSearchParams(old);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);else next.delete(key);
    }
    return next;
  }, {
    replace: true
  });
  const shown = products.filter(row => (!category || row.category_id === category) && `${row.name} ${row.sku || ''} ${row.brand}`.toLowerCase().includes(search.toLowerCase()));
  const categoriesById = new Map(categoryOptions(categories).map(row => [row.id, row.label]));
  return /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
    children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm-chipbar",
      "aria-label": "Catalogue section",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
        className: `adm-chip${tab === 'products' ? ' active' : ''}`,
        onClick: () => update({
          tab: ''
        }),
        children: "Products"
      }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
        className: `adm-chip${tab === 'categories' ? ' active' : ''}`,
        onClick: () => update({
          tab: 'categories'
        }),
        children: "Categories & subcategories"
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsx(Messages, {
      error: error
    }), loading ? /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      role: "status",
      children: "Loading catalogue\u2026"
    }) : error ? /*#__PURE__*/jsxRuntimeExports.jsx("button", {
      className: "btn btn-outline",
      onClick: () => setRevision(n => n + 1),
      children: "Retry loading"
    }) : tab === 'products' ? /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "sc-toolbar",
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("label", {
          className: "sc-field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
            className: "label",
            children: "Search products"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            value: search,
            onChange: e => update({
              q: e.target.value
            }),
            placeholder: "Name, brand or SKU"
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("label", {
          className: "sc-field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
            className: "label",
            children: "Category / subcategory"
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("select", {
            className: "select",
            value: category,
            onChange: e => update({
              category: e.target.value
            }),
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("option", {
              value: "",
              children: "All categories"
            }), categoryOptions(categories).map(row => /*#__PURE__*/jsxRuntimeExports.jsx("option", {
              value: row.id,
              children: row.label
            }, row.id))]
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
          className: "btn btn-sm",
          to: `/admin/store-catalogue/${store}/new${category ? `?category=${encodeURIComponent(category)}` : ''}`,
          children: "+ Add product"
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
        className: "hint",
        children: [shown.length, " of ", products.length, " products \xB7 includes drafts"]
      }), !shown.length ? /*#__PURE__*/jsxRuntimeExports.jsx("div", {
        className: "adm-empty",
        children: "No products in this selection. Add a product, or choose another category."
      }) : /*#__PURE__*/jsxRuntimeExports.jsx("div", {
        className: "adm-table-wrap",
        children: /*#__PURE__*/jsxRuntimeExports.jsxs("table", {
          className: "adm-table",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("thead", {
            children: /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("th", {
                children: "Product"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                children: "Category"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                children: "Price"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                children: "Stock"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                children: "Status"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                children: "Actions"
              })]
            })
          }), /*#__PURE__*/jsxRuntimeExports.jsx("tbody", {
            children: shown.map(row => {
              const variants = (row.variants || []).filter(v => v.is_active !== false);
              const stock = store === 'fashion' || variants.length ? variants.reduce((n, v) => n + Number(v.stock || 0), 0) : row.stock;
              return /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
                children: [/*#__PURE__*/jsxRuntimeExports.jsx("td", {
                  children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                    className: "adm-row-name",
                    children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
                      className: "adm-thumb",
                      children: row.images?.[0] && /*#__PURE__*/jsxRuntimeExports.jsx("img", {
                        src: row.images[0],
                        alt: "",
                        loading: "lazy"
                      })
                    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                      children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
                        children: row.name
                      }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                        children: row.sku || row.slug
                      })]
                    })]
                  })
                }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                  children: categoriesById.get(row.category_id) || 'Unassigned'
                }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                  children: money(row.sale_price ?? row.mrp)
                }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                  children: stock || 0
                }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                  children: row.is_active ? 'Published' : 'Draft'
                }), /*#__PURE__*/jsxRuntimeExports.jsxs("td", {
                  children: [/*#__PURE__*/jsxRuntimeExports.jsx(Link, {
                    className: "inline-link",
                    to: `/admin/store-catalogue/${store}/${row.id}`,
                    children: "Edit"
                  }), row.is_active && /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
                    children: [" \xB7 ", /*#__PURE__*/jsxRuntimeExports.jsx("a", {
                      className: "inline-link",
                      href: catalogueProductHref(store, row.slug),
                      target: "_blank",
                      rel: "noreferrer",
                      children: "View"
                    })]
                  })]
                })]
              }, row.id);
            })
          })]
        })
      })]
    }) : /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
        className: "sc-actions",
        children: /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          className: "btn btn-sm",
          disabled: !!editing,
          onClick: () => setEditing('new'),
          children: "+ Add category"
        })
      }), editing && /*#__PURE__*/jsxRuntimeExports.jsx(CategoryEditor, {
        store: store,
        categories: categories,
        initial: editing === 'new' ? null : editing,
        onCancel: () => setEditing(null),
        onSaved: () => {
          setEditing(null);
          setRevision(n => n + 1);
        }
      }, editing === 'new' ? 'new' : editing.id), !categories.length && /*#__PURE__*/jsxRuntimeExports.jsx("p", {
        className: "adm-empty",
        children: "Add your first category before adding products."
      }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
        className: "adm-table-wrap",
        children: /*#__PURE__*/jsxRuntimeExports.jsxs("table", {
          className: "adm-table",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("thead", {
            children: /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("th", {
                children: "Category"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                children: "Products"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                children: "Status"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {})]
            })
          }), /*#__PURE__*/jsxRuntimeExports.jsx("tbody", {
            children: categoryOptions(categories).map(row => /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("td", {
                children: row.label
              }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                children: products.filter(p => p.category_id === row.id).length
              }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                children: row.is_active ? 'Visible' : 'Hidden'
              }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                children: /*#__PURE__*/jsxRuntimeExports.jsx("button", {
                  className: "btn btn-outline btn-sm",
                  disabled: !!editing,
                  onClick: () => setEditing(categories.find(cat => cat.id === row.id)),
                  children: "Edit"
                })
              })]
            }, row.id))
          })]
        })
      })]
    })]
  });
}
function VariantsEditor({
  store,
  product,
  onChanged
}) {
  const [form, setForm] = reactExports.useState(EMPTY_VARIANT),
    [editing, setEditing] = reactExports.useState(null);
  const [busy, setBusy] = reactExports.useState(false),
    [error, setError] = reactExports.useState(''),
    [message, setMessage] = reactExports.useState('');
  async function save(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await saveStoreVariant(store, product.id, editing, form);
      setForm(EMPTY_VARIANT);
      setEditing(null);
      await onChanged();
      setMessage('Variant saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
    className: "surface sc-panel",
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
      children: "Sizes, colours & stock"
    }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "hint",
      children: store === 'fashion' ? 'Fashion stock comes from these variants. For a single option use “One size” and its colour, or “Default”.' : 'Optional: add sizes or colours for this product. When active variants exist, their stock is used instead of product stock.'
    }), /*#__PURE__*/jsxRuntimeExports.jsx(Messages, {
      error: error,
      message: message
    }), !!product.variants?.length && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-table-wrap",
      children: /*#__PURE__*/jsxRuntimeExports.jsxs("table", {
        className: "adm-table",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("thead", {
          children: /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Size / option"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Colour"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Stock"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Price"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Status"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {})]
          })
        }), /*#__PURE__*/jsxRuntimeExports.jsx("tbody", {
          children: product.variants.map(row => /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("td", {
              children: row.size
            }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
              children: row.colour || '—'
            }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
              children: row.stock
            }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
              children: row.price_override == null ? 'Product price' : money(row.price_override)
            }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
              children: row.is_active ? 'Active' : 'Hidden'
            }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
              children: /*#__PURE__*/jsxRuntimeExports.jsx("button", {
                type: "button",
                className: "btn btn-outline btn-sm",
                disabled: busy,
                onClick: () => {
                  setEditing(row.id);
                  setForm(row);
                  setMessage('');
                },
                children: "Edit"
              })
            })]
          }, row.id))
        })]
      })
    }), /*#__PURE__*/jsxRuntimeExports.jsx("form", {
      onSubmit: save,
      children: /*#__PURE__*/jsxRuntimeExports.jsxs("fieldset", {
        disabled: busy,
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h3", {
          children: editing ? 'Edit variant' : 'Add variant'
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "adm-grid2",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            label: "Size / option",
            field: "size",
            value: form,
            set: setForm,
            required: true
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            label: `Colour${store === 'homeliving' ? ' (optional)' : ''}`,
            field: "colour",
            value: form,
            set: setForm,
            required: store === 'fashion'
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            label: "Colour hex (optional)",
            field: "colour_hex",
            value: form,
            set: setForm,
            hint: "Example: #A9B48C"
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            label: "Variant SKU (optional)",
            field: "sku",
            value: form,
            set: setForm
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            label: "Stock quantity",
            field: "stock",
            type: "number",
            min: "0",
            step: "1",
            value: form,
            set: setForm,
            required: true
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            label: "Price override \u20B9 (optional)",
            field: "price_override",
            type: "number",
            min: "0.01",
            step: "0.01",
            value: form,
            set: setForm,
            hint: "Leave blank to use the product selling price."
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            label: "Display order",
            field: "sort_order",
            type: "number",
            step: "1",
            value: form,
            set: setForm
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsx(Check, {
          label: "Active variant",
          field: "is_active",
          value: form,
          set: setForm
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "sc-actions",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
            className: "btn btn-sm",
            type: "submit",
            children: busy ? 'Saving…' : 'Save variant'
          }), editing && /*#__PURE__*/jsxRuntimeExports.jsx("button", {
            className: "btn btn-outline btn-sm",
            type: "button",
            onClick: () => {
              setEditing(null);
              setForm(EMPTY_VARIANT);
            },
            children: "Cancel edit"
          })]
        })]
      })
    })]
  });
}
function GalleryEditor({
  store,
  product,
  onChanged
}) {
  const empty = () => ({
    public_url: '',
    alt_text: product.name,
    sort_order: Math.max(-1, ...(product.media || []).map(row => row.sort_order)) + 1,
    is_primary: !product.media?.length
  });
  const [form, setForm] = reactExports.useState(empty),
    [editing, setEditing] = reactExports.useState(null);
  const [busy, setBusy] = reactExports.useState(false),
    [uploading, setUploading] = reactExports.useState(false),
    [error, setError] = reactExports.useState(''),
    [message, setMessage] = reactExports.useState('');
  async function save(e) {
    e.preventDefault();
    if (busy || uploading) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await saveStoreMedia(store, product.id, editing, form);
      await onChanged();
      setForm({
        ...empty(),
        sort_order: Number(form.sort_order) + 1,
        is_primary: false
      });
      setEditing(null);
      setMessage('Image saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(row) {
    if (!window.confirm('Remove this image from the gallery? The original file will be kept.')) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await removeStoreMedia(store, product.id, row.id);
      await onChanged();
      if (editing === row.id) {
        setEditing(null);
        setForm(empty());
      }
      setMessage('Image removed from gallery.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
    className: "surface sc-panel",
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
      children: "Product images"
    }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "hint",
      children: "Upload an image or paste a public image URL, then save it. Choose a primary image for product cards."
    }), /*#__PURE__*/jsxRuntimeExports.jsx(Messages, {
      error: error,
      message: message
    }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "sc-gallery",
      children: [...(product.media || [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order).map(row => /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "sc-image",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("img", {
          src: row.public_url,
          alt: row.alt_text || product.name
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
          className: "hint",
          children: [row.is_primary ? 'Primary · ' : '', "Order ", row.sort_order]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "sc-actions",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
            type: "button",
            className: "btn btn-outline btn-sm",
            disabled: busy || uploading,
            onClick: () => {
              setEditing(row.id);
              setForm(row);
              setMessage('');
            },
            children: "Edit"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
            type: "button",
            className: "btn btn-outline btn-sm",
            disabled: busy || uploading,
            onClick: () => remove(row),
            children: "Remove"
          })]
        })]
      }, row.id))
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("form", {
      onSubmit: save,
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("fieldset", {
        disabled: busy || uploading,
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h3", {
          children: editing ? 'Edit image' : 'Add image'
        }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
          label: "Image URL",
          field: "public_url",
          value: form,
          set: setForm,
          required: true
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsx(Upload, {
        store: store,
        disabled: busy,
        onUpload: public_url => setForm(old => ({
          ...old,
          public_url
        })),
        onBusy: setUploading,
        onError: setError
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("fieldset", {
        disabled: busy || uploading,
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "adm-grid2",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            label: "Image description / alt text",
            field: "alt_text",
            value: form,
            set: setForm
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            label: "Display order",
            field: "sort_order",
            type: "number",
            step: "1",
            value: form,
            set: setForm
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsx(Check, {
          label: "Use as primary image",
          field: "is_primary",
          value: form,
          set: setForm
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "sc-actions",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
            className: "btn btn-sm",
            type: "submit",
            children: busy ? 'Saving…' : 'Save image'
          }), editing && /*#__PURE__*/jsxRuntimeExports.jsx("button", {
            className: "btn btn-outline btn-sm",
            type: "button",
            onClick: () => {
              setEditing(null);
              setForm(empty());
            },
            children: "Cancel edit"
          })]
        })]
      })]
    })]
  });
}
function ProductEditor({
  store,
  productId
}) {
  const navigate = useNavigate(),
    [params] = useSearchParams();
  const isNew = productId === 'new';
  const [categories, setCategories] = reactExports.useState([]),
    [product, setProduct] = reactExports.useState(null);
  const [form, setForm] = reactExports.useState({
    ...EMPTY_PRODUCT,
    category_id: params.get('category') || ''
  });
  const [loading, setLoading] = reactExports.useState(true),
    [busy, setBusy] = reactExports.useState(false),
    [error, setError] = reactExports.useState(''),
    [message, setMessage] = reactExports.useState(''),
    [loadError, setLoadError] = reactExports.useState('');
  reactExports.useEffect(() => {
    let current = true;
    Promise.all([listStoreCategories(store), isNew ? Promise.resolve(null) : getStoreProduct(store, productId)]).then(([cats, row]) => {
      if (!current) return;
      setCategories(cats);
      setProduct(row);
      if (row) setForm(row);
    }).catch(err => {
      if (current) setLoadError(err.message);
    }).finally(() => {
      if (current) setLoading(false);
    });
    return () => {
      current = false;
    };
  }, [store, productId, isNew]);
  async function refresh() {
    try {
      setProduct(await getStoreProduct(store, productId));
    } catch {
      setError('Changes were saved, but the updated product could not be loaded. Reload this page before making more changes.');
    }
  }
  async function save(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const row = await saveStoreProduct(store, isNew ? null : productId, form);
      if (isNew) {
        navigate(`/admin/store-catalogue/${store}/${row.id}`, {
          replace: true
        });
        return;
      }
      setForm(old => ({
        ...old,
        ...row
      }));
      await refresh();
      setMessage(row.is_active ? 'Published. Refresh the storefront to see your changes.' : 'Draft saved. Add images and stock/variants, then publish above.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  if (loading) return /*#__PURE__*/jsxRuntimeExports.jsx("p", {
    role: "status",
    children: "Loading product\u2026"
  });
  if (loadError) return /*#__PURE__*/jsxRuntimeExports.jsx(Messages, {
    error: loadError
  });
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    className: "adm-form sc-product",
    children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "sc-actions",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx(Link, {
        className: "inline-link",
        to: `/admin/store-catalogue/${store}`,
        children: "\u2190 Back to products"
      }), product?.is_active && /*#__PURE__*/jsxRuntimeExports.jsx("a", {
        className: "inline-link",
        href: catalogueProductHref(store, product.slug),
        target: "_blank",
        rel: "noreferrer",
        children: "View product \u2197"
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsx(Messages, {
      error: error,
      message: message
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("form", {
      className: "surface sc-panel",
      onSubmit: save,
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
        children: isNew ? 'Add product' : product?.name
      }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
        className: "hint",
        children: isNew ? '1. Create a draft → 2. Add images and stock/variants → 3. Publish.' : `Status: ${product?.is_active ? 'Published' : 'Draft — not visible to customers'}. Images and variants have their own save buttons below.`
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("fieldset", {
        disabled: busy,
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "adm-grid2",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            label: "Product name",
            field: "name",
            value: form,
            set: setForm,
            required: true
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            label: "Slug",
            field: "slug",
            value: form,
            set: setForm,
            hint: form.slug ? 'Changing a slug changes the product link.' : `Automatic: ${catalogueSlug(form.name) || 'product-name'}`
          }), /*#__PURE__*/jsxRuntimeExports.jsx(CategorySelect, {
            categories: categories,
            value: form.category_id,
            onChange: category_id => setForm({
              ...form,
              category_id
            })
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            label: "Brand",
            field: "brand",
            value: form,
            set: setForm
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            label: "MRP \u20B9",
            field: "mrp",
            type: "number",
            min: "0.01",
            step: "0.01",
            value: form,
            set: setForm,
            required: true
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            label: "Selling price \u20B9 (optional)",
            field: "sale_price",
            type: "number",
            min: "0.01",
            max: form.mrp || undefined,
            step: "0.01",
            value: form,
            set: setForm,
            hint: "Leave blank to sell at MRP. Discount is calculated automatically."
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            label: "Product SKU (optional)",
            field: "sku",
            value: form,
            set: setForm
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            label: "Pack / dimensions (optional)",
            field: "net_content",
            value: form,
            set: setForm,
            hint: "Example: Set of 2 \xB7 40 \xD7 40 cm"
          }), store === 'homeliving' && /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            label: "Stock quantity (without variants)",
            field: "stock",
            type: "number",
            min: "0",
            step: "1",
            value: form,
            set: setForm,
            required: true
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
            label: "Display order",
            field: "sort_order",
            type: "number",
            step: "1",
            value: form,
            set: setForm
          })]
        }), !categories.length && /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
          className: "hint",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx(Link, {
            to: `/admin/store-catalogue/${store}?tab=categories`,
            children: "Create a category first"
          }), "."]
        }), /*#__PURE__*/jsxRuntimeExports.jsx(Field, {
          label: "Description",
          field: "description",
          value: form,
          set: setForm,
          multiline: true
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "sc-actions",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx(Check, {
            label: "New arrival",
            field: "is_new",
            value: form,
            set: setForm
          }), /*#__PURE__*/jsxRuntimeExports.jsx(Check, {
            label: "Bestseller",
            field: "is_bestseller",
            value: form,
            set: setForm
          }), !isNew && /*#__PURE__*/jsxRuntimeExports.jsx(Check, {
            label: "Published / visible to customers",
            field: "is_active",
            value: form,
            set: setForm
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          className: "btn",
          type: "submit",
          disabled: !categories.length,
          children: busy ? 'Saving…' : isNew ? 'Create draft & continue' : 'Save product'
        })]
      })]
    }), !isNew && product && /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
      children: [/*#__PURE__*/jsxRuntimeExports.jsx(GalleryEditor, {
        store: store,
        product: product,
        onChanged: refresh
      }), /*#__PURE__*/jsxRuntimeExports.jsx(VariantsEditor, {
        store: store,
        product: product,
        onChanged: refresh
      })]
    })]
  });
}
function StoreCatalogue() {
  const {
      store,
      productId
    } = useParams(),
    navigate = useNavigate();
  if (!Object.hasOwn(CATALOGUE_STORES, store)) return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    className: "adm-empty",
    children: ["Choose a store: ", /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
      to: "/admin/store-catalogue/fashion",
      children: "Fashion"
    }), " \xB7 ", /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
      to: "/admin/store-catalogue/homeliving",
      children: "Home & Living"
    })]
  });
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    className: "adm-catalogue",
    children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm__head",
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h1", {
          children: "Store Products"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          children: "Manage products and categories for Fashion and Home & Living. Lifestyle brings both stores together."
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
        className: "btn btn-outline btn-sm",
        to: "/admin/storefronts",
        children: "Storefront design"
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "sc-toolbar",
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("label", {
        className: "sc-field",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
          className: "label",
          children: "Store"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("select", {
          className: "select",
          value: store,
          disabled: !!productId,
          onChange: e => navigate(`/admin/store-catalogue/${e.target.value}`),
          children: Object.entries(CATALOGUE_STORES).map(([id, label]) => /*#__PURE__*/jsxRuntimeExports.jsx("option", {
            value: id,
            children: label
          }, id))
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("a", {
        className: "inline-link",
        href: `/${store}`,
        target: "_blank",
        rel: "noreferrer",
        children: ["View ", CATALOGUE_STORES[store], " \u2197"]
      }), /*#__PURE__*/jsxRuntimeExports.jsx("a", {
        className: "inline-link",
        href: "/lifestyle",
        target: "_blank",
        rel: "noreferrer",
        children: "View Lifestyle \u2197"
      })]
    }), productId ? /*#__PURE__*/jsxRuntimeExports.jsx(ProductEditor, {
      store: store,
      productId: productId
    }, `${store}-${productId}`) : /*#__PURE__*/jsxRuntimeExports.jsx(CatalogueList, {
      store: store
    }, store)]
  });
}

export { StoreCatalogue as default };
//# sourceMappingURL=StoreCatalogue.js.map
