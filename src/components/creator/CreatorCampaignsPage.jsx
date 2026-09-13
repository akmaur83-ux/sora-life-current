import { Link } from 'react-router-dom';
import Icon from '../Icon.jsx';
import CopyButton from '../CopyButton.jsx';

// ============================================================
// My campaigns — the studio page.
//
// Campaigns are seasonal pushes SORA LIFE builds for creators; the
// programme manager sets them up, the creator sees them here with their
// own campaign link when one exists. Nothing is created from this page.
// ============================================================

const fmtDate = (iso) => (iso
  ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))
  : null);

export const CAMPAIGN_STATUS = {
  active: { tone: 'ok', label: 'Active' },
  draft: { tone: 'hold', label: 'Draft' },
  paused: { tone: 'hold', label: 'Paused' },
  ended: { tone: 'neutral', label: 'Ended' },
};

// "1 Oct – 15 Nov 2026", "From 1 Oct 2026", "Open-ended".
export function campaignWindow(c) {
  const a = fmtDate(c?.start_at); const b = fmtDate(c?.end_at);
  if (a && b) return `${a} – ${b}`;
  if (a) return `From ${a}`;
  if (b) return `Until ${b}`;
  return 'Open-ended';
}

export function CampaignCard({ campaign, link, creator, buildUrl }) {
  const st = CAMPAIGN_STATUS[campaign?.status] || { tone: 'neutral', label: campaign?.status || '—' };
  const rate = campaign?.commission_rate_override;
  const windowDays = campaign?.attribution_window_days;
  const url = link && buildUrl ? buildUrl(link, creator, campaign) : null;
  return (
    <article className={`cc-card${campaign?.status === 'active' ? '' : ' is-off'}`} data-status={campaign?.status || 'unknown'}>
      <header className="cc-card__head">
        <span className="cc-card__ic" aria-hidden="true"><Icon name="sparkle" size={18} /></span>
        <div className="cc-card__title">
          <h2 className="serif">{campaign?.name}</h2>
          <span className="cc-card__when"><Icon name="clock" size={13} /> {campaignWindow(campaign)}</span>
        </div>
        <span className={`cp-pill is-${st.tone}`}><i aria-hidden="true" />{st.label}</span>
      </header>
      {campaign?.description && <p className="cc-card__desc">{campaign.description}</p>}
      <dl className="cc-card__meta">
        <div><dt>Campaign code</dt><dd><code>{campaign?.campaign_code}</code></dd></div>
        <div><dt>Commission</dt><dd>{rate != null && rate !== '' ? <><b className="is-ok">{Number(rate)}%</b> for this campaign</> : 'Your tier rate'}</dd></div>
        <div><dt>Attribution</dt><dd>{windowDays ? `${Number(windowDays)} days` : 'Your usual window'}</dd></div>
      </dl>
      {url ? (
        <div className="cc-card__link">
          <code className="cl-card__url">{url}</code>
          <CopyButton value={url} className="cp-btn is-primary" label="Copy link" />
        </div>
      ) : (
        <p className="cc-card__nolink"><Icon name="circleAlert" size={14} /><span>No link for this campaign yet — your programme manager creates it. Your <Link to="/creator/links">default link</Link> still attributes.</span></p>
      )}
    </article>
  );
}

// ---------------------------------------------------------------
// The page
// ---------------------------------------------------------------
export default function CreatorCampaignsPage({ creator, campaigns = [], links = [], buildUrl }) {
  const rows = Array.isArray(campaigns) ? campaigns : [];
  const linkByCampaign = {};
  for (const l of (Array.isArray(links) ? links : [])) if (l?.campaign_id && !linkByCampaign[l.campaign_id]) linkByCampaign[l.campaign_id] = l;
  const live = rows.filter((c) => c.status === 'active').length;
  return (
    <div className="cc">
      <header className="cc-head">
        <div>
          <h1 className="crp__h1 serif">My campaigns</h1>
          <p className="crp__lede">Seasonal pushes SORA LIFE builds for creators — a launch, a festive edit, a category focus. Your programme manager sets them up.</p>
        </div>
        {rows.length > 0 && <span className="ca-period"><Icon name="sparkle" size={15} /> {live} active of {rows.length}</span>}
      </header>

      {rows.length === 0 ? (
        <section className="cc-empty" aria-label="No campaigns yet">
          <span className="cc-empty__leaf" aria-hidden="true" />
          <span className="cc-empty__ic" aria-hidden="true"><Icon name="sparkle" size={24} /></span>
          <p className="cp-eyebrow">Campaign status</p>
          <h2 className="serif">No campaigns running yet</h2>
          <p className="cc-empty__body">Campaigns are seasonal pushes SORA LIFE builds for creators — a launch, a festive edit, a category focus. Your programme manager sets them up; you don’t create them yourself.</p>
          <ul className="cc-empty__points">
            <li><Icon name="externalLink" size={15} /><span>A campaign link of your own, tracked separately from your default link</span></li>
            <li><Icon name="award" size={15} /><span>Its own commission rate when the campaign carries one</span></li>
            <li><Icon name="sparkle" size={15} /><span>Performance you can see split out in Analytics</span></li>
          </ul>
          <Link to="/creator/links" className="cp-btn is-primary">Use my default link <Icon name="arrowRight" size={14} /></Link>
        </section>
      ) : (
        <div className="cc-grid">
          {rows.map((c) => <CampaignCard key={c.id} campaign={c} link={linkByCampaign[c.id] || null} creator={creator} buildUrl={buildUrl} />)}
        </div>
      )}
    </div>
  );
}
