import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import Shop from './pages/Shop.jsx';
import Category from './pages/Category.jsx';
import Product from './pages/Product.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import Account from './pages/Account.jsx';
import Wishlist from './pages/Wishlist.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/category/:slug" element={<Category />} />
        <Route path="/product/:slug" element={<Product />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/account" element={<Account />} />
        <Route path="/account/:tab" element={<Account />} />
        <Route path="/wishlist" element={<Wishlist />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
