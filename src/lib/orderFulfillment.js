export const FULFILLMENT_STATUSES = Object.freeze([
  'unfulfilled',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
]);

const STATUS_LABELS = Object.freeze({
  unfulfilled: 'Not yet fulfilled',
  processing: 'Preparing order',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Fulfillment cancelled',
});

export function normalizeFulfillmentStatus(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return FULFILLMENT_STATUSES.includes(normalized) ? normalized : null;
}

export function fulfillmentStatusLabel(value) {
  const status = normalizeFulfillmentStatus(value);
  return status ? STATUS_LABELS[status] : null;
}

function isPrivateHostname(hostname) {
  const host = String(hostname || '').replace(/^\[|\]$/g, '').toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
  // Carrier links should use a public DNS name. Reject every IPv6 literal
  // rather than trying to safely classify mapped and reserved ranges here.
  if (host.includes(':')) return true;
  const octets = host.split('.').map(Number);
  if (octets.length !== 4 || octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return !host.includes('.') && !host.includes(':');
  }
  return octets[0] === 10
    || octets[0] === 127
    || (octets[0] === 169 && octets[1] === 254)
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168);
}

// Return one safe, normalized public HTTPS URL or null. No URL is ever
// derived from a carrier name or tracking number.
export function safeTrackingUrl(value) {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw || raw.length > 2048 || /[\u0000-\u001f\u007f\s]/.test(raw)) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || isPrivateHostname(url.hostname)) return null;
    return url.href;
  } catch {
    return null;
  }
}

function cleanText(value, maxLength, label) {
  if (value == null || String(value).trim() === '') return null;
  const text = String(value).trim();
  if (text.length > maxLength || /[\u0000-\u001f\u007f]/.test(text)) {
    throw new Error(`${label} is invalid.`);
  }
  return text;
}

export function validateFulfillmentInput(input = {}) {
  const rawStatus = input.fulfillmentStatus == null ? '' : String(input.fulfillmentStatus).trim();
  const fulfillmentStatus = rawStatus === '' ? null : normalizeFulfillmentStatus(rawStatus);
  if (rawStatus && !fulfillmentStatus) throw new Error('Choose a valid fulfillment status.');

  const rawTrackingUrl = input.trackingUrl == null ? '' : String(input.trackingUrl).trim();
  const trackingUrl = rawTrackingUrl ? safeTrackingUrl(rawTrackingUrl) : null;
  if (rawTrackingUrl && !trackingUrl) throw new Error('Tracking URL must be a public HTTPS URL.');

  return {
    fulfillmentStatus,
    carrierName: cleanText(input.carrierName, 120, 'Carrier name'),
    trackingNumber: cleanText(input.trackingNumber, 160, 'Tracking number'),
    trackingUrl,
  };
}

function displayText(value, maxLength) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text && text.length <= maxLength && !/[\u0000-\u001f\u007f]/.test(text) ? text : null;
}

function displayTimestamp(value) {
  if (typeof value !== 'string' || value.length > 64) return null;
  return Number.isNaN(new Date(value).getTime()) ? null : value;
}

export function fulfillmentForDisplay(value = {}) {
  const fulfillmentStatus = normalizeFulfillmentStatus(value.fulfillmentStatus ?? value.fulfillment_status);
  const record = {
    fulfillmentStatus,
    label: fulfillmentStatusLabel(fulfillmentStatus),
    carrierName: displayText(value.carrierName ?? value.carrier_name, 120),
    trackingNumber: displayText(value.trackingNumber ?? value.tracking_number, 160),
    trackingUrl: safeTrackingUrl(value.trackingUrl ?? value.tracking_url),
    shippedAt: displayTimestamp(value.shippedAt ?? value.shipped_at),
    deliveredAt: displayTimestamp(value.deliveredAt ?? value.delivered_at),
  };
  return hasFulfillmentData(record) ? record : null;
}

export function hasFulfillmentData(value = {}) {
  return Boolean(
    normalizeFulfillmentStatus(value.fulfillmentStatus ?? value.fulfillment_status)
    || value.carrierName || value.carrier_name
    || value.trackingNumber || value.tracking_number
    || safeTrackingUrl(value.trackingUrl ?? value.tracking_url)
    || value.shippedAt || value.shipped_at
    || value.deliveredAt || value.delivered_at
  );
}
