# Catalogue loading kit — fashion and jewellery

Everything needed to load products into the fashion store (jewellery is its Jewellery category):
templates, a field guide, a supplier-file mapper and a pre-import validator. Run every command
from the repository root with Node 20+. Nothing here talks to the database or uploads anything:
the admin's Store catalogue page does the importing, exactly as before.

| File | What it is |
|---|---|
| `templates/fashion-products.csv`, `templates/fashion-variants.csv` | The fashion sheets, with three example products |
| `templates/jewellery-products.csv`, `templates/jewellery-variants.csv`, `templates/jewellery-stones.csv` | The jewellery sheets, with three example products |
| `templates/companies.csv` | Manufacturers, packers and importers the products name (shared) |
| `FIELD-GUIDE.md` | Every column: what it is for, required or not, format, example, blank, what is refused and the message |
| `kit.mjs` | The commands below |
| `spec.mjs` | The one definition of every column; templates and the guide are built from it |

Supplier files and everything made from them live in `catalogue-work.local/` at the repository
root. Git and Vercel ignore `*.local`, so a supplier's sheet is never committed or deployed.

## Route 1 — fill it in by hand

1. Copy the templates for your kit (fashion or jewellery) and `companies.csv`.
2. Delete the `example-…` rows (the validator refuses them, so a forgotten one is caught).
3. One row per product in `…-products.csv`; one row per size × colour in `…-variants.csv`
   (a product with one option is one row with size `One size`); for jewellery, one row per kind of
   stone in `jewellery-stones.csv`. `FIELD-GUIDE.md` has every column.
4. Validate (below), fix, validate again until it says **Ready to import**.

## Route 2 — a supplier's own spreadsheet

```
node scripts/catalogue-kit/kit.mjs map --kit jewellery --supplier aurum --in "C:/path/their-file.xlsx" --categories categories.csv
```

`map` reads their sheet (.xlsx or CSV), proposes which of their columns is which of ours, lists
every category value they use, and writes `catalogue-work.local/aurum/mapping.json`. Open it and
settle what it lists under "Decide before converting":

- `columns` — each of their columns → one of ours, or `null` to drop it. A column marked
  `decision` (an ambiguous "Price", a "Weight" that could be gross or net, "Carat" that could be
  purity or stone weight) is not converted until you set it.
- `categories` — each of their category values → our category path (`jewellery/rings`). Only a
  value that matched exactly one of our categories by name is pre-filled; check those too.
- `fixed` — a value for every row, e.g. `{"country_of_origin": "IN", "manufacturer": "…"}`.
  Prices, stock and category can never be fixed.
- `layout` — `row-per-product`, or `row-per-variant` when rows sharing a style code are the sizes of one product.

Then:

```
node scripts/catalogue-kit/kit.mjs convert --supplier aurum --in "C:/path/their-file.xlsx" --categories categories.csv --companies companies.csv
```

It writes `products.csv`, `variants.csv` (and `stones.csv`), `images.csv` (their image URLs with
the file name each should be saved as) and `report.md` / `report.csv`: every value converted,
every value flagged for a person, every row skipped and why — followed by the validator's verdict
on the result.

It never guesses a price, a stock figure or a category. "₹1,299/-" becomes 1299, but an ambiguous
"Price" column waits for you; sizes priced differently keep their own prices and the product's
selling price is left for you; "In stock" is not a number; an unmapped category stays blank.

Your edits to `mapping.json` are kept: the next file from the same supplier is proposed from them,
and only new columns get a fresh proposal. To teach it a supplier's vocabulary for good, add the
header to `SYNONYMS` in `map.mjs`.

## Validate before every import

```
node scripts/catalogue-kit/kit.mjs validate --kit fashion --products p.csv --variants v.csv --companies companies.csv --categories categories.csv --images photos/
```

Every problem at once, in four groups: **fix before importing** (the import would skip the row,
or the database would refuse it, or it breaks a rule — nothing sells above its MRP), **claims**
(speed, sustainability or medical claims in the copy), **imports but bites later** (cannot be
published, a declaration missing), and **worth knowing**. Exit code 1 while anything needs fixing.

Every sheet is run through the admin importer's own planner, so the rows the validator passes are
the rows the import accepts. Options:

- `--categories <file>` — our category paths, one per line (`path,name` header optional), e.g.
  `jewellery/rings,Rings`. Or `--live-categories` to read the store's active categories (read-only,
  the same public read the storefront makes, using `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`).
  Without either, category paths are not checked.
- `--existing-products` / `--existing-variants` / `--existing-companies` — the admin's own exports
  (Store catalogue → Fashion → Bulk import (CSV) → "Export current products (CSV)", and the same under
  "Sizes & colours (variants)" and "Companies"), to catch a slug or SKU already taken, to see what an
  update would change, and to accept a manufacturer already in the Companies list. Without the
  companies sheet or that export, company names are not checked.
- `--images <folder>` — checks every product has `<slug>-1.<webp|jpg|png>` and reports names that match no product.
- `--report out.md` — the same report as a file.

## Then, in the admin (Store catalogue → Fashion)

1. **Bulk import (CSV) → Companies**: `companies.csv`, tick **Create new**, read the plan, apply. One
   list serves every store; the **Companies** tab edits it one company at a time.
2. **Bulk import (CSV) → Products**: choose the products CSV, tick **Create new products**, read the plan, apply.
   Every new product is a **draft**. Leave **Overwrite existing values** off unless you mean to replace values.
   A manufacturer, packer or importer is read by its name in the Companies list.
3. **Bulk import (CSV) → Sizes & colours (variants)**: the variants CSV, tick **Create new**, read the plan, apply.
4. Jewellery: **Bulk import (CSV) → Stones (jewellery)**: `jewellery-stones.csv`, tick **Create new**, apply.
5. **Bulk images**: choose the photos named `<slug>-1.webp`, `<slug>-2.webp`…, read the plan, upload.
6. Open each product, check it, **publish** (it needs an image and an active size/colour). The editor
   lists any declaration still missing — a reminder, never a block. A rate-linked product stays a draft.

## Changing the kit

Edit `spec.mjs` (a column, a format, an example), then `node scripts/catalogue-kit/kit.mjs build`
to rewrite the templates and `FIELD-GUIDE.md`. `scripts/test-catalogue-kit.mjs` fails while they
differ, and pins the validator and the mapper.
