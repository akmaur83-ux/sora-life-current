-- Legal Pages: seed existing copy and permit anonymous reads of these five keys.
-- Run in Supabase SQL Editor. No CLI deployment is needed.
-- Existing rows, settings policies, Creator Terms and write permissions are preserved.
begin;
do $seed$
declare
  seeds jsonb := $json${
  "privacy": {
    "title": "Privacy Policy",
    "intro": "How SORA LIFE handles the information you share when you use the store.",
    "body": "# What an account stores\n\nWhen you create an account, SORA LIFE keeps your email, any delivery addresses you save, your order history and your wishlist so they are available when you sign in.\n\n# What an order records\n\nTo fulfil an order we store the delivery details you enter at checkout — name, contact number, address — alongside the order itself. Your order total is calculated on our server.\n\n# Payments\n\nCard and online payments are processed by Razorpay. Sora Life never sees or stores your full card details — only the confirmation Razorpay returns for your order.\n\n# On this device\n\nYour cart and, for guests, your wishlist are kept in your browser so they persist between visits. A referral link may store a creator attribution identifier in your browser; it holds no personal information.",
    "updated_at": null
  },
  "terms": {
    "title": "Terms & Conditions",
    "intro": "The basis on which you use SORA LIFE and place orders.",
    "body": "# Prices and totals\n\nProduct prices, discounts, delivery charges and the final payable amount are recalculated on our server at checkout. The amount confirmed there is the amount you are charged.\n\n# Placing an order\n\nAn order is created once you submit it and is confirmed once payment is completed, or recorded when you choose cash on delivery. Availability is subject to stock at the time of purchase.\n\n# Your account\n\nYou are responsible for keeping your sign-in details secure. Products, prices and availability are managed by the store and may change.\n\n# Creator Program\n\nParticipation in the Creator Program is governed by the terms presented within the program itself.",
    "updated_at": null
  },
  "returns": {
    "title": "Returns, Refunds & Cancellation",
    "intro": "How to raise an issue with an order.",
    "body": "# Raising a request\n\nIf something is wrong with an order, contact the store with your order number — you can find it in your orders or on your Purchase Passport. The store will confirm how your request is handled.\n\n# Order status\n\nEvery order shows its current status in your account, so you can see where it stands before and after raising a request.",
    "updated_at": null
  },
  "contact": {
    "title": "We're here to help.",
    "intro": "Find quick answers below, track an order, or use the available account and programme support tools.",
    "legalName": "",
    "address": "",
    "email": "",
    "phone": "",
    "hours": "",
    "faqs": [
      {
        "q": "How do I track my order?",
        "a": "Open your orders to see each order's verified status. When the seller adds a tracking link, a “Track shipment” button appears there. You can also look up a single order from the Purchase Passport page using its order number and email."
      },
      {
        "q": "Do I need an account to buy?",
        "a": "You can check out as a guest. Creating an account keeps your order history, saved addresses and wishlist together and lets you reorder more easily."
      },
      {
        "q": "What are the delivery options and charges?",
        "a": "Standard, Express and Scheduled delivery are offered, each with its own charge. The current options and any delivery estimate are shown at checkout before you pay. See the Shipping page for the full breakdown."
      },
      {
        "q": "How is my payment handled?",
        "a": "Your order total is recalculated on our server before payment, and online payments are processed by Razorpay — Sora Life does not receive or store your full card details. Cash on delivery is also presented as a payment option at checkout."
      },
      {
        "q": "What is the Creator Program?",
        "a": "It lets you share products you believe in and follow your attribution and application status from your account. Start from the Creator Program."
      }
    ],
    "updated_at": null
  },
  "grievance": {
    "title": "Grievance Redressal",
    "intro": "",
    "legalName": "",
    "address": "",
    "email": "",
    "phone": "",
    "hours": "",
    "officerName": "",
    "officerEmail": "",
    "officerPhone": "",
    "officerAddress": "",
    "acknowledgement": "",
    "resolution": "",
    "responseNote": "",
    "updated_at": null
  }
}$json$::jsonb;
  legacy jsonb := coalesce((select value from public.site_settings where key = 'contact'), '{}'::jsonb);
  brand_name text := coalesce(nullif((select value->>'siteName' from public.site_settings where key = 'branding'), ''), 'SORA LIFE');
  entry record;
  payload jsonb;
  field_name text;
begin
  for entry in select key, value from jsonb_each(seeds) loop
    payload := entry.value;
    if entry.key in ('privacy','terms','returns') then
      payload := jsonb_set(payload, '{body}', to_jsonb(replace(payload->>'body', 'SORA LIFE', brand_name)));
      payload := jsonb_set(payload, '{intro}', to_jsonb(replace(payload->>'intro', 'SORA LIFE', brand_name)));
      if length(trim(coalesce(legacy->'policies'->>entry.key, ''))) > 0 then
        payload := jsonb_set(payload, '{body}', to_jsonb((payload->>'body') || E'\n\n# Full policy\n\n' || (legacy->'policies'->>entry.key)));
      end if;
      payload := jsonb_set(payload, '{body}', to_jsonb((payload->>'body') || E'\n\n# Questions about this?\n\n' ||
        case when length(trim(coalesce(legacy->>'email','') || coalesce(legacy->>'phone','') || coalesce(legacy->>'address',''))) > 0
          then 'See the Contact & help page for the store''s published contact channels and support hours, when available.'
          else 'Visit Contact & help for available support and order-tracking options.' end));
      if length(trim(coalesce(legacy->>'legalName',''))) > 0 then
        payload := jsonb_set(payload, '{body}', to_jsonb((payload->>'body') || E'\n\nBusiness: ' || (legacy->>'legalName')));
      end if;
      if length(trim(coalesce(legacy->>'address',''))) > 0 then
        payload := jsonb_set(payload, '{body}', to_jsonb((payload->>'body') || E'\n\nPublished address: ' || (legacy->>'address')));
      end if;
      if length(trim(coalesce(legacy->>'email',''))) > 0 then
        payload := jsonb_set(payload, '{body}', to_jsonb((payload->>'body') || E'\n\n' || (legacy->>'email') ||
          case when length(trim(coalesce(legacy->>'phone',''))) > 0 then ' · ' || (legacy->>'phone') else '' end));
      end if;
    elsif entry.key = 'contact' then
      foreach field_name in array array['legalName','address','email','phone','hours'] loop
        payload := jsonb_set(payload, array[field_name], to_jsonb(coalesce(legacy->>field_name,'')));
      end loop;
      if length(trim(coalesce(legacy->>'email','') || coalesce(legacy->>'phone','') || coalesce(legacy->>'address',''))) > 0 then
        payload := jsonb_set(payload, '{intro}', to_jsonb('Find quick answers below, track an order from your account, or reach ' || brand_name || ' through the published contact channels.'));
      end if;
    end if;
    insert into public.site_settings(key,value) values ('legal_' || entry.key,payload)
      on conflict(key) do nothing;
  end loop;
end $seed$;

-- Add a separate, narrowly scoped SELECT policy. Do not replace any existing allowlist.
drop policy if exists "legal pages public read" on public.site_settings;
create policy "legal pages public read" on public.site_settings
  for select to anon, authenticated
  using (key in ('legal_privacy','legal_terms','legal_returns','legal_contact','legal_grievance'));
commit;

-- Verify five rows were seeded. This reports status without exposing contact details.
select key, case when key in ('legal_privacy','legal_terms','legal_returns')
  then length(coalesce(value->>'body','')) > 0 else true end as seeded
from public.site_settings where key in ('legal_privacy','legal_terms','legal_returns','legal_contact','legal_grievance')
order by key;
