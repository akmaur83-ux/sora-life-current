// ============================================================
// The catalogue loading kit's single source of truth: every column of every
// sheet, what it is for, its format, what a blank does, what is refused and
// the message you see. The templates, FIELD-GUIDE.md, the validator and the
// supplier mapper are all built from this file (kit.mjs build); the kit's suite
// pins that they agree with it and with the importer's own messages.
//
// "Kits" are what you fill in: fashion and jewellery. Both load into the
// fashion store (jewellery is the fashion store's Jewellery category), so they
// share the products and variants sheets; jewellery adds its own columns and
// a stones sheet. Companies (manufacturer / packer / importer) are one sheet
// shared by both.
//
// importable: true — the admin's CSV import reads it. Since migration 0036 and
// the importer update (2026-10-12) every column is; the flag stays so the suite
// can pin the kit to the importer's own column lists, both ways.
// ============================================================
import { PURITY, METALS, FITS, STONE_ORIGINS, MAKING_TYPES, RATE_LINKED_NOT_LIVE } from '../../src/lib/storeCatalogueAdmin.js';

export { PURITY, METALS, FITS, STONE_ORIGINS };

export const KITS = {
  fashion: { label: 'Fashion', store: 'fashion', categoryRoot: null },
  jewellery: { label: 'Jewellery', store: 'fashion', categoryRoot: 'jewellery' },
};

export const SHEETS = {
  products: 'One row per product (per design and purity for jewellery).',
  variants: 'One row per size × colour of a product. Every fashion and jewellery product needs at least one: a product without an active variant cannot be published or bought.',
  stones: 'Jewellery only. One row per kind of stone in a piece (a ring with diamonds and a ruby has two rows).',
  companies: 'One row per company a listing names as manufacturer, packer or importer. Shared by fashion and jewellery.',
};

// The importer's own wording, quoted so the guide says exactly what you will read.
export const MSG = {
  slugRule: 'Use lowercase letters, numbers and single hyphens in the slug.',
  skuRule: 'SKU must be 1–64 letters, numbers, dots, slashes, hyphens or underscores, starting with a letter or number.',
  name: 'Enter a product name.',
  mrp: 'Enter an MRP of at least ₹0.01.',
  sale: 'Selling price must be at least ₹0.01, or blank to sell at MRP.',
  saleOverMrp: 'Selling price cannot be more than the MRP (₹…).',
  hsn: 'HSN code must be 4, 6 or 8 digits.',
  gst: 'GST rate must be a number from 0 to 100, or blank.',
  stock: 'Stock must be a whole number, 0 or more.',
  order: 'Display order must be a whole number.',
  yesNo: '…: use yes or no.',
  category: 'Category "…" is not a Fashion category — use the path from the export, e.g. "…".',
  categoryMissing: 'Choose a category in this store.',
  noSlug: 'A row needs a slug (or the id of an existing product).',
  noId: 'No product in this store has this id.',
  slugTaken: 'Another product would have the slug "…".',
  skuTaken: 'Another product would have the SKU "…".',
  twice: 'This product appears more than once in the file (lines …).',
  variantProduct: 'No Fashion product has the slug "…".',
  variantSize: 'A row needs a size.',
  variantColour: 'Enter a colour. Use “Default” for a single option.',
  hex: 'Colour hex must look like #123ABC.',
  override: 'Price override must be at least ₹0.01, or blank to use the product price.',
  variantSku: 'Another variant already has the SKU "…". Variant SKUs are unique across every store.',
  variantTwice: 'This variant appears more than once in the file (lines …).',
  // Migration 0036: declarations, jewellery, stones and companies.
  country: 'Country of origin must be a 2-letter code such as IN.',
  genericLong: 'Generic name: keep it under 120 characters.',
  noCompany: 'Manufacturer “…” is not in the Companies list — add it on the Companies tab (or import the companies file) first.',
  materialTotal: 'Material percentages add up to …%, not 100%.',
  materialLong: 'Material: keep it under 300 characters.',
  careLong: 'Care instructions: keep it under 1000 characters.',
  fit: `Fit must be one of ${FITS.join(', ')}.`,
  metal: `Metal must be one of ${METALS.join(', ')}.`,
  purityNumber: 'Purity is the fineness, a whole number such as 916 (22K) or 925 (sterling).',
  purityGrade: '… is not a … grade. Use …',
  purityMetal: 'Purity is only for gold, silver and platinum, not …',
  makingType: `Making charge type must be one of ${MAKING_TYPES.join(', ')}.`,
  makingValue: 'Making charges must be a number, 0 or more.',
  makingPair: 'Making charges need both a type and a value.',
  makingPercent: 'A making charge percentage cannot be over 100.',
  pricing: 'Pricing must be one of fixed, rate_linked.',
  rateLinked: RATE_LINKED_NOT_LIVE,
  gross: 'Gross weight must be grams above 0, e.g. 3.250.',
  net: 'Net metal weight must be grams above 0, e.g. 3.250.',
  netOverGross: 'Net metal weight … g cannot be more than the gross weight … g.',
  stoneRow: 'A row needs the stone.',
  stoneLong: 'Keep the stone’s name under 60 characters.',
  stoneNew: 'This product has no such stone. Tick "Create new" to add it.',
  stoneOrigin: 'Origin must be natural, lab_grown or simulant: say which.',
  stoneCount: 'Stone count must be a whole number, 1 or more.',
  carat: 'Total carat must be more than 0.',
  stoneWeight: 'Total weight must be grams above 0, e.g. 3.250.',
  certificate: 'A certificate needs both its lab and its number.',
  stoneTwice: 'This stone appears more than once in the file (lines …).',
  companyRow: 'A row needs the company’s name.',
  companyTwice: 'This company appears more than once in the file (lines …).',
  companyAddress: 'Enter the address as it is printed on the label.',
  companyCountry: 'Country must be a 2-letter code such as IN.',
  phone: 'Keep the phone under 40 characters.',
  email: 'Enter an email address like name@domain.com.',
  gstin: 'GSTIN must be 15 characters like 27ABCDE1234F1Z5.',
};

const BOTH = ['fashion', 'jewellery'];
const J = ['jewellery'];
const F = ['fashion'];

/**
 * One entry per column. `required`: 'new' (needed to create the row), 'live'
 * (expected before the product goes live — warned, never enforced), or 'no'.
 */
export const COLUMNS = [
  // ---------- products ----------
  { sheet: 'products', key: 'id', kits: BOTH, importable: true, required: 'no',
    purpose: 'Updates an existing product instead of creating one. Copy it from the admin export.',
    format: 'The product’s id exactly as the export shows it.', example: { fashion: '', jewellery: '' },
    blank: 'The row is matched on its slug; a slug no product has creates a new draft (when “Create new products” is ticked).',
    rejects: [['An id no product in this store has', MSG.noId]] },
  { sheet: 'products', key: 'slug', kits: BOTH, importable: true, required: 'new',
    purpose: 'The product’s address (/fashion/p/<slug>) and the name its images are filed under (<slug>-1.webp).',
    format: 'Lowercase letters, numbers and single hyphens; unique within the fashion store. For jewellery, put the purity in it so 18K and 22K listings differ.',
    example: { fashion: 'meadow-linen-shirt-sage', jewellery: 'classic-band-ring-22k' },
    blank: 'For a new product the row is skipped; for an existing product (matched by id) the slug is kept.',
    rejects: [['Capitals, spaces or other characters', MSG.slugRule], ['A slug another product has or would have', MSG.slugTaken], ['No slug and no id', MSG.noSlug], ['The same product twice in the file', MSG.twice]] },
  { sheet: 'products', key: 'name', kits: BOTH, importable: true, required: 'new',
    purpose: 'The product name customers read on cards and the product page.',
    format: 'Plain text. Checked for speed, sustainability and medical claims.',
    example: { fashion: 'Meadow Linen Shirt — Sage', jewellery: 'Classic Band Ring — 22K Yellow Gold' },
    blank: 'A new product is refused; an existing product keeps its name.',
    rejects: [['Blank on a new product', MSG.name]] },
  { sheet: 'products', key: 'brand', kits: BOTH, importable: true, required: 'no',
    purpose: 'Shown above the name on the product page and in Details.', format: 'Plain text.',
    example: { fashion: 'Celeste & Co.', jewellery: 'Aurum Atelier' }, blank: 'No brand is shown.', rejects: [] },
  { sheet: 'products', key: 'category', kits: BOTH, importable: true, required: 'new',
    purpose: 'Where the product is filed and listed.',
    format: 'The category path by slugs, exactly as the admin export writes it (e.g. clothing/men/mens-shirts). The labels with " / " are accepted too. Jewellery must sit under jewellery/.',
    example: { fashion: 'clothing/men/mens-shirts', jewellery: 'jewellery/rings' },
    blank: 'A new product is refused; an existing product keeps its category.',
    rejects: [['A path that is not a category in the store', MSG.category], ['Blank on a new product', MSG.categoryMissing]] },
  { sheet: 'products', key: 'description', kits: BOTH, importable: true, required: 'no',
    purpose: '“About this style” on the product page.',
    format: 'Plain text, shown as ONE paragraph (line breaks are not kept). No HTML. Checked for speed, sustainability and medical claims.',
    example: { fashion: 'A relaxed shirt in washed linen with a camp collar and a chest pocket.', jewellery: 'A plain, comfortable band with a softly rounded edge.' },
    blank: 'No “About this style” section is shown.', rejects: [] },
  { sheet: 'products', key: 'mrp', kits: BOTH, importable: true, required: 'new',
    purpose: 'Maximum retail price, inclusive of all taxes. Shown struck through when there is a selling price.',
    format: 'A number in rupees: 2499 or 2,499 or ₹2,499.00. At least 0.01. Nothing may sell above it (the validator checks every size’s price).',
    example: { fashion: '2499', jewellery: '28999' }, blank: 'A new product is refused; an existing product keeps its MRP.',
    rejects: [['Blank, zero or not a number', MSG.mrp]] },
  { sheet: 'products', key: 'sale_price', kits: BOTH, importable: true, required: 'no',
    purpose: 'The price the product sells at, when below the MRP. The discount badge is worked out from the two.',
    format: 'A number in rupees, at most the MRP.', example: { fashion: '1999', jewellery: '26999' },
    blank: 'The product sells at its MRP (no discount shown).',
    rejects: [['More than the MRP', MSG.saleOverMrp], ['Zero or not a number', MSG.sale]] },
  { sheet: 'products', key: 'sku', kits: BOTH, importable: true, required: 'no',
    purpose: 'Your code for the product (style code). Orders carry the variant SKU, not this one.',
    format: 'Letters, numbers, dots, slashes, hyphens, underscores; up to 64; unique within the store.',
    example: { fashion: 'CEL-SH-0147', jewellery: 'AA-RG-22K-014' }, blank: 'No product SKU.',
    rejects: [['Other characters, or over 64', MSG.skuRule], ['A SKU another product has', MSG.skuTaken]] },
  { sheet: 'products', key: 'net_content', kits: BOTH, importable: true, required: 'live',
    purpose: 'Net quantity — the Legal Metrology declaration (number of pieces in the pack). Not yet shown on fashion pages.',
    format: 'Plain text with the count: "1 N", "1 pair", "Set of 2".', example: { fashion: '1 N', jewellery: '1 N' },
    blank: 'Nothing recorded (the validator warns: expected before going live).', rejects: [] },
  { sheet: 'products', key: 'hsn_code', kits: BOTH, importable: true, required: 'live',
    purpose: 'The HSN code for GST invoicing.',
    format: '4, 6 or 8 digits; spaces and dots are dropped ("6205.20" becomes 620520). Keep it as text in a spreadsheet so a leading 0 is not lost.',
    example: { fashion: '6205', jewellery: '7113' }, blank: 'Nothing recorded (the validator warns).',
    rejects: [['3, 5, 7 or 9+ digits, or letters', MSG.hsn]] },
  { sheet: 'products', key: 'gst_rate', kits: BOTH, importable: true, required: 'no',
    purpose: 'The GST rate, recorded for the audit — checkout does not charge it yet.',
    format: 'A percentage from 0 to 100, without the % sign. Confirm each rate with your CA: apparel rates depend on the selling price.',
    example: { fashion: '', jewellery: '3' }, blank: 'Not recorded.', rejects: [['Below 0, above 100, or not a number', MSG.gst]] },
  { sheet: 'products', key: 'stock', kits: BOTH, importable: true, required: 'no',
    purpose: 'Product-level stock. NOT USED for fashion or jewellery: stock is per variant. Leave blank.',
    format: 'A whole number, 0 or more.', example: { fashion: '', jewellery: '' }, blank: 'A new product gets 0 (unused).',
    rejects: [['Negative or not a whole number', MSG.stock]] },
  { sheet: 'products', key: 'is_new', kits: BOTH, importable: true, required: 'no',
    purpose: 'Shows the “New” badge when the product has no discount.', format: 'yes or no.',
    example: { fashion: 'yes', jewellery: 'no' }, blank: 'No (for a new product); unchanged for an existing one.', rejects: [['Anything but yes/no/true/false/1/0', MSG.yesNo]] },
  { sheet: 'products', key: 'is_bestseller', kits: BOTH, importable: true, required: 'no',
    purpose: 'Marks a real sales leader. Leave no until sales show it — it is a claim.', format: 'yes or no.',
    example: { fashion: 'no', jewellery: 'no' }, blank: 'No.', rejects: [['Anything but yes/no/true/false/1/0', MSG.yesNo]] },
  { sheet: 'products', key: 'sort_order', kits: BOTH, importable: true, required: 'no',
    purpose: 'Display order inside listings; lower comes first.', format: 'A whole number (may be negative).',
    example: { fashion: '10', jewellery: '10' }, blank: '0.', rejects: [['Not a whole number', MSG.order]] },

  // ---------- products: the 0036 declarations ----------
  { sheet: 'products', key: 'country_of_origin', kits: BOTH, importable: true, required: 'live',
    purpose: 'Country of origin — a declaration every listing carries. Shown under Product information on the product page.',
    format: 'The 2-letter country code: IN, CN, BD, LK, VN, TR, IT… Lower case is read as upper case.', example: { fashion: 'IN', jewellery: 'IN' },
    blank: 'Not recorded (the validator and the editor warn).', rejects: [['Anything but two letters', MSG.country]] },
  { sheet: 'products', key: 'generic_name', kits: BOTH, importable: true, required: 'no',
    purpose: 'The common name of the item, when the product name is a style name ("Meadow" is a shirt).',
    format: 'Plain text, up to 120 characters.', example: { fashion: 'Shirt', jewellery: 'Ring' }, blank: 'The product name serves.',
    rejects: [['Over 120 characters', MSG.genericLong]] },
  { sheet: 'products', key: 'manufacturer', kits: BOTH, importable: true, required: 'live',
    purpose: 'Manufactured by — the name and address printed on the product page come from the Companies list.',
    format: 'The company’s name exactly as in the Companies list (companies.csv); capitals aside.', example: { fashion: 'Example Textiles Pvt Ltd', jewellery: 'Example Jewellers LLP' },
    blank: 'Not recorded (the validator and the editor warn).', rejects: [['A name not in the Companies list', MSG.noCompany]] },
  { sheet: 'products', key: 'packer', kits: BOTH, importable: true, required: 'no',
    purpose: 'Packed by, when a different company packs it.', format: 'A name from the Companies list.', example: { fashion: '', jewellery: '' },
    blank: 'Not shown.', rejects: [['A name not in the Companies list', 'Packer “…” is not in the Companies list — add it on the Companies tab (or import the companies file) first.']] },
  { sheet: 'products', key: 'importer', kits: BOTH, importable: true, required: 'live',
    purpose: 'Imported by — expected whenever the country of origin is not IN.', format: 'A name from the Companies list.', example: { fashion: '', jewellery: '' },
    blank: 'Not shown (the validator and the editor warn when the product is made outside India).', rejects: [['A name not in the Companies list', 'Importer “…” is not in the Companies list — add it on the Companies tab (or import the companies file) first.']] },
  { sheet: 'products', key: 'material', kits: F, importable: true, required: 'live',
    purpose: 'Fabric composition.',
    format: 'Percentages that add up to 100, comma-separated: "100% linen", "60% cotton, 40% polyester". Up to 300 characters.',
    example: { fashion: '100% linen' }, blank: 'Not recorded (the validator and the editor warn).',
    rejects: [['Percentages that do not add up to 100', MSG.materialTotal], ['Over 300 characters', MSG.materialLong]] },
  { sheet: 'products', key: 'care', kits: F, importable: true, required: 'live',
    purpose: 'Care instructions.', format: 'Plain text, semicolons between instructions; up to 1000 characters.',
    example: { fashion: 'Machine wash cold; do not bleach; dry in shade; warm iron' }, blank: 'Not recorded (the validator and the editor warn).',
    rejects: [['Over 1000 characters', MSG.careLong]] },
  { sheet: 'products', key: 'fit', kits: F, importable: true, required: 'no',
    purpose: 'How it fits.', format: `One of: ${FITS.join(', ')} (capitals aside).`, example: { fashion: 'Relaxed' }, blank: 'Not shown.',
    rejects: [['A word outside the list', MSG.fit]] },
  { sheet: 'products', key: 'metal', kits: J, importable: true, required: 'live',
    purpose: 'The metal the piece is made of.', format: `One of: ${METALS.join(', ')}.`, example: { jewellery: 'gold' },
    blank: 'Not recorded (the validator and the editor warn).', rejects: [['A value outside the list', MSG.metal]] },
  { sheet: 'products', key: 'purity', kits: J, importable: true, required: 'live',
    purpose: 'Purity as fineness — one purity per listing (18K and 22K are separate listings).',
    format: 'Fineness in parts per thousand. Gold: 375 (9K), 585 (14K), 750 (18K), 833 (20K), 916 (22K), 958 (23K), 995 or 999 (24K). Silver: 925 (sterling), 999 and the other BIS grades. Platinum: 850, 900, 950. Only for gold, silver and platinum.',
    example: { jewellery: '916' }, blank: 'Not recorded (the validator and the editor warn for gold, silver and platinum).',
    rejects: [['Not a whole number from 1 to 999', MSG.purityNumber], ['Not a grade of the metal', MSG.purityGrade], ['Set on a plated or base metal', MSG.purityMetal]] },
  { sheet: 'products', key: 'making_charge_type', kits: J, importable: true, required: 'no',
    purpose: 'How making charges are expressed, recorded with the listing. The selling price is still what customers pay.', format: 'per_gram, percent or flat. Set together with making_charge_value.',
    example: { jewellery: 'per_gram' }, blank: 'No making charges recorded (leave both blank).',
    rejects: [['A value outside the list', MSG.makingType], ['Only one of type and value', MSG.makingPair]] },
  { sheet: 'products', key: 'making_charge_value', kits: J, importable: true, required: 'no',
    purpose: 'Making charges: rupees per gram, a percentage, or a flat amount per piece.', format: 'A number, 0 or more; a percent is at most 100.',
    example: { jewellery: '450' }, blank: 'Leave blank with the type.', rejects: [['Negative or not a number', MSG.makingValue], ['A percent over 100', MSG.makingPercent]] },
  { sheet: 'products', key: 'pricing_mode', kits: J, importable: true, required: 'no',
    purpose: 'fixed: the price in this sheet. rate_linked: priced from the day’s metal rate — recorded only; such a product saves as a draft and cannot go live until the rate engine exists.',
    format: 'fixed or rate_linked.', example: { jewellery: 'fixed' }, blank: 'fixed.',
    rejects: [['Anything else', MSG.pricing], ['rate_linked on a product being published (in the editor)', MSG.rateLinked]] },

  // ---------- variants ----------
  { sheet: 'variants', key: 'product_slug', kits: BOTH, importable: true, required: 'new',
    purpose: 'Which product this size/colour belongs to. Import the products file first.', format: 'The product’s slug.',
    example: { fashion: 'meadow-linen-shirt-sage', jewellery: 'classic-band-ring-22k' }, blank: 'The row is skipped.',
    rejects: [['A slug no product has (yet)', MSG.variantProduct]] },
  { sheet: 'variants', key: 'size', kits: BOTH, importable: true, required: 'new',
    purpose: 'The size customers choose. Use “One size” when there is only one.', format: 'Plain text: S, M, L, 32, UK 8, ring size 14, One size.',
    example: { fashion: 'M', jewellery: '14' }, blank: 'The row is skipped.', rejects: [['Blank', MSG.variantSize], ['The same size and colour twice in the file', MSG.variantTwice]] },
  { sheet: 'variants', key: 'colour', kits: BOTH, importable: true, required: 'new',
    purpose: 'The colour customers choose; for jewellery, the metal colour.', format: 'Plain text: Sage, White, Yellow gold, Rose gold.',
    example: { fashion: 'Sage', jewellery: 'Yellow gold' }, blank: 'A fashion variant is refused.', rejects: [['Blank', MSG.variantColour]] },
  { sheet: 'variants', key: 'colour_hex', kits: BOTH, importable: true, required: 'no',
    purpose: 'The swatch colour.', format: '#RRGGBB.', example: { fashion: '#8FA58A', jewellery: '#D4AF37' },
    blank: 'A neutral beige swatch.', rejects: [['Anything but #RRGGBB', MSG.hex]] },
  { sheet: 'variants', key: 'sku', kits: BOTH, importable: true, required: 'no',
    purpose: 'The code orders and packing slips carry for this exact size and colour.',
    format: 'As the product SKU; unique across EVERY store (fashion, Home & Living, grocery).', example: { fashion: 'CEL-SH-0147-SG-M', jewellery: 'AA-RG-22K-014-YG-14' },
    blank: 'No variant SKU.', rejects: [['A SKU another variant has', MSG.variantSku], ['Other characters, or over 64', MSG.skuRule]] },
  { sheet: 'variants', key: 'stock', kits: BOTH, importable: true, required: 'new',
    purpose: 'Units available for this size and colour. 0 lists it as sold out.', format: 'A whole number, 0 or more.',
    example: { fashion: '12', jewellery: '2' }, blank: 'A new variant is refused; an existing one keeps its stock.', rejects: [['Blank on a new variant, negative or not whole', MSG.stock]] },
  { sheet: 'variants', key: 'price_override', kits: BOTH, importable: true, required: 'no',
    purpose: 'This size’s own selling price, when sizes are priced differently.', format: 'A number in rupees, never above the product’s MRP.',
    example: { fashion: '2199', jewellery: '28499' }, blank: 'The product’s selling price (or MRP).',
    rejects: [['Zero or not a number', MSG.override], ['Above the product’s MRP (the import does not check this; the validator does)', 'Price override ₹… is above the MRP ₹…: nothing may sell above its MRP.']] },
  { sheet: 'variants', key: 'is_active', kits: BOTH, importable: true, required: 'no',
    purpose: 'Whether customers can choose this size/colour.', format: 'yes or no.', example: { fashion: 'yes', jewellery: 'yes' },
    blank: 'Yes for a new variant.', rejects: [['Anything but yes/no', MSG.yesNo]] },
  { sheet: 'variants', key: 'sort_order', kits: BOTH, importable: true, required: 'no',
    purpose: 'The order sizes and colours are offered in; lower first.', format: 'A whole number.', example: { fashion: '2', jewellery: '3' },
    blank: 'Its position in the file.', rejects: [['Not a whole number', MSG.order]] },
  // ---------- variants: the 0036 weights ----------
  { sheet: 'variants', key: 'gross_weight_g', kits: J, importable: true, required: 'live',
    purpose: 'Gross weight of the piece in grams (metal + stones). A ring’s changes with its size.', format: 'Grams, up to 3 decimals: 3.250.',
    example: { jewellery: '3.250' }, blank: 'Not recorded (the validator and the editor warn).', rejects: [['Zero, negative or not a number', MSG.gross]] },
  { sheet: 'variants', key: 'net_metal_weight_g', kits: J, importable: true, required: 'live',
    purpose: 'Net weight of the metal alone in grams.', format: 'Grams, up to 3 decimals; at most the gross weight.',
    example: { jewellery: '3.250' }, blank: 'Not recorded (the validator and the editor warn).', rejects: [['Zero, negative or not a number', MSG.net], ['More than the gross weight', MSG.netOverGross]] },

  // ---------- stones (jewellery, 0036) ----------
  { sheet: 'stones', key: 'product_slug', kits: J, importable: true, required: 'new', purpose: 'The product the stones are set in. Import the products file first.', format: 'The product’s slug.', example: { jewellery: 'solitaire-pendant-18k' }, blank: 'The row is skipped.', rejects: [['A slug no product has (yet)', MSG.variantProduct]] },
  { sheet: 'stones', key: 'stone', kits: J, importable: true, required: 'new', purpose: 'The stone. With the slug and the shape, it is how a row finds the stone already on the product.', format: 'Plain text, up to 60 characters: diamond, ruby, emerald, pearl, cubic zirconia.', example: { jewellery: 'diamond' }, blank: 'The row is skipped.', rejects: [['Blank', MSG.stoneRow], ['Over 60 characters', MSG.stoneLong], ['A stone the product does not have, without “Create new”', MSG.stoneNew], ['The same stone and shape twice in the file', MSG.stoneTwice]] },
  { sheet: 'stones', key: 'origin', kits: J, importable: true, required: 'new', purpose: 'Natural, lab-grown, or a simulant (cubic zirconia, glass) — disclosed on the product page.', format: STONE_ORIGINS.join(', ') + '.', example: { jewellery: 'lab_grown' }, blank: 'A new stone is refused; an existing one keeps its origin.', rejects: [['Anything else', MSG.stoneOrigin]] },
  { sheet: 'stones', key: 'shape', kits: J, importable: true, required: 'no', purpose: 'Cut shape. Part of how a row is matched (two diamond rows of different shapes are two stones).', format: 'round, oval, pear, princess, emerald, marquise…', example: { jewellery: 'round' }, blank: 'Not shown.', rejects: [] },
  { sheet: 'stones', key: 'stone_count', kits: J, importable: true, required: 'new', purpose: 'How many of these stones.', format: 'A whole number, 1 or more.', example: { jewellery: '1' }, blank: 'A new stone is refused; an existing one keeps its count.', rejects: [['0 or not whole', MSG.stoneCount]] },
  { sheet: 'stones', key: 'total_carat', kits: J, importable: true, required: 'no', purpose: 'Total carat weight of these stones together.', format: 'Carats, up to 3 decimals: 0.250.', example: { jewellery: '0.250' }, blank: 'Not shown.', rejects: [['0, negative or not a number', MSG.carat]] },
  { sheet: 'stones', key: 'total_weight_g', kits: J, importable: true, required: 'no', purpose: 'Total weight in grams, for stones sold by gram weight.', format: 'Grams, up to 3 decimals.', example: { jewellery: '' }, blank: 'Not shown.', rejects: [['0, negative or not a number', MSG.stoneWeight]] },
  { sheet: 'stones', key: 'clarity', kits: J, importable: true, required: 'no', purpose: 'Clarity grade.', format: 'VVS1, VS1, SI1… Up to 20 characters.', example: { jewellery: 'VS1' }, blank: 'Not shown.', rejects: [] },
  { sheet: 'stones', key: 'colour_grade', kits: J, importable: true, required: 'no', purpose: 'Colour grade.', format: 'D–Z for diamonds. Up to 20 characters.', example: { jewellery: 'F' }, blank: 'Not shown.', rejects: [] },
  { sheet: 'stones', key: 'certificate_lab', kits: J, importable: true, required: 'no', purpose: 'The grading lab.', format: 'IGI, GIA, SGL… Set together with certificate_no.', example: { jewellery: 'IGI' }, blank: 'No certificate (leave both blank).', rejects: [['Only one of lab and number', MSG.certificate]] },
  { sheet: 'stones', key: 'certificate_no', kits: J, importable: true, required: 'no', purpose: 'The certificate number.', format: 'As printed on the certificate.', example: { jewellery: 'LG000000000' }, blank: 'Leave blank with the lab.', rejects: [] },
  { sheet: 'stones', key: 'sort_order', kits: J, importable: true, required: 'no', purpose: 'Order stones are listed in.', format: 'A whole number.', example: { jewellery: '1' }, blank: 'After the stones already on the product.', rejects: [['Not a whole number', MSG.order]] },

  // ---------- companies (0036) ----------
  { sheet: 'companies', key: 'name', kits: BOTH, importable: true, required: 'new', purpose: 'The company’s legal name; products name it in manufacturer / packer / importer. One list serves every store.', format: 'Plain text, up to 160 characters, each company once. A name already in the list (capitals aside) updates that company.', example: { fashion: 'Example Textiles Pvt Ltd', jewellery: 'Example Jewellers LLP' }, blank: 'The row is skipped.', rejects: [['Blank', MSG.companyRow], ['The same name twice in the file', MSG.companyTwice]] },
  { sheet: 'companies', key: 'address', kits: BOTH, importable: true, required: 'new', purpose: 'The address as it is printed on the label, and on the product page.', format: 'One line: street, city, state, PIN. Up to 400 characters.', example: { fashion: 'Plot 12, Industrial Area Phase 2, Ludhiana, Punjab 141003', jewellery: '4th Floor, 18 Zaveri Bazaar, Mumbai, Maharashtra 400002' }, blank: 'A new company is refused; an existing one keeps its address.', rejects: [['Blank on a new company', MSG.companyAddress]] },
  { sheet: 'companies', key: 'country', kits: BOTH, importable: true, required: 'no', purpose: 'The company’s country.', format: '2-letter code.', example: { fashion: 'IN', jewellery: 'IN' }, blank: 'IN.', rejects: [['Not two letters', MSG.companyCountry]] },
  { sheet: 'companies', key: 'phone', kits: BOTH, importable: true, required: 'no', purpose: 'Consumer-care phone, when the label prints one.', format: 'As printed, up to 40 characters.', example: { fashion: '+91 161 400 0000', jewellery: '+91 22 4000 0000' }, blank: 'Not shown.', rejects: [['Over 40 characters', MSG.phone]] },
  { sheet: 'companies', key: 'email', kits: BOTH, importable: true, required: 'no', purpose: 'Consumer-care email.', format: 'name@domain.', example: { fashion: 'care@example.com', jewellery: 'care@example.org' }, blank: 'Not shown.', rejects: [['Not an email address', MSG.email]] },
  { sheet: 'companies', key: 'gstin', kits: BOTH, importable: true, required: 'no', purpose: 'GSTIN.', format: '15 characters: 2-digit state code, PAN, entity number, Z, check character.', example: { fashion: '03ABCDE1234F1Z5', jewellery: '27ABCDE1234F1Z5' }, blank: 'Not recorded.', rejects: [['Not a GSTIN shape', MSG.gstin]] },
];

export const columnsFor = (sheet, kit) => COLUMNS.filter((c) => c.sheet === sheet && c.kits.includes(kit));
export const sheetsFor = (kit) => (kit === 'jewellery' ? ['products', 'variants', 'stones'] : ['products', 'variants']);

// ---------- the example rows: three products per kit ----------
// Slugs start "example-": the validator refuses them, so an example left in a
// real file is caught before import. Prices and weights are illustrative.
export const EXAMPLES = {
  fashion: {
    products: [
      { slug: 'example-canvas-tote-natural', name: 'Canvas Tote — Natural', brand: 'Celeste & Co.', category: 'bags-accessories', description: 'A roomy everyday tote in heavy cotton canvas with long handles and an inner pocket.', mrp: '1499', sale_price: '1199', sku: 'CEL-BG-0031', net_content: '1 N', hsn_code: '4202', gst_rate: '', stock: '', is_new: 'yes', is_bestseller: 'no', sort_order: '10', country_of_origin: 'IN', generic_name: 'Tote bag', manufacturer: 'Example Textiles Pvt Ltd', material: '100% cotton', care: 'Spot clean; do not bleach; dry in shade', fit: '' },
      { slug: 'example-linen-shirt', name: 'Camp Collar Linen Shirt', brand: 'Celeste & Co.', category: 'clothing/men/mens-shirts', description: 'A relaxed shirt in washed linen with a camp collar and a chest pocket.', mrp: '2499', sale_price: '1999', sku: 'CEL-SH-0147', net_content: '1 N', hsn_code: '6205', gst_rate: '', stock: '', is_new: 'no', is_bestseller: 'no', sort_order: '20', country_of_origin: 'IN', generic_name: 'Shirt', manufacturer: 'Example Textiles Pvt Ltd', material: '100% linen', care: 'Machine wash cold; do not bleach; dry in shade; warm iron', fit: 'Relaxed' },
      { slug: 'example-cable-knit-cardigan', name: 'Cable Knit Cardigan', brand: 'Celeste & Co.', category: 'clothing/women', description: 'A mid-weight cardigan with a cable front and horn-look buttons.', mrp: '3299', sale_price: '', sku: 'CEL-KN-0208', net_content: '1 N', hsn_code: '6110', gst_rate: '', stock: '', is_new: 'no', is_bestseller: 'no', sort_order: '30', country_of_origin: 'IN', generic_name: 'Cardigan', manufacturer: 'Example Textiles Pvt Ltd', material: '70% acrylic, 30% wool', care: 'Hand wash cold; dry flat; do not tumble dry', fit: 'Regular' },
    ],
    variants: [
      { product_slug: 'example-canvas-tote-natural', size: 'One size', colour: 'Natural', colour_hex: '#E8DCC4', sku: 'CEL-BG-0031-NT', stock: '25', price_override: '', is_active: 'yes', sort_order: '0' },
      ...['S', 'M', 'L', 'XL'].flatMap((size, i) => [['White', '#F4F2EC'], ['Sage', '#8FA58A']].map(([colour, hex], j) => ({
        product_slug: 'example-linen-shirt', size, colour, colour_hex: hex, sku: `CEL-SH-0147-${colour.slice(0, 2).toUpperCase()}-${size}`,
        stock: String([8, 12, 10, 4][i] + j * 2), price_override: size === 'XL' ? '2199' : '', is_active: 'yes', sort_order: String(i * 2 + j),
      }))),
      ...['S', 'M', 'L'].map((size, i) => ({ product_slug: 'example-cable-knit-cardigan', size, colour: 'Cream', colour_hex: '#EFE6D2', sku: `CEL-KN-0208-CR-${size}`, stock: '0', price_override: '', is_active: 'yes', sort_order: String(i) })),
    ],
  },
  jewellery: {
    products: [
      { slug: 'example-solitaire-pendant-18k', name: 'Solitaire Pendant — 18K Yellow Gold', brand: 'Aurum Atelier', category: 'jewellery/necklaces', description: 'A single round stone in a four-claw setting on a fine cable chain, 18 inches.', mrp: '42999', sale_price: '38999', sku: 'AA-PD-18K-003', net_content: '1 N', hsn_code: '7113', gst_rate: '3', stock: '', is_new: 'yes', is_bestseller: 'no', sort_order: '10', country_of_origin: 'IN', generic_name: 'Pendant necklace', manufacturer: 'Example Jewellers LLP', metal: 'gold', purity: '750', making_charge_type: 'percent', making_charge_value: '12', pricing_mode: 'fixed' },
      { slug: 'example-classic-band-ring-22k', name: 'Classic Band Ring — 22K', brand: 'Aurum Atelier', category: 'jewellery/rings', description: 'A plain, comfortable band with a softly rounded edge.', mrp: '28999', sale_price: '26999', sku: 'AA-RG-22K-014', net_content: '1 N', hsn_code: '7113', gst_rate: '3', stock: '', is_new: 'no', is_bestseller: 'no', sort_order: '20', country_of_origin: 'IN', generic_name: 'Ring', manufacturer: 'Example Jewellers LLP', metal: 'gold', purity: '916', making_charge_type: 'per_gram', making_charge_value: '450', pricing_mode: 'fixed' },
      { slug: 'example-drop-earrings-silver', name: 'Drop Earrings — Sterling Silver', brand: 'Aurum Atelier', category: 'jewellery/earrings', description: 'Slim drops with a small round stone, on hooks.', mrp: '3499', sale_price: '', sku: 'AA-ER-925-021', net_content: '1 pair', hsn_code: '7113', gst_rate: '3', stock: '', is_new: 'no', is_bestseller: 'no', sort_order: '30', country_of_origin: 'IN', generic_name: 'Earrings', manufacturer: 'Example Jewellers LLP', metal: 'silver', purity: '925', making_charge_type: 'flat', making_charge_value: '400', pricing_mode: 'fixed' },
    ],
    variants: [
      { product_slug: 'example-solitaire-pendant-18k', size: 'One size', colour: 'Yellow gold', colour_hex: '#D4AF37', sku: 'AA-PD-18K-003-YG', stock: '3', price_override: '', is_active: 'yes', sort_order: '0', gross_weight_g: '2.150', net_metal_weight_g: '2.100' },
      ...['10', '12', '14', '16'].flatMap((size, i) => [['Yellow gold', '#D4AF37', 'YG'], ['Rose gold', '#B76E79', 'RG']].map(([colour, hex, code], j) => ({
        product_slug: 'example-classic-band-ring-22k', size, colour, colour_hex: hex, sku: `AA-RG-22K-014-${code}-${size}`, stock: String(2 + ((i + j) % 2)),
        price_override: ['', '27499', '27999', '28499'][i], is_active: 'yes', sort_order: String(i * 2 + j),
        gross_weight_g: ['3.100', '3.250', '3.400', '3.550'][i], net_metal_weight_g: ['3.100', '3.250', '3.400', '3.550'][i],
      }))),
      { product_slug: 'example-drop-earrings-silver', size: 'One size', colour: 'Silver', colour_hex: '#C0C0C0', sku: 'AA-ER-925-021-SV', stock: '0', price_override: '', is_active: 'yes', sort_order: '0', gross_weight_g: '6.200', net_metal_weight_g: '5.900' },
    ],
    stones: [
      { product_slug: 'example-solitaire-pendant-18k', stone: 'diamond', origin: 'lab_grown', shape: 'round', stone_count: '1', total_carat: '0.250', total_weight_g: '', clarity: 'VS1', colour_grade: 'F', certificate_lab: 'IGI', certificate_no: 'LG000000000', sort_order: '1' },
      { product_slug: 'example-drop-earrings-silver', stone: 'cubic zirconia', origin: 'simulant', shape: 'round', stone_count: '2', total_carat: '', total_weight_g: '', clarity: '', colour_grade: '', certificate_lab: '', certificate_no: '', sort_order: '1' },
    ],
  },
  companies: [
    { name: 'Example Textiles Pvt Ltd', address: 'Plot 12, Industrial Area Phase 2, Ludhiana, Punjab 141003', country: 'IN', phone: '+91 161 400 0000', email: 'care@example.com', gstin: '03ABCDE1234F1Z5' },
    { name: 'Example Jewellers LLP', address: '4th Floor, 18 Zaveri Bazaar, Mumbai, Maharashtra 400002', country: 'IN', phone: '+91 22 4000 0000', email: 'care@example.org', gstin: '27ABCDE1234F1Z5' },
  ],
};
