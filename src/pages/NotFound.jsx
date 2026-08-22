import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';

export default function NotFound() {
  return (
    <div className="container section">
      <div className="state">
        <span className="state-ic"><Icon name="leaf" size={32} /></span>
        <h3 style={{ fontSize: 'var(--text-4xl)' }}>404</h3>
        <p>We couldn't find that page. It may have moved, or the link is out of date.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/" className="btn">Back home</Link>
          <Link to="/shop" className="btn btn-outline">Browse the shop</Link>
        </div>
      </div>
    </div>
  );
}
