import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Icon from './Icon.jsx';
import { useInstallMode, promptInstall, IosInstallGuide } from './InstallApp.jsx';
import { countVisit, shouldNudge, readApp, writeApp, isStandalone, NUDGE_AFTER_MS } from '../lib/appMode.js';

// ============================================================
// "Get the SORA app" card (owner, 2026-11-13: the app, deep). On a phone, from the
// second day someone visits, once the browser can install the site (or on iPhone
// Safari), a small card at the foot of the screen offers the app. "Not now" keeps
// it away for 30 days; installing ends it. Never on the cart, checkout, sign-in or
// admin, never while the promo card is showing, never inside the app itself.
// ============================================================
const QUIET = /^\/(cart|checkout|admin|creator|invoice|passport|login|account|fashion\/cart|homeliving\/cart|grocery\/cart|grocery\/checkout)(\/|$)/;

export default function AppNudge({ foot = 0 }) {
  const { pathname } = useLocation();
  const mode = useInstallMode();
  const [show, setShow] = useState(false);
  const [guide, setGuide] = useState(false);

  // This visit counted once a day.
  useEffect(() => { writeApp(countVisit(readApp(), Date.now())); }, []);

  useEffect(() => {
    if (!mode || QUIET.test(pathname)) { setShow(false); return undefined; }
    const t = setTimeout(() => {
      const phone = window.matchMedia?.('(max-width: 767px)').matches;
      const promoUp = !!document.querySelector('.hx-pcard:not(.hx-acard)');
      if (!promoUp && shouldNudge(readApp(), { now: Date.now(), canInstall: true, standalone: isStandalone(), phone })) setShow(true);
    }, NUDGE_AFTER_MS);
    return () => clearTimeout(t);
  }, [mode, pathname]);

  if (!show && !guide) return null;
  const close = () => { writeApp({ ...(readApp() || {}), dismissed: Date.now() }); setShow(false); };
  const install = async () => {
    if (mode === 'ios') { setGuide(true); setShow(false); writeApp({ ...(readApp() || {}), dismissed: Date.now() }); return; }
    const ok = await promptInstall();
    if (ok) setShow(false); else close();
  };
  return (
    <>
      {show && (
        <div className="hx-pcard hx-acard" role="dialog" aria-labelledby="hx-acard-t" style={{ '--pcard-foot': `${foot}px` }}>
          <img className="hx-acard__ic" src="/assets/app-icon-192.png" alt="" width="40" height="40" />
          <div className="hx-pcard__body">
            <p className="hx-pcard__t" id="hx-acard-t">Get the SORA app</p>
            <p className="hx-pcard__s">One tap from your home screen, full screen, and what you’ve browsed opens even offline.</p>
            <div className="hx-acard__go">
              <button type="button" className="hx-acard__btn" onClick={install}>{mode === 'ios' ? 'Show me how' : 'Install'}</button>
              <button type="button" className="hx-acard__later" onClick={close}>Not now</button>
            </div>
          </div>
          <button type="button" className="hx-pcard__x" onClick={close} aria-label="Close"><Icon name="x" size={16} /></button>
        </div>
      )}
      {guide && <IosInstallGuide onClose={() => setGuide(false)} />}
    </>
  );
}
