import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useCustomerAuth } from '../lib/customerAuth.jsx';
import { captureAttributionFromUrl, linkAttributionToAccount } from '../lib/creatorAttribution.js';

/**
 * Creator Program attribution capture. Renders nothing.
 *
 * Mounted once at the app root: when a visitor lands with ?ref= (and possibly
 * &trk= / &campaign=), the code is sent to the server, which resolves it and
 * records the event. When that visitor later signs in, the attribution is
 * linked to their account so Part 2 can follow visitor → signup → order.
 *
 * Everything here is best-effort and non-blocking — tracking must never be
 * able to break a page render.
 */
export default function CreatorAttribution() {
  const { search } = useLocation();
  const { session } = useCustomerAuth();
  const linkedFor = useRef(null);

  useEffect(() => {
    captureAttributionFromUrl(search);
  }, [search]);

  useEffect(() => {
    const token = session?.access_token;
    const uid = session?.user?.id;
    if (!token || !uid || linkedFor.current === uid) return;
    linkedFor.current = uid;
    linkAttributionToAccount(token);
  }, [session]);

  return null;
}
