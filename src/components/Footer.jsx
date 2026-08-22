import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import Logo from './Logo.jsx';
import { categories } from '../data/categories.js';

export default function Footer() {
  return (
    <footer className="ftr">
      <div className="container">
        <div className="ftr__top">
          <div className="ftr__brand">
            <Logo light />
            <p>Modern wellness, beauty and everyday care — cleanly formulated, honestly made, and delivered to your door.</p>
            <div className="ftr__social">
              <a href="#" className="iconbtn" aria-label="Instagram"><Icon name="instagram" size={20} /></a>
              <a href="#" className="iconbtn" aria-label="Facebook"><Icon name="facebook" size={20} /></a>
              <a href="#" className="iconbtn" aria-label="Twitter"><Icon name="twitter" size={20} /></a>
            </div>
          </div>

          <div className="ftr__col">
            <h4>Shop</h4>
            {categories.slice(0, 6).map((c) => (
              <Link key={c.slug} to={`/category/${c.slug}`}>{c.name}</Link>
            ))}
            <Link to="/shop">All products</Link>
          </div>

          <div className="ftr__col">
            <h4>Care</h4>
            <Link to="/account">My account</Link>
            <Link to="/account">Track my order</Link>
            <Link to="/cart">My cart</Link>
            <Link to="/wishlist">Wishlist</Link>
            <a href="#">Shipping & returns</a>
            <a href="#">Contact us</a>
          </div>

          <div className="ftr__col">
            <h4>Our promise</h4>
            <a href="#">Clean ingredients</a>
            <a href="#">Sustainability</a>
            <a href="#">Cruelty-free</a>
            <a href="#">Journal</a>
            <a href="#">About Sora Life</a>
          </div>
        </div>

        <div className="ftr__trust">
          <span><Icon name="leaf" size={17} /> Clean, transparent formulas</span>
          <span><Icon name="shield" size={17} /> Dermatologist &amp; lab tested</span>
          <span><Icon name="truck" size={17} /> Carbon-neutral delivery</span>
          <span><Icon name="return" size={17} /> Easy 15-day returns</span>
        </div>

        <div className="ftr__bottom">
          <p>© {new Date().getFullYear()} Sora Life. A demo storefront — placeholder products for design preview.</p>
          <div className="ftr__legal">
            <a href="#">Privacy</a><a href="#">Terms</a><a href="#">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
