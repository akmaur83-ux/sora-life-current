-- ============================================================
-- 0015 — Storefront Appearance theme
--
-- Adds a single admin-customizable `storefront_theme` object to site_settings,
-- consumed by the storefront via CSS custom properties. Seeded with the EXACT
-- current SORA tokens, so applying this migration changes nothing visible.
--
-- Security:
--   * public read is extended to include 'storefront_theme' (colors only — safe
--     to expose; every other admin key stays private).
--   * writes go through admin_set_storefront_theme(), which is admin-gated and
--     validates every value server-side (strict #RRGGBB + closed enums) and
--     whitelists unknown keys away — no url(), javascript:, HTML or CSS can be
--     stored. The existing admin-only write RLS remains as defense-in-depth.
-- ============================================================

-- 1. Extend the presentation-key public-read allowlist (from 0009) with the theme.
drop policy if exists "site_settings public read" on public.site_settings;
create policy "site_settings public read"
  on public.site_settings for select
  using (key in ('branding', 'announcement', 'contact', 'homepage', 'storefront_theme'));

-- 2. Seed the default theme (== current storefront). ON CONFLICT DO NOTHING so a
--    re-run never overwrites an admin's saved theme.
insert into public.site_settings (key, value) values
  ('storefront_theme', jsonb_build_object(
     'brand_primary', '#1E3A2F', 'brand_secondary', '#1A3226', 'brand_accent', '#E8B04B', 'brand_highlight', '#D08E2C',
     'header_bg', '#FBF8F1', 'header_text', '#2C3A32', 'header_icon', '#16211B',
     'annbar_bg', '#1A3226', 'annbar_text', '#F0F6F2', 'annbar_accent', '#F0C169',
     'hero_overlay', 'none', 'category_bg', '#1A3226', 'category_title', '#F0F6F2',
     'category_subtitle', '#BEDACD', 'category_hover', '#F6D79A', 'category_circle', '#FFFFFF',
     'discount_bg', '#E8B04B', 'discount_text', '#14261C', 'new_bg', '#1E3A2F', 'new_text', '#F0F6F2',
     'price_color', '#4E7452', 'mrp_color', '#A94F4F', 'card_bg', '#FFFFFF', 'card_border', '#F0EADD',
     'btn_primary_bg', '#1E3A2F', 'btn_primary_text', '#FBF8F1', 'btn_secondary_bg', '#FFFFFF',
     'btn_secondary_text', '#1E3A2F', 'btn_hover', '#1A3226',
     'heading_scale', 'normal', 'body_scale', 'normal',
     'page_bg', '#FBF8F1', 'section_bg', '#F4EEE1', 'card_surface', '#FFFFFF', 'border_color', '#E7DFD0',
     'text_primary', '#16211B', 'text_secondary', '#55655B', 'text_muted', '#7A897F',
     'footer_bg', '#1A3226', 'footer_text', '#FBF8F1', 'footer_accent', '#F0C169'
  ))
on conflict (key) do nothing;

-- 3. Validating writer — admin only, strict server-side validation, whitelist.
create or replace function public.admin_set_storefront_theme(p_theme jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_defaults jsonb := (select value from public.site_settings where key = 'storefront_theme');
  v_out jsonb;
  v_key text;
  v_val text;
  v_color_keys text[] := array[
    'brand_primary','brand_secondary','brand_accent','brand_highlight',
    'header_bg','header_text','header_icon','annbar_bg','annbar_text','annbar_accent',
    'category_bg','category_title','category_subtitle','category_hover','category_circle',
    'discount_bg','discount_text','new_bg','new_text','price_color','mrp_color','card_bg','card_border',
    'btn_primary_bg','btn_primary_text','btn_secondary_bg','btn_secondary_text','btn_hover',
    'page_bg','section_bg','card_surface','border_color','text_primary','text_secondary','text_muted',
    'footer_bg','footer_text','footer_accent'
  ];
begin
  if not public.is_sora_admin() then raise exception 'admin only'; end if;
  if p_theme is null or jsonb_typeof(p_theme) <> 'object' then
    raise exception 'invalid theme payload';
  end if;

  -- Start from the seeded defaults, so the stored object is always complete and
  -- any unknown key present in p_theme is simply never copied (whitelisted away).
  v_out := coalesce(v_defaults, '{}'::jsonb);

  -- Colors: strict #RRGGBB. Anything else (url(), javascript:, ;, <, spaces …)
  -- fails the regex and is rejected outright.
  foreach v_key in array v_color_keys loop
    if p_theme ? v_key then
      v_val := p_theme ->> v_key;
      if v_val is null or v_val !~ '^#[0-9A-Fa-f]{6}$' then
        raise exception 'invalid color for %: %', v_key, left(coalesce(v_val, '(null)'), 40);
      end if;
      v_out := jsonb_set(v_out, array[v_key], to_jsonb(v_val));
    end if;
  end loop;

  -- Closed enums.
  if p_theme ? 'hero_overlay' then
    v_val := p_theme ->> 'hero_overlay';
    if v_val not in ('none','subtle','medium','strong') then raise exception 'invalid hero_overlay: %', v_val; end if;
    v_out := jsonb_set(v_out, '{hero_overlay}', to_jsonb(v_val));
  end if;
  if p_theme ? 'heading_scale' then
    v_val := p_theme ->> 'heading_scale';
    if v_val not in ('compact','normal','large') then raise exception 'invalid heading_scale: %', v_val; end if;
    v_out := jsonb_set(v_out, '{heading_scale}', to_jsonb(v_val));
  end if;
  if p_theme ? 'body_scale' then
    v_val := p_theme ->> 'body_scale';
    if v_val not in ('compact','normal','large') then raise exception 'invalid body_scale: %', v_val; end if;
    v_out := jsonb_set(v_out, '{body_scale}', to_jsonb(v_val));
  end if;

  insert into public.site_settings (key, value) values ('storefront_theme', v_out)
    on conflict (key) do update set value = excluded.value;

  return jsonb_build_object('ok', true, 'theme', v_out);
end $$;

revoke all on function public.admin_set_storefront_theme(jsonb) from public, anon;
grant execute on function public.admin_set_storefront_theme(jsonb) to authenticated, service_role;

select 'Storefront theme (0015) migration complete.' as status;
