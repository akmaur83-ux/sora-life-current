# Catalogue loading kit — field guide

_Generated from `scripts/catalogue-kit/spec.mjs` by `node scripts/catalogue-kit/kit.mjs build`. Edit the spec, not this file._

Two kits, both loaded into the **fashion** store: **fashion** and **jewellery** (jewellery is the fashion store’s Jewellery category).
Each kit has a products sheet and a variants sheet; jewellery adds a stones sheet; both share one companies sheet.

## How the import reads every sheet
- **A blank cell means “leave it alone”**, never “clear it”. On a new row a blank takes the default stated below.
- **Fill-only by default**: a cell fills an empty field; a field that already has a value is kept unless you tick **Overwrite existing values**.
- **New products arrive as drafts.** There is no is_active column for products: you publish each one in the editor once it has an image and an active size/colour.
- A row with any problem is skipped whole, with its reason — never half-applied.
- **Import in this order: companies, products, variants, then stones** (products name their companies; variants and stones name their product by slug): Store catalogue → Fashion → Bulk import (CSV) → Companies, Products, Sizes & colours (variants), Stones (jewellery).
- Every fashion and jewellery product needs **at least one size/colour row** to be published or bought. A product with “no variants” is one row with size **One size**.
- Run the validator on a filled kit before importing: `node scripts/catalogue-kit/kit.mjs validate --kit fashion --products … --variants …`.

## products.csv

One row per product (per design and purity for jewellery).

Used by: Fashion, Jewellery.

### `id`
- **For:** Updates an existing product instead of creating one. Copy it from the admin export.
- **Kits:** Fashion, Jewellery · **Optional**
- **Format:** The product’s id exactly as the export shows it.
- **Example:** _(leave blank)_
- **If blank:** The row is matched on its slug; a slug no product has creates a new draft (when “Create new products” is ticked).
- **Refused, and the message you see:**
  - An id no product in this store has → “No product in this store has this id.”

### `slug`
- **For:** The product’s address (/fashion/p/<slug>) and the name its images are filed under (<slug>-1.webp).
- **Kits:** Fashion, Jewellery · **Required for a new row**
- **Format:** Lowercase letters, numbers and single hyphens; unique within the fashion store. For jewellery, put the purity in it so 18K and 22K listings differ.
- **Example:** `meadow-linen-shirt-sage` (fashion) · `classic-band-ring-22k` (jewellery)
- **If blank:** For a new product the row is skipped; for an existing product (matched by id) the slug is kept.
- **Refused, and the message you see:**
  - Capitals, spaces or other characters → “Use lowercase letters, numbers and single hyphens in the slug.”
  - A slug another product has or would have → “Another product would have the slug "…".”
  - No slug and no id → “A row needs a slug (or the id of an existing product).”
  - The same product twice in the file → “This product appears more than once in the file (lines …).”

### `name`
- **For:** The product name customers read on cards and the product page.
- **Kits:** Fashion, Jewellery · **Required for a new row**
- **Format:** Plain text. Checked for speed, sustainability and medical claims.
- **Example:** `Meadow Linen Shirt — Sage` (fashion) · `Classic Band Ring — 22K Yellow Gold` (jewellery)
- **If blank:** A new product is refused; an existing product keeps its name.
- **Refused, and the message you see:**
  - Blank on a new product → “Enter a product name.”

### `brand`
- **For:** Shown above the name on the product page and in Details.
- **Kits:** Fashion, Jewellery · **Optional**
- **Format:** Plain text.
- **Example:** `Celeste & Co.` (fashion) · `Aurum Atelier` (jewellery)
- **If blank:** No brand is shown.

### `category`
- **For:** Where the product is filed and listed.
- **Kits:** Fashion, Jewellery · **Required for a new row**
- **Format:** The category path by slugs, exactly as the admin export writes it (e.g. clothing/men/mens-shirts). The labels with " / " are accepted too. Jewellery must sit under jewellery/.
- **Example:** `clothing/men/mens-shirts` (fashion) · `jewellery/rings` (jewellery)
- **If blank:** A new product is refused; an existing product keeps its category.
- **Refused, and the message you see:**
  - A path that is not a category in the store → “Category "…" is not a Fashion category — use the path from the export, e.g. "…".”
  - Blank on a new product → “Choose a category in this store.”

### `description`
- **For:** “About this style” on the product page.
- **Kits:** Fashion, Jewellery · **Optional**
- **Format:** Plain text, shown as ONE paragraph (line breaks are not kept). No HTML. Checked for speed, sustainability and medical claims.
- **Example:** `A relaxed shirt in washed linen with a camp collar and a chest pocket.` (fashion) · `A plain, comfortable band with a softly rounded edge.` (jewellery)
- **If blank:** No “About this style” section is shown.

### `mrp`
- **For:** Maximum retail price, inclusive of all taxes. Shown struck through when there is a selling price.
- **Kits:** Fashion, Jewellery · **Required for a new row**
- **Format:** A number in rupees: 2499 or 2,499 or ₹2,499.00. At least 0.01. Nothing may sell above it (the validator checks every size’s price).
- **Example:** `2499` (fashion) · `28999` (jewellery)
- **If blank:** A new product is refused; an existing product keeps its MRP.
- **Refused, and the message you see:**
  - Blank, zero or not a number → “Enter an MRP of at least ₹0.01.”

### `sale_price`
- **For:** The price the product sells at, when below the MRP. The discount badge is worked out from the two.
- **Kits:** Fashion, Jewellery · **Optional**
- **Format:** A number in rupees, at most the MRP.
- **Example:** `1999` (fashion) · `26999` (jewellery)
- **If blank:** The product sells at its MRP (no discount shown).
- **Refused, and the message you see:**
  - More than the MRP → “Selling price cannot be more than the MRP (₹…).”
  - Zero or not a number → “Selling price must be at least ₹0.01, or blank to sell at MRP.”

### `sku`
- **For:** Your code for the product (style code). Orders carry the variant SKU, not this one.
- **Kits:** Fashion, Jewellery · **Optional**
- **Format:** Letters, numbers, dots, slashes, hyphens, underscores; up to 64; unique within the store.
- **Example:** `CEL-SH-0147` (fashion) · `AA-RG-22K-014` (jewellery)
- **If blank:** No product SKU.
- **Refused, and the message you see:**
  - Other characters, or over 64 → “SKU must be 1–64 letters, numbers, dots, slashes, hyphens or underscores, starting with a letter or number.”
  - A SKU another product has → “Another product would have the SKU "…".”

### `net_content`
- **For:** Net quantity — the Legal Metrology declaration (number of pieces in the pack). Shown under Product information on the product page.
- **Kits:** Fashion, Jewellery · **Expected before it goes live (the validator warns; nothing blocks)**
- **Format:** Plain text with the count: "1 N", "1 pair", "Set of 2".
- **Example:** `1 N` (fashion) · `1 N` (jewellery)
- **If blank:** Nothing recorded (the validator warns: expected before going live).

### `hsn_code`
- **For:** The HSN code for GST invoicing.
- **Kits:** Fashion, Jewellery · **Expected before it goes live (the validator warns; nothing blocks)**
- **Format:** 4, 6 or 8 digits; spaces and dots are dropped ("6205.20" becomes 620520). Keep it as text in a spreadsheet so a leading 0 is not lost.
- **Example:** `6205` (fashion) · `7113` (jewellery)
- **If blank:** Nothing recorded (the validator warns).
- **Refused, and the message you see:**
  - 3, 5, 7 or 9+ digits, or letters → “HSN code must be 4, 6 or 8 digits.”

### `gst_rate`
- **For:** The GST rate, recorded for the audit — checkout does not charge it yet.
- **Kits:** Fashion, Jewellery · **Optional**
- **Format:** A percentage from 0 to 100, without the % sign. Confirm each rate with your CA: apparel rates depend on the selling price.
- **Example:** `3` (jewellery)
- **If blank:** Not recorded.
- **Refused, and the message you see:**
  - Below 0, above 100, or not a number → “GST rate must be a number from 0 to 100, or blank.”

### `stock`
- **For:** Product-level stock. NOT USED for fashion or jewellery: stock is per variant. Leave blank.
- **Kits:** Fashion, Jewellery · **Optional**
- **Format:** A whole number, 0 or more.
- **Example:** _(leave blank)_
- **If blank:** A new product gets 0 (unused).
- **Refused, and the message you see:**
  - Negative or not a whole number → “Stock must be a whole number, 0 or more.”

### `is_new`
- **For:** Shows the “New” badge when the product has no discount.
- **Kits:** Fashion, Jewellery · **Optional**
- **Format:** yes or no.
- **Example:** `yes` (fashion) · `no` (jewellery)
- **If blank:** No (for a new product); unchanged for an existing one.
- **Refused, and the message you see:**
  - Anything but yes/no/true/false/1/0 → “…: use yes or no.”

### `is_bestseller`
- **For:** Marks a real sales leader. Leave no until sales show it — it is a claim.
- **Kits:** Fashion, Jewellery · **Optional**
- **Format:** yes or no.
- **Example:** `no` (fashion) · `no` (jewellery)
- **If blank:** No.
- **Refused, and the message you see:**
  - Anything but yes/no/true/false/1/0 → “…: use yes or no.”

### `sort_order`
- **For:** Display order inside listings; lower comes first.
- **Kits:** Fashion, Jewellery · **Optional**
- **Format:** A whole number (may be negative).
- **Example:** `10` (fashion) · `10` (jewellery)
- **If blank:** 0.
- **Refused, and the message you see:**
  - Not a whole number → “Display order must be a whole number.”

### `country_of_origin`
- **For:** Country of origin — a declaration every listing carries. Shown under Product information on the product page.
- **Kits:** Fashion, Jewellery · **Expected before it goes live (the validator warns; nothing blocks)**
- **Format:** The 2-letter country code: IN, CN, BD, LK, VN, TR, IT… Lower case is read as upper case.
- **Example:** `IN` (fashion) · `IN` (jewellery)
- **If blank:** Not recorded (the validator and the editor warn).
- **Refused, and the message you see:**
  - Anything but two letters → “Country of origin must be a 2-letter code such as IN.”

### `generic_name`
- **For:** The common name of the item, when the product name is a style name ("Meadow" is a shirt).
- **Kits:** Fashion, Jewellery · **Optional**
- **Format:** Plain text, up to 120 characters.
- **Example:** `Shirt` (fashion) · `Ring` (jewellery)
- **If blank:** The product name serves.
- **Refused, and the message you see:**
  - Over 120 characters → “Generic name: keep it under 120 characters.”

### `manufacturer`
- **For:** Manufactured by — the name and address printed on the product page come from the Companies list.
- **Kits:** Fashion, Jewellery · **Expected before it goes live (the validator warns; nothing blocks)**
- **Format:** The company’s name exactly as in the Companies list (companies.csv); capitals aside.
- **Example:** `Example Textiles Pvt Ltd` (fashion) · `Example Jewellers LLP` (jewellery)
- **If blank:** Not recorded (the validator and the editor warn).
- **Refused, and the message you see:**
  - A name not in the Companies list → “Manufacturer “…” is not in the Companies list — add it on the Companies tab (or import the companies file) first.”

### `packer`
- **For:** Packed by, when a different company packs it.
- **Kits:** Fashion, Jewellery · **Optional**
- **Format:** A name from the Companies list.
- **Example:** _(leave blank)_
- **If blank:** Not shown.
- **Refused, and the message you see:**
  - A name not in the Companies list → “Packer “…” is not in the Companies list — add it on the Companies tab (or import the companies file) first.”

### `importer`
- **For:** Imported by — expected whenever the country of origin is not IN.
- **Kits:** Fashion, Jewellery · **Expected before it goes live (the validator warns; nothing blocks)**
- **Format:** A name from the Companies list.
- **Example:** _(leave blank)_
- **If blank:** Not shown (the validator and the editor warn when the product is made outside India).
- **Refused, and the message you see:**
  - A name not in the Companies list → “Importer “…” is not in the Companies list — add it on the Companies tab (or import the companies file) first.”

### `material`
- **For:** Fabric composition.
- **Kits:** Fashion · **Expected before it goes live (the validator warns; nothing blocks)**
- **Format:** Percentages that add up to 100, comma-separated: "100% linen", "60% cotton, 40% polyester". Up to 300 characters.
- **Example:** `100% linen`
- **If blank:** Not recorded (the validator and the editor warn).
- **Refused, and the message you see:**
  - Percentages that do not add up to 100 → “Material percentages add up to …%, not 100%.”
  - Over 300 characters → “Material: keep it under 300 characters.”

### `care`
- **For:** Care instructions.
- **Kits:** Fashion · **Expected before it goes live (the validator warns; nothing blocks)**
- **Format:** Plain text, semicolons between instructions; up to 1000 characters.
- **Example:** `Machine wash cold; do not bleach; dry in shade; warm iron`
- **If blank:** Not recorded (the validator and the editor warn).
- **Refused, and the message you see:**
  - Over 1000 characters → “Care instructions: keep it under 1000 characters.”

### `fit`
- **For:** How it fits.
- **Kits:** Fashion · **Optional**
- **Format:** One of: Regular, Slim, Relaxed, Oversized, Straight, Skinny, Loose, Tailored (capitals aside).
- **Example:** `Relaxed`
- **If blank:** Not shown.
- **Refused, and the message you see:**
  - A word outside the list → “Fit must be one of Regular, Slim, Relaxed, Oversized, Straight, Skinny, Loose, Tailored.”

### `metal`
- **For:** The metal the piece is made of.
- **Kits:** Jewellery · **Expected before it goes live (the validator warns; nothing blocks)**
- **Format:** One of: gold, silver, platinum, gold_plated, silver_plated, brass, stainless_steel, other.
- **Example:** `gold`
- **If blank:** Not recorded (the validator and the editor warn).
- **Refused, and the message you see:**
  - A value outside the list → “Metal must be one of gold, silver, platinum, gold_plated, silver_plated, brass, stainless_steel, other.”

### `purity`
- **For:** Purity as fineness — one purity per listing (18K and 22K are separate listings).
- **Kits:** Jewellery · **Expected before it goes live (the validator warns; nothing blocks)**
- **Format:** Fineness in parts per thousand. Gold: 375 (9K), 585 (14K), 750 (18K), 833 (20K), 916 (22K), 958 (23K), 995 or 999 (24K). Silver: 925 (sterling), 999 and the other BIS grades. Platinum: 850, 900, 950. Only for gold, silver and platinum.
- **Example:** `916`
- **If blank:** Not recorded (the validator and the editor warn for gold, silver and platinum).
- **Refused, and the message you see:**
  - Not a whole number from 1 to 999 → “Purity is the fineness, a whole number such as 916 (22K) or 925 (sterling).”
  - Not a grade of the metal → “… is not a … grade. Use …”
  - Set on a plated or base metal → “Purity is only for gold, silver and platinum, not …”

### `making_charge_type`
- **For:** How making charges are expressed, recorded with the listing. The selling price is still what customers pay.
- **Kits:** Jewellery · **Optional**
- **Format:** per_gram, percent or flat. Set together with making_charge_value.
- **Example:** `per_gram`
- **If blank:** No making charges recorded (leave both blank).
- **Refused, and the message you see:**
  - A value outside the list → “Making charge type must be one of per_gram, percent, flat.”
  - Only one of type and value → “Making charges need both a type and a value.”

### `making_charge_value`
- **For:** Making charges: rupees per gram, a percentage, or a flat amount per piece.
- **Kits:** Jewellery · **Optional**
- **Format:** A number, 0 or more; a percent is at most 100.
- **Example:** `450`
- **If blank:** Leave blank with the type.
- **Refused, and the message you see:**
  - Negative or not a number → “Making charges must be a number, 0 or more.”
  - A percent over 100 → “A making charge percentage cannot be over 100.”

### `pricing_mode`
- **For:** fixed: the price in this sheet. rate_linked: priced from the day’s metal rate — recorded only; such a product saves as a draft and cannot go live until the rate engine exists.
- **Kits:** Jewellery · **Optional**
- **Format:** fixed or rate_linked.
- **Example:** `fixed`
- **If blank:** fixed.
- **Refused, and the message you see:**
  - Anything else → “Pricing must be one of fixed, rate_linked.”
  - rate_linked on a product being published (in the editor) → “A rate-linked product cannot go live yet: its price needs the metal-rate engine. Keep it as a draft, or set the pricing to fixed.”

## variants.csv

One row per size × colour of a product. Every fashion and jewellery product needs at least one: a product without an active variant cannot be published or bought.

Used by: Fashion, Jewellery.

### `product_slug`
- **For:** Which product this size/colour belongs to. Import the products file first.
- **Kits:** Fashion, Jewellery · **Required for a new row**
- **Format:** The product’s slug.
- **Example:** `meadow-linen-shirt-sage` (fashion) · `classic-band-ring-22k` (jewellery)
- **If blank:** The row is skipped.
- **Refused, and the message you see:**
  - A slug no product has (yet) → “No Fashion product has the slug "…".”

### `size`
- **For:** The size customers choose. Use “One size” when there is only one.
- **Kits:** Fashion, Jewellery · **Required for a new row**
- **Format:** Plain text: S, M, L, 32, UK 8, ring size 14, One size.
- **Example:** `M` (fashion) · `14` (jewellery)
- **If blank:** The row is skipped.
- **Refused, and the message you see:**
  - Blank → “A row needs a size.”
  - The same size and colour twice in the file → “This variant appears more than once in the file (lines …).”

### `colour`
- **For:** The colour customers choose; for jewellery, the metal colour.
- **Kits:** Fashion, Jewellery · **Required for a new row**
- **Format:** Plain text: Sage, White, Yellow gold, Rose gold.
- **Example:** `Sage` (fashion) · `Yellow gold` (jewellery)
- **If blank:** A fashion variant is refused.
- **Refused, and the message you see:**
  - Blank → “Enter a colour. Use “Default” for a single option.”

### `colour_hex`
- **For:** The swatch colour.
- **Kits:** Fashion, Jewellery · **Optional**
- **Format:** #RRGGBB.
- **Example:** `#8FA58A` (fashion) · `#D4AF37` (jewellery)
- **If blank:** A neutral beige swatch.
- **Refused, and the message you see:**
  - Anything but #RRGGBB → “Colour hex must look like #123ABC.”

### `sku`
- **For:** The code orders and packing slips carry for this exact size and colour.
- **Kits:** Fashion, Jewellery · **Optional**
- **Format:** As the product SKU; unique across EVERY store (fashion, Home & Living, grocery).
- **Example:** `CEL-SH-0147-SG-M` (fashion) · `AA-RG-22K-014-YG-14` (jewellery)
- **If blank:** No variant SKU.
- **Refused, and the message you see:**
  - A SKU another variant has → “Another variant already has the SKU "…". Variant SKUs are unique across every store.”
  - Other characters, or over 64 → “SKU must be 1–64 letters, numbers, dots, slashes, hyphens or underscores, starting with a letter or number.”

### `stock`
- **For:** Units available for this size and colour. 0 lists it as sold out.
- **Kits:** Fashion, Jewellery · **Required for a new row**
- **Format:** A whole number, 0 or more.
- **Example:** `12` (fashion) · `2` (jewellery)
- **If blank:** A new variant is refused; an existing one keeps its stock.
- **Refused, and the message you see:**
  - Blank on a new variant, negative or not whole → “Stock must be a whole number, 0 or more.”

### `price_override`
- **For:** This size’s own selling price, when sizes are priced differently.
- **Kits:** Fashion, Jewellery · **Optional**
- **Format:** A number in rupees, never above the product’s MRP.
- **Example:** `2199` (fashion) · `28499` (jewellery)
- **If blank:** The product’s selling price (or MRP).
- **Refused, and the message you see:**
  - Zero or not a number → “Price override must be at least ₹0.01, or blank to use the product price.”
  - Above the product’s MRP (the import does not check this; the validator does) → “Price override ₹… is above the MRP ₹…: nothing may sell above its MRP.”

### `is_active`
- **For:** Whether customers can choose this size/colour.
- **Kits:** Fashion, Jewellery · **Optional**
- **Format:** yes or no.
- **Example:** `yes` (fashion) · `yes` (jewellery)
- **If blank:** Yes for a new variant.
- **Refused, and the message you see:**
  - Anything but yes/no → “…: use yes or no.”

### `sort_order`
- **For:** The order sizes and colours are offered in; lower first.
- **Kits:** Fashion, Jewellery · **Optional**
- **Format:** A whole number.
- **Example:** `2` (fashion) · `3` (jewellery)
- **If blank:** Its position in the file.
- **Refused, and the message you see:**
  - Not a whole number → “Display order must be a whole number.”

### `gross_weight_g`
- **For:** Gross weight of the piece in grams (metal + stones). A ring’s changes with its size.
- **Kits:** Jewellery · **Expected before it goes live (the validator warns; nothing blocks)**
- **Format:** Grams, up to 3 decimals: 3.250.
- **Example:** `3.250`
- **If blank:** Not recorded (the validator and the editor warn).
- **Refused, and the message you see:**
  - Zero, negative or not a number → “Gross weight must be grams above 0, e.g. 3.250.”

### `net_metal_weight_g`
- **For:** Net weight of the metal alone in grams.
- **Kits:** Jewellery · **Expected before it goes live (the validator warns; nothing blocks)**
- **Format:** Grams, up to 3 decimals; at most the gross weight.
- **Example:** `3.250`
- **If blank:** Not recorded (the validator and the editor warn).
- **Refused, and the message you see:**
  - Zero, negative or not a number → “Net metal weight must be grams above 0, e.g. 3.250.”
  - More than the gross weight → “Net metal weight … g cannot be more than the gross weight … g.”

## stones.csv

Jewellery only. One row per kind of stone in a piece (a ring with diamonds and a ruby has two rows).

Used by: Jewellery.

### `product_slug`
- **For:** The product the stones are set in. Import the products file first.
- **Kits:** Jewellery · **Required for a new row**
- **Format:** The product’s slug.
- **Example:** `solitaire-pendant-18k`
- **If blank:** The row is skipped.
- **Refused, and the message you see:**
  - A slug no product has (yet) → “No Fashion product has the slug "…".”

### `stone`
- **For:** The stone. With the slug and the shape, it is how a row finds the stone already on the product.
- **Kits:** Jewellery · **Required for a new row**
- **Format:** Plain text, up to 60 characters: diamond, ruby, emerald, pearl, cubic zirconia.
- **Example:** `diamond`
- **If blank:** The row is skipped.
- **Refused, and the message you see:**
  - Blank → “A row needs the stone.”
  - Over 60 characters → “Keep the stone’s name under 60 characters.”
  - A stone the product does not have, without “Create new” → “This product has no such stone. Tick "Create new" to add it.”
  - The same stone and shape twice in the file → “This stone appears more than once in the file (lines …).”

### `origin`
- **For:** Natural, lab-grown, or a simulant (cubic zirconia, glass) — disclosed on the product page.
- **Kits:** Jewellery · **Required for a new row**
- **Format:** natural, lab_grown, simulant.
- **Example:** `lab_grown`
- **If blank:** A new stone is refused; an existing one keeps its origin.
- **Refused, and the message you see:**
  - Anything else → “Origin must be natural, lab_grown or simulant: say which.”

### `shape`
- **For:** Cut shape. Part of how a row is matched (two diamond rows of different shapes are two stones).
- **Kits:** Jewellery · **Optional**
- **Format:** round, oval, pear, princess, emerald, marquise…
- **Example:** `round`
- **If blank:** Not shown.

### `stone_count`
- **For:** How many of these stones.
- **Kits:** Jewellery · **Required for a new row**
- **Format:** A whole number, 1 or more.
- **Example:** `1`
- **If blank:** A new stone is refused; an existing one keeps its count.
- **Refused, and the message you see:**
  - 0 or not whole → “Stone count must be a whole number, 1 or more.”

### `total_carat`
- **For:** Total carat weight of these stones together.
- **Kits:** Jewellery · **Optional**
- **Format:** Carats, up to 3 decimals: 0.250.
- **Example:** `0.250`
- **If blank:** Not shown.
- **Refused, and the message you see:**
  - 0, negative or not a number → “Total carat must be more than 0.”

### `total_weight_g`
- **For:** Total weight in grams, for stones sold by gram weight.
- **Kits:** Jewellery · **Optional**
- **Format:** Grams, up to 3 decimals.
- **Example:** _(leave blank)_
- **If blank:** Not shown.
- **Refused, and the message you see:**
  - 0, negative or not a number → “Total weight must be grams above 0, e.g. 3.250.”

### `clarity`
- **For:** Clarity grade.
- **Kits:** Jewellery · **Optional**
- **Format:** VVS1, VS1, SI1… Up to 20 characters.
- **Example:** `VS1`
- **If blank:** Not shown.

### `colour_grade`
- **For:** Colour grade.
- **Kits:** Jewellery · **Optional**
- **Format:** D–Z for diamonds. Up to 20 characters.
- **Example:** `F`
- **If blank:** Not shown.

### `certificate_lab`
- **For:** The grading lab.
- **Kits:** Jewellery · **Optional**
- **Format:** IGI, GIA, SGL… Set together with certificate_no.
- **Example:** `IGI`
- **If blank:** No certificate (leave both blank).
- **Refused, and the message you see:**
  - Only one of lab and number → “A certificate needs both its lab and its number.”

### `certificate_no`
- **For:** The certificate number.
- **Kits:** Jewellery · **Optional**
- **Format:** As printed on the certificate.
- **Example:** `LG000000000`
- **If blank:** Leave blank with the lab.

### `sort_order`
- **For:** Order stones are listed in.
- **Kits:** Jewellery · **Optional**
- **Format:** A whole number.
- **Example:** `1`
- **If blank:** After the stones already on the product.
- **Refused, and the message you see:**
  - Not a whole number → “Display order must be a whole number.”

## companies.csv

One row per company a listing names as manufacturer, packer or importer. Shared by fashion and jewellery.

Used by: Fashion, Jewellery.

### `name`
- **For:** The company’s legal name; products name it in manufacturer / packer / importer. One list serves every store.
- **Kits:** Fashion, Jewellery · **Required for a new row**
- **Format:** Plain text, up to 160 characters, each company once. A name already in the list (capitals aside) updates that company.
- **Example:** `Example Textiles Pvt Ltd` (fashion) · `Example Jewellers LLP` (jewellery)
- **If blank:** The row is skipped.
- **Refused, and the message you see:**
  - Blank → “A row needs the company’s name.”
  - The same name twice in the file → “This company appears more than once in the file (lines …).”

### `address`
- **For:** The address as it is printed on the label, and on the product page.
- **Kits:** Fashion, Jewellery · **Required for a new row**
- **Format:** One line: street, city, state, PIN. Up to 400 characters.
- **Example:** `Plot 12, Industrial Area Phase 2, Ludhiana, Punjab 141003` (fashion) · `4th Floor, 18 Zaveri Bazaar, Mumbai, Maharashtra 400002` (jewellery)
- **If blank:** A new company is refused; an existing one keeps its address.
- **Refused, and the message you see:**
  - Blank on a new company → “Enter the address as it is printed on the label.”

### `country`
- **For:** The company’s country.
- **Kits:** Fashion, Jewellery · **Optional**
- **Format:** 2-letter code.
- **Example:** `IN` (fashion) · `IN` (jewellery)
- **If blank:** IN.
- **Refused, and the message you see:**
  - Not two letters → “Country must be a 2-letter code such as IN.”

### `phone`
- **For:** Consumer-care phone, when the label prints one.
- **Kits:** Fashion, Jewellery · **Optional**
- **Format:** As printed, up to 40 characters.
- **Example:** `+91 161 400 0000` (fashion) · `+91 22 4000 0000` (jewellery)
- **If blank:** Not shown.
- **Refused, and the message you see:**
  - Over 40 characters → “Keep the phone under 40 characters.”

### `email`
- **For:** Consumer-care email.
- **Kits:** Fashion, Jewellery · **Optional**
- **Format:** name@domain.
- **Example:** `care@example.com` (fashion) · `care@example.org` (jewellery)
- **If blank:** Not shown.
- **Refused, and the message you see:**
  - Not an email address → “Enter an email address like name@domain.com.”

### `gstin`
- **For:** GSTIN.
- **Kits:** Fashion, Jewellery · **Optional**
- **Format:** 15 characters: 2-digit state code, PAN, entity number, Z, check character.
- **Example:** `03ABCDE1234F1Z5` (fashion) · `27ABCDE1234F1Z5` (jewellery)
- **If blank:** Not recorded.
- **Refused, and the message you see:**
  - Not a GSTIN shape → “GSTIN must be 15 characters like 27ABCDE1234F1Z5.”

## Purity grades (jewellery `purity`)

| Metal | Fineness → grade |
|---|---|
| gold | 375 → 9K, 585 → 14K, 750 → 18K, 833 → 20K, 916 → 22K, 958 → 23K, 995 → 24K, 999 → 24K |
| silver | 800 → 800, 835 → 835, 900 → 900, 925 → Sterling (925), 970 → 970, 990 → 990, 999 → Fine (999) |
| platinum | 850 → 850, 900 → 900, 950 → 950 |

## The example rows

Each template holds three example products (slugs start `example-`; the validator refuses them, so delete them before importing):

| Kit | No variants (one “One size” row) | Sizes × colours, priced per size | Out of stock, draft |
|---|---|---|---|
| Fashion | `example-canvas-tote-natural` | `example-linen-shirt` | `example-cable-knit-cardigan` |
| Jewellery | `example-solitaire-pendant-18k` | `example-classic-band-ring-22k` | `example-drop-earrings-silver` |

“Draft” is not a column: every product the import creates is a draft. The third example is out of stock because every size has stock 0.

## Images

- **Name:** `<product slug>-<number>.<webp|jpg|jpeg|png>`, e.g. `example-linen-shirt-1.webp`, `example-linen-shirt-2.jpg`. Upper or lower case both match; the number is 1–4 digits.
- **Order:** by the number (2 before 10). Number 1 becomes the main image of an empty gallery.
- **How many:** no limit per product. Two files with the same number for one product hold that product back.
- **A product that already has images** is held back unless you tick “Also add to products that already have images” (they are added after the existing ones).
- **Formats and size:** JPEG, PNG or WebP, under 25 MB each. Every image is turned into a WebP under 150 KB in the browser before upload (longest side 1600 px, then 1400, 1200, 1000, 800; never enlarged). A WebP already under 150 KB and 1600 px is uploaded exactly as it is. An image that cannot fit 150 KB at 800 px is refused: crop it closer.
- **Size to supply:** 1600 px on the longest side is ideal; under 800 px looks soft. Product photos are square on cards.
- **Per size or colour:** not supported — images belong to the product, not to a size or colour. When colours need their own photos, list each colour as its own product (e.g. `meadow-linen-shirt-sage`, `meadow-linen-shirt-white`), as the store already does.
- **Alt text:** set to the product name on upload; change it in the gallery (up to 300 characters).
- **Upload:** Store catalogue → Bulk images, choose the files, read the plan, then upload. The validator checks names against the products file with `--images <folder>`.

