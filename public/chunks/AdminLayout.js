import { f as useAdminAuth, j as jsxRuntimeExports, g as branding, N as NavLink, O as Outlet } from '../bundle.js';

const NAV = [{
  to: '/admin',
  label: 'Dashboard',
  end: true
}, {
  to: '/admin/products',
  label: 'Products'
}, {
  to: '/admin/content',
  label: 'Product Content'
}, {
  to: '/admin/orders',
  label: 'Orders'
}, {
  to: '/admin/pricing',
  label: 'Pricing'
}, {
  to: '/admin/variants',
  label: 'Variants'
}, {
  to: '/admin/creators',
  label: 'Creator Program'
}, {
  to: '/admin/creator-terms',
  label: 'Creator Terms'
}, {
  to: '/admin/attribution',
  label: 'Attribution'
}, {
  to: '/admin/kyc',
  label: 'Creator KYC'
}, {
  to: '/admin/payouts',
  label: 'Creator Payouts'
}, {
  to: '/admin/categories',
  label: 'Categories'
}, {
  to: '/admin/hero-slides',
  label: 'Hero Slides'
}, {
  to: '/admin/promotions',
  label: 'Promotions'
}, {
  to: '/admin/homepage',
  label: 'Homepage'
}, {
  to: '/admin/category-experience',
  label: 'Category Experience'
}, {
  to: '/admin/branding',
  label: 'Branding'
}, {
  to: '/admin/appearance',
  label: 'Storefront Appearance'
}, {
  to: '/admin/settings',
  label: 'Settings'
}, {
  to: '/admin/legal-pages',
  label: 'Legal Pages',
  end: true
}, ...[['privacy', 'Privacy Policy'], ['terms', 'Terms & Conditions'], ['returns', 'Returns & Refunds'], ['contact', 'Contact & help'], ['grievance', 'Grievance Redressal']].map(([id, label]) => ({
  to: '/admin/legal-pages/' + id,
  label
}))];
function AdminLayout() {
  const {
    signOut,
    session
  } = useAdminAuth();
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    className: "adm",
    children: [/*#__PURE__*/jsxRuntimeExports.jsxs("aside", {
      className: "adm__side",
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm__brand",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
          className: "adm__brand-mark",
          children: "SL"
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
            children: branding.siteName
          }), /*#__PURE__*/jsxRuntimeExports.jsx("em", {
            children: "Admin"
          })]
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsx("nav", {
        className: "adm__nav",
        children: NAV.map(n => /*#__PURE__*/jsxRuntimeExports.jsx(NavLink, {
          to: n.to,
          end: n.end,
          className: ({
            isActive
          }) => `adm__navitem ${isActive ? 'active' : ''}`,
          children: n.label
        }, n.to))
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm__side-foot",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
          className: "adm__user",
          title: session?.user?.email,
          children: session?.user?.email
        }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          className: "btn btn-outline btn-sm btn-block",
          onClick: signOut,
          children: "Log out"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("a", {
          href: "/",
          className: "adm__viewsite",
          children: "\u2190 View storefront"
        })]
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsx("main", {
      className: "adm__main",
      children: /*#__PURE__*/jsxRuntimeExports.jsx(Outlet, {})
    })]
  });
}

export { AdminLayout as default };
//# sourceMappingURL=AdminLayout.js.map
