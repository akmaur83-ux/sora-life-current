import ProductBrowser from '../components/ProductBrowser.jsx';
import { products } from '../data/products.js';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';

export default function Shop() {
  return (
    <>
      <div className="pagehead">
        <div className="container">
          <nav className="crumbs"><Link to="/">Home</Link><Icon name="chevronRight" size={14} /><span>Shop</span></nav>
          <h1 className="serif">All products</h1>
          <p className="muted">Everything Sora Life makes — wellness, nutrition, hair, skin, beauty and everyday care in one place.</p>
        </div>
      </div>
      <div className="section-sm" style={{ paddingTop: 'var(--sp-8)' }}>
        <ProductBrowser baseProducts={products} />
      </div>
    </>
  );
}
