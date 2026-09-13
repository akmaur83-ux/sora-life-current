import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../Icon.jsx';
import CopyButton from '../CopyButton.jsx';

// ============================================================
// My tracking links — the studio page.
//
// The default link (always on, from the creator code) leads; campaign links
// follow as cards. Every URL is built by buildTrackingUrl from the link
// record — nothing here is typed by hand — and every visit through one is
// recorded against the account.
// ============================================================

const fmtDate = (iso) => (iso
  ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))
  : null);

// A human label for where a tracking link points.
export function destinationLabel(l) {
  const type = l?.destination_type || 'homepage';
  if (type === 'homepage' || type === 'home') return 'Homepage';
  const path = l?.destination_path || '/';
  const noun = type === 'product' ? 'Product' : type === 'category' || type === 'collection' ? 'Category' : 'Page';
  return `${noun} · ${path}`;
}

// Web Share API where available (mobile); otherwise nothing — Copy stays.
export function ShareButton({ url, title }) {
  const [shared, setShared] = useState(false);
  const canShare = typeof navigator !== 'undefined' && !!navigator.share;
  if (!canShare) return null;
  return (
    <button type="button" className="cp-btn" onClick={async () => {
      try { await navigator.share({ title, url }); setShared(true); } catch { /* cancelled */ }
    }}>
      <Icon name="externalLink" size={15} /> {shared ? 'Shared' : 'Share'}
    </button>
  );
}

// One link card: campaign → status → destination / created / code → url → actions.
export function LinkCard({ title, destination, status, statusText, code, createdLabel, url, isDefault = false }) {
  const on = status === 'active';
  return (
    <article className={`cl-card${isDefault ? ' cl-card--default' : ''}${on ? '' : ' is-off'}`}>
      <header className="cl-card__head">
        <span className="cl-card__ic" aria-hidden="true"><Icon name={isDefault ? 'home' : 'sparkle'} size={18} /></span>
        <div className="cl-card__title">
          <h2 className="serif">{title}</h2>
          <span className="cl-card__dest">{destination}</span>
        </div>
        <span className={`cp-pill is-${on ? 'ok' : 'bad'}`}><i aria-hidden="true" />{statusText || status}</span>
      </header>
      <dl className="cl-card__meta">
        <div><dt>Tracking code</dt><dd><code>{code}</code></dd></div>
        {createdLabel && <div><dt>Created</dt><dd>{createdLabel}</dd></div>}
      </dl>
      <code className="cl-card__url">{url}</code>
      <div className="cl-card__actions">
        <CopyButton value={url} className="cp-btn is-primary" label="Copy link" />
        <ShareButton url={url} title="Shop SORA LIFE" />
      </div>
    </article>
  );
}

// ---------------------------------------------------------------
// The page
// ---------------------------------------------------------------
export default function CreatorLinksPage({ creator, links = [], campaigns = [], buildUrl }) {
  const campaignById = Object.fromEntries((Array.isArray(campaigns) ? campaigns : []).map((c) => [c.id, c]));
  const rows = Array.isArray(links) ? links : [];
  const defaultUrl = buildUrl ? buildUrl({ destination_path: '/' }, creator, null) : '';
  const windowDays = Number(creator?.default_attribution_window_days);
  return (
    <div className="cl">
      <header className="cl-head">
        <div>
          <h1 className="crp__h1 serif">My tracking links</h1>
          <p className="crp__lede">Share these anywhere. Every visit through them is recorded against your account.</p>
        </div>
      </header>

      <LinkCard
        title="Default creator link" destination="Homepage" status="active" statusText="Always on"
        code={creator?.creator_code} createdLabel={null} url={defaultUrl} isDefault
      />

      <section className="cl-sec" aria-labelledby="cl-camps-h">
        <div className="cp-sec">
          <h2 className="cp-sec__h serif" id="cl-camps-h">Campaign links</h2>
          <p className="cp-sec__sub">{rows.length > 0 ? `${rows.length} ${rows.length === 1 ? 'link' : 'links'}, each tracked separately from your default link.` : 'Created alongside a campaign by your programme manager.'}</p>
        </div>
        {rows.length === 0 ? (
          <div className="cl-empty">
            <span className="cl-empty__ic" aria-hidden="true"><Icon name="externalLink" size={22} /></span>
            <div>
              <h3 className="serif">No campaign links yet</h3>
              <p>Campaign links are created alongside a campaign by your SORA LIFE programme manager. You don’t need one to start — your default link above is always ready and always attributes.</p>
              <Link to="/creator/campaigns" className="cp-btn">See campaigns <Icon name="arrowRight" size={14} /></Link>
            </div>
          </div>
        ) : (
          <div className="cl-grid">
            {rows.map((l) => (
              <LinkCard
                key={l.id}
                title={campaignById[l.campaign_id]?.name || 'Creator link'}
                destination={destinationLabel(l)}
                status={l.status}
                code={l.public_code}
                createdLabel={fmtDate(l.created_at)}
                url={buildUrl ? buildUrl(l, creator, campaignById[l.campaign_id]) : ''}
              />
            ))}
          </div>
        )}
      </section>

      <ul className="cl-tips" aria-label="How your links work">
        <li><Icon name="checkCircle" size={16} /><span>A visit through your link is recorded immediately.</span></li>
        <li><Icon name="clock" size={16} /><span>{Number.isFinite(windowDays) && windowDays > 0 ? `It stays attributed to you for ${windowDays} days.` : 'It stays attributed to you for your attribution window.'}</span></li>
        <li><Icon name="award" size={16} /><span>Orders through it appear in <Link to="/creator/analytics">Analytics</Link>; commission in <Link to="/creator/earnings">Earnings</Link>.</span></li>
      </ul>
    </div>
  );
}
