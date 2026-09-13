// ============================================================
// Creator dashboard — greeting and the activity feed, as pure functions.
//
// The feed is assembled only from things that actually happened: click
// events the creator can read, their own payout requests, reward claims, KYC
// state and the account's own dates. Nothing here is invented.
// ============================================================

export function greetingFor(hour) {
  const h = Number(hour);
  if (!Number.isFinite(h)) return 'Hello';
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 22) return 'Good evening';
  return 'Good night';
}

export function relativeTime(iso, now = new Date()) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, Math.round((now.getTime() - t) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60); if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.round(h / 24); if (d < 30) return `${d} day${d === 1 ? '' : 's'} ago`;
  const mo = Math.round(d / 30); if (mo < 12) return `${mo} month${mo === 1 ? '' : 's'} ago`;
  const y = Math.round(mo / 12); return `${y} year${y === 1 ? '' : 's'} ago`;
}

const PAYOUT_COPY = {
  requested: 'Payout requested', under_review: 'Payout under review', approved: 'Payout approved',
  paid: 'Payout paid', rejected: 'Payout returned to balance', cancelled: 'Payout cancelled',
};
const KYC_COPY = {
  pending: ['Verification submitted', 'Our team is checking your details'],
  verified: ['Verified by SORA LIFE', 'Payout details approved'],
  rejected: ['Verification needs attention', 'See Payouts for the reason'],
  needs_update: ['Verification needs an update', 'See Payouts for what to change'],
};

// `clicks` is a list of ISO timestamps, newest first (what getMyRecentClicks
// returns). Everything else is the state the portal already holds.
export function buildActivity({ creator, clicks = [], payouts = [], rewards = null, kyc = null, now = new Date(), limit = 6 } = {}) {
  const items = [];
  const dayAgo = now.getTime() - 24 * 3600 * 1000;
  const recent = (Array.isArray(clicks) ? clicks : []).map((c) => new Date(c).getTime()).filter((t) => Number.isFinite(t));
  if (recent.length > 0) {
    const inDay = recent.filter((t) => t >= dayAgo).length;
    const n = inDay > 0 ? inDay : Math.min(recent.length, 1);
    items.push({ id: 'clicks', icon: 'externalLink', tone: 'brand', title: 'New link clicks',
      body: `${n} click${n === 1 ? '' : 's'} on your links${inDay > 0 ? ' in the last day' : ''}`, at: new Date(Math.max(...recent)).toISOString() });
  }
  for (const p of Array.isArray(payouts) ? payouts : []) {
    const at = p.paid_at || p.approved_at || p.requested_at; if (!at) continue;
    items.push({ id: `payout-${p.id}`, icon: 'card', tone: p.status === 'paid' || p.status === 'approved' ? 'ok' : p.status === 'rejected' || p.status === 'cancelled' ? 'bad' : 'hold',
      title: PAYOUT_COPY[p.status] || 'Payout updated', body: p.requested_amount != null ? `₹${Number(p.requested_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '', at });
  }
  for (const c of Array.isArray(rewards?.claims) ? rewards.claims : []) {
    if (!c.claimed_at) continue;
    items.push({ id: `claim-${c.id || c.level}`, icon: 'gift', tone: 'brand', title: `Level ${c.level} reward claimed`, body: c.label || '', at: c.claimed_at });
  }
  if (kyc?.identity_status && KYC_COPY[kyc.identity_status] && (kyc.verified_at || kyc.submitted_at)) {
    const [title, body] = KYC_COPY[kyc.identity_status];
    items.push({ id: 'kyc', icon: 'shield', tone: kyc.identity_status === 'verified' ? 'ok' : 'hold', title, body, at: kyc.verified_at || kyc.submitted_at });
  }
  if (creator?.status === 'active' && creator?.joined_at) {
    items.push({ id: 'active', icon: 'user', tone: 'ok', title: 'Account activated', body: 'Your creator account is now active', at: creator.joined_at });
  }
  if (creator?.created_at || creator?.joined_at) {
    items.push({ id: 'welcome', icon: 'star', tone: 'brand', title: 'Welcome to SORA LIFE', body: 'Start sharing and earn', at: creator.created_at || creator.joined_at });
  }
  return items
    .filter((i) => Number.isFinite(new Date(i.at).getTime()))
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, limit)
    .map((i) => ({ ...i, when: relativeTime(i.at, now) }));
}
