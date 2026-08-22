#!/usr/bin/env python3
"""Build the Sora Life catalog from the real Biosash WooCommerce Store API dump.
Facts only: name, price, size, category, stock, official image URLs.
Emits src/data/biosash.js and an image download manifest.
"""
import json, re, html, os

def strip_html(s):
    s = re.sub(r'<[^>]+>', ' ', s or '')
    s = html.unescape(s)
    return re.sub(r'\s+', ' ', s).strip()

p1 = json.load(open('biosash_p1.json', encoding='utf-8'))
p2 = json.load(open('biosash_p2.json', encoding='utf-8'))
seen = {}
for pr in p1 + p2:
    seen[pr['id']] = pr
prods = list(seen.values())

# storefront category -> set of real Biosash category slugs
STORE = [
    ('mens-care',     "Men's Care",       {'mens-essentials','beard-mooch','mens-hygiene'}),
    ('supplements',   'Supplements',      {'herbal-supplements-ayurveda'}),
    ('juices-drinks', 'Juices & Drinks',  {'nutritional-juices','healthy-drinks','squashes','tea','jams-sauces','healthy-foods'}),
    ('hair-care',     'Hair Care',        {'hair-care','shampoos','conditioners','hair-oils','hair-serums-gels'}),
    ('skin-care',     'Skin Care',        {'face-care','facial-creams','facial-serums-gels','face-washes','face-packs','face-scrubs','facial-detan','facial-toners','facial-cleanser','facial-combos'}),
    ('bath-body',     'Bath & Body',      {'bath-body','bath-soaps','body-oils','body-washes-shower-gels','body-scrubs','body-talc','face-body','body-lotions'}),
    ('personal-care', 'Personal Care',    {'prevention-hygiene','womens-hygiene','tooth-gels','oral-care','body-care'}),
    ('wellness',      'Wellness',         {'health-care','nutritional-juices','healthy-drinks','squashes','tea','jams-sauces','healthy-foods','herbal-supplements-ayurveda'}),
]

def money(minor, unit):
    try:
        return round(int(minor) / (10 ** unit))
    except Exception:
        return 0

out = []
manifest = []
for pr in prods:
    cats = [c['slug'] for c in pr.get('categories', [])]
    catset = set(cats)
    matched = [s for (s, _n, sels) in STORE if catset & sels]
    if not matched:
        continue
    primary = matched[0]  # STORE is in priority order
    prices = pr.get('prices', {})
    unit = prices.get('currency_minor_unit', 2)
    price = money(prices.get('price'), unit)
    mrp = money(prices.get('regular_price'), unit)
    if price <= 0:
        continue
    on_sale = bool(pr.get('on_sale')) and mrp > price
    disc = round((mrp - price) / mrp * 100) if on_sale and mrp else 0
    imgs = [i.get('src') for i in pr.get('images', []) if i.get('src')]
    imgs = imgs[:4]
    pid = 'b%d' % pr['id']
    # local primary image
    ext = os.path.splitext(imgs[0])[1].split('?')[0] if imgs else '.jpg'
    local = '/img/%s%s' % (pid, ext if ext in ('.jpg', '.jpeg', '.png', '.webp') else '.jpg')
    if imgs:
        manifest.append('%s\t%s' % ('public' + local, imgs[0]))
    # size / variants from attributes
    form = None
    variants = None
    for a in pr.get('attributes', []):
        nm = (a.get('name') or '').lower()
        if nm in ('quantity', 'size', 'volume', 'weight', 'pack', 'pack size'):
            terms = [t.get('name') for t in a.get('terms', []) if t.get('name')]
            if len(terms) == 1:
                form = terms[0]
            elif len(terms) > 1:
                variants = [{'id': 'v%d' % i, 'label': t} for i, t in enumerate(terms)]
                form = terms[0]
            break
    rc = int(pr.get('review_count') or 0)
    rating = round(float(pr.get('average_rating') or 0), 1) if rc > 0 else 0
    out.append({
        'id': pid,
        'slug': pr['slug'],
        'name': strip_html(pr['name']),
        'category': primary,
        'categories': matched,
        'price': price,
        'mrp': mrp,
        'onSale': on_sale,
        'discountPct': disc,
        'image': local if imgs else None,
        'gallery': imgs,
        'form': form,
        'variants': variants,
        'rating': rating,
        'reviewCount': rc,
        'inStock': bool(pr.get('is_in_stock')),
        'permalink': pr.get('permalink'),
    })

# stable order: by category priority then name
order = {s: i for i, (s, _n, _x) in enumerate(STORE)}
out.sort(key=lambda p: (order.get(p['category'], 99), p['name']))

cats_out = [{'slug': s, 'name': n} for (s, n, _x) in STORE]

with open('src/data/biosash.js', 'w', encoding='utf-8') as f:
    f.write('// AUTO-GENERATED from the official Biosash WooCommerce Store API.\n')
    f.write('// Facts only (name, price, size, category, stock, official image URLs).\n')
    f.write('// Regenerate with: python scripts_build_catalog.py\n')
    f.write('export const BIOSASH_CATEGORIES = ' + json.dumps(cats_out, ensure_ascii=False, indent=2) + ';\n\n')
    f.write('export const BIOSASH_PRODUCTS = ' + json.dumps(out, ensure_ascii=False, indent=2) + ';\n')

with open('image_manifest.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(manifest))

# report
from collections import Counter
dist = Counter(p['category'] for p in out)
print('PRODUCTS:', len(out))
print('IMAGES TO FETCH:', len(manifest))
print('DISTRIBUTION:')
for s, n, _x in STORE:
    print('  %-14s %s' % (s, dist.get(s, 0)))
print('ON SALE:', sum(1 for p in out if p['onSale']))
print('WITH RATING:', sum(1 for p in out if p['reviewCount'] > 0))
print('SAMPLE:', json.dumps(out[0], ensure_ascii=False)[:300])
