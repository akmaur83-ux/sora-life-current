import { r as reactExports, z as adminListOrders, j as jsxRuntimeExports, s as money, A as fulfillmentStatusLabel, b as Link, F as FULFILLMENT_STATUSES, B as validateFulfillmentInput, D as adminUpdateOrderFulfillment } from '../bundle.js';

const STATUS_BADGE = {
  paid: 'badge-best',
  pending: 'badge-soft',
  failed: 'badge-sale',
  cancelled: 'badge-out'
};
const FULFILLMENT_BADGE = {
  shipped: 'badge-soft',
  delivered: 'badge-best',
  cancelled: 'badge-out'
};

// Build a clean, multi-line postal address from whatever fields an order
// actually has. Works for old orders created before some fields existed —
// missing pieces are simply skipped.
function formatAddress(c = {}) {
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
  const cityLine = [c.city, c.state].filter(Boolean).join(', ');
  const cityPin = [cityLine, c.pin].filter(Boolean).join(' - ');
  return [name, c.address, c.apartment, c.landmark && `Landmark: ${c.landmark}`, cityPin, c.phone && `Phone: ${c.phone}`].filter(Boolean).join('\n');
}
function hasAddress(c = {}) {
  return Boolean(c.address || c.city || c.pin);
}
const dt = iso => iso ? new Date(iso).toLocaleString('en-IN') : null;

// The audit trail an order can prove from its own columns. Steps with no
// timestamp are not shown — nothing here is inferred or back-dated.
function timeline(o) {
  const steps = [['Order placed', o.created_at], ['Payment received', o.paid_at], ['Invoice generated', o.invoiced_at], ['Shipped', o.shipped_at], ['Delivered', o.delivered_at], ['Cancelled', o.cancelled_at]];
  return steps.filter(([, at]) => Boolean(at)).map(([label, at]) => [label, dt(at)]);
}

// One row of the money breakdown. Rendered only when the order genuinely
// carries the figure, so a zero is never mistaken for a real charge.
function Money({
  label,
  value,
  tone,
  strong
}) {
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    className: `adm-bill__row${tone ? ` is-${tone}` : ''}${strong ? ' is-strong' : ''}`,
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
      children: label
    }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
      children: value
    })]
  });
}
function Orders() {
  const [orders, setOrders] = reactExports.useState([]);
  const [loading, setLoading] = reactExports.useState(true);
  const [err, setErr] = reactExports.useState('');
  const [expandedId, setExpandedId] = reactExports.useState(null);
  const [copiedId, setCopiedId] = reactExports.useState(null);
  reactExports.useEffect(() => {
    adminListOrders().then(setOrders).catch(e => setErr(e.message || String(e))).finally(() => setLoading(false));
  }, []);
  const paidCount = orders.filter(o => o.payment_status === 'paid').length;
  async function copyAddress(order) {
    const text = formatAddress(order.customer);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API can be unavailable (insecure context) — fall back.
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {/* ignore */}
      document.body.removeChild(ta);
    }
    setCopiedId(order.id);
    setTimeout(() => setCopiedId(c => c === order.id ? null : c), 1600);
  }
  function updateOrder(patch) {
    setOrders(current => current.map(order => order.id === patch.id ? {
      ...order,
      ...patch
    } : order));
  }
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm__head",
      children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h1", {
          children: "Orders"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          children: loading ? 'Loading…' : `${orders.length} orders · ${paidCount} paid`
        })]
      })
    }), err && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm-banner err",
      children: [err, /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        style: {
          marginTop: 8,
          fontSize: 12
        },
        children: ["If the orders table does not exist yet, run", /*#__PURE__*/jsxRuntimeExports.jsx("code", {
          children: " supabase/migrations/0003_orders.sql "
        }), " in the Supabase SQL editor."]
      })]
    }), loading ? /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "muted",
      children: "Loading orders\u2026"
    }) : orders.length === 0 ? /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-empty",
      children: "No orders yet. Orders appear here once a customer completes checkout."
    }) : /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-table-wrap",
      children: /*#__PURE__*/jsxRuntimeExports.jsxs("table", {
        className: "adm-table",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("thead", {
          children: /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Order"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Placed"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Customer"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Amount"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Method"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Payment"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Fulfillment"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {})]
          })
        }), /*#__PURE__*/jsxRuntimeExports.jsx("tbody", {
          children: orders.map(o => {
            const c = o.customer || {};
            const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || '—';
            const open = expandedId === o.id;
            const b = o.billing && typeof o.billing === 'object' ? o.billing : null;
            const tax = b?.tax || null;
            return /*#__PURE__*/jsxRuntimeExports.jsxs(reactExports.Fragment, {
              children: [/*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
                className: open ? 'adm-order-row--open' : '',
                children: [/*#__PURE__*/jsxRuntimeExports.jsxs("td", {
                  children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
                    children: o.order_number
                  }), o.razorpay_payment_id && /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                    className: "hint",
                    style: {
                      display: 'block'
                    },
                    children: o.razorpay_payment_id
                  })]
                }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                  children: new Date(o.created_at).toLocaleString('en-IN')
                }), /*#__PURE__*/jsxRuntimeExports.jsxs("td", {
                  children: [name, c.email && /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                    className: "hint",
                    style: {
                      display: 'block'
                    },
                    children: c.email
                  })]
                }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                  children: /*#__PURE__*/jsxRuntimeExports.jsx("strong", {
                    children: money((o.amount_paise || 0) / 100)
                  })
                }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                  children: o.payment_method === 'cod' ? 'Cash on delivery' : 'Razorpay'
                }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                  children: /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                    className: `badge ${STATUS_BADGE[o.payment_status] || 'badge-soft'}`,
                    children: o.payment_status
                  })
                }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                  children: /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                    className: `badge ${FULFILLMENT_BADGE[o.fulfillment_status] || 'badge-soft'}`,
                    children: fulfillmentStatusLabel(o.fulfillment_status) || 'Not set'
                  })
                }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                  children: /*#__PURE__*/jsxRuntimeExports.jsx("button", {
                    className: "btn btn-sm btn-light",
                    onClick: () => setExpandedId(open ? null : o.id),
                    children: open ? 'Hide' : 'View details'
                  })
                })]
              }), open && /*#__PURE__*/jsxRuntimeExports.jsx("tr", {
                className: "adm-order-detail",
                children: /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                  colSpan: 8,
                  children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                    className: "adm-order-detail__grid",
                    children: [/*#__PURE__*/jsxRuntimeExports.jsxs("section", {
                      className: "adm-order-block",
                      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                        className: "adm-order-block__head",
                        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h3", {
                          children: "Delivery address"
                        }), hasAddress(c) && /*#__PURE__*/jsxRuntimeExports.jsx("button", {
                          className: "btn btn-sm btn-light",
                          onClick: () => copyAddress(o),
                          children: copiedId === o.id ? 'Copied ✓' : 'Copy address'
                        })]
                      }), hasAddress(c) ? /*#__PURE__*/jsxRuntimeExports.jsx("address", {
                        className: "adm-address",
                        children: formatAddress(c)
                      }) : /*#__PURE__*/jsxRuntimeExports.jsx("p", {
                        className: "muted",
                        children: "No delivery address was recorded for this order."
                      })]
                    }), /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
                      className: "adm-order-block",
                      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h3", {
                        children: "Contact"
                      }), /*#__PURE__*/jsxRuntimeExports.jsxs("dl", {
                        className: "adm-kv",
                        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                          children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
                            children: "Name"
                          }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
                            children: name
                          })]
                        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                          children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
                            children: "Phone"
                          }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
                            children: c.phone || '—'
                          })]
                        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                          children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
                            children: "Email"
                          }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
                            children: c.email || '—'
                          })]
                        })]
                      })]
                    }), /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
                      className: "adm-order-block",
                      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h3", {
                        children: "Order & payment"
                      }), /*#__PURE__*/jsxRuntimeExports.jsxs("dl", {
                        className: "adm-kv",
                        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                          children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
                            children: "Order ID"
                          }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
                            children: o.order_number
                          })]
                        }), o.invoice_number && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                          children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
                            children: "Invoice no."
                          }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
                            children: o.invoice_number
                          })]
                        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                          children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
                            children: "Placed"
                          }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
                            children: dt(o.created_at)
                          })]
                        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                          children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
                            children: "Method"
                          }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
                            children: o.payment_method === 'cod' ? 'Cash on delivery' : 'Razorpay'
                          })]
                        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                          children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
                            children: "Payment"
                          }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
                            children: /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                              className: `badge ${STATUS_BADGE[o.payment_status] || 'badge-soft'}`,
                              children: o.payment_status
                            })
                          })]
                        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                          children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
                            children: "Delivery"
                          }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
                            children: o.delivery_method || '—'
                          })]
                        }), o.razorpay_payment_id && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                          children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
                            children: "Transaction ID"
                          }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
                            className: "adm-mono",
                            children: o.razorpay_payment_id
                          })]
                        }), o.razorpay_order_id && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                          children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
                            children: "Gateway order"
                          }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
                            className: "adm-mono",
                            children: o.razorpay_order_id
                          })]
                        }), o.failure_reason && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                          children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
                            children: "Failure"
                          }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
                            children: o.failure_reason
                          })]
                        })]
                      }), /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
                        to: `/invoice/${o.order_number}`,
                        className: "btn btn-sm",
                        style: {
                          marginTop: 10
                        },
                        children: "Open invoice"
                      })]
                    }), /*#__PURE__*/jsxRuntimeExports.jsx(FulfillmentEditor, {
                      order: o,
                      onUpdated: updateOrder
                    }), timeline(o).length > 0 && /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
                      className: "adm-order-block",
                      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h3", {
                        children: "Timeline"
                      }), /*#__PURE__*/jsxRuntimeExports.jsx("ol", {
                        className: "adm-timeline",
                        children: timeline(o).map(([label, when]) => /*#__PURE__*/jsxRuntimeExports.jsxs("li", {
                          children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
                            className: "adm-timeline__label",
                            children: label
                          }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                            className: "adm-timeline__at",
                            children: when
                          })]
                        }, label))
                      })]
                    }), /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
                      className: "adm-order-block adm-order-block--wide",
                      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h3", {
                        children: "Items"
                      }), Array.isArray(o.items) && o.items.length ? /*#__PURE__*/jsxRuntimeExports.jsxs("table", {
                        className: "adm-items",
                        children: [/*#__PURE__*/jsxRuntimeExports.jsx("thead", {
                          children: /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
                            children: [/*#__PURE__*/jsxRuntimeExports.jsx("th", {
                              children: "Product"
                            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                              children: "Variant"
                            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                              className: "adm-items__amt",
                              children: "MRP"
                            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                              className: "adm-items__amt",
                              children: "Price"
                            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                              className: "adm-items__qty",
                              children: "Qty"
                            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                              className: "adm-items__amt",
                              children: "Amount"
                            })]
                          })
                        }), /*#__PURE__*/jsxRuntimeExports.jsx("tbody", {
                          children: o.items.map((it, i) => {
                            const unit = Number(it.unit_price) || 0;
                            const mrp = Number(it.unit_mrp) || 0;
                            return /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
                              children: [/*#__PURE__*/jsxRuntimeExports.jsxs("td", {
                                children: [it.name || it.product_id, it.sku && /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                                  className: "hint",
                                  style: {
                                    display: 'block'
                                  },
                                  children: it.sku
                                })]
                              }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                                children: it.variant || '—'
                              }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                                className: "adm-items__amt",
                                children: mrp > unit ? /*#__PURE__*/jsxRuntimeExports.jsx("s", {
                                  children: money(mrp)
                                }) : '—'
                              }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                                className: "adm-items__amt adm-price",
                                children: money(unit)
                              }), /*#__PURE__*/jsxRuntimeExports.jsxs("td", {
                                className: "adm-items__qty",
                                children: ["\xD7 ", it.qty]
                              }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                                className: "adm-items__amt",
                                children: money(Number(it.line_total ?? unit * it.qty) || 0)
                              })]
                            }, i);
                          })
                        })]
                      }) : /*#__PURE__*/jsxRuntimeExports.jsx("p", {
                        className: "muted",
                        children: "No item detail stored for this order."
                      })]
                    }), /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
                      className: "adm-order-block adm-order-block--wide",
                      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h3", {
                        children: "Billing breakdown"
                      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                        className: "adm-bill",
                        children: [b ? /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
                          children: [b.mrpTotal > b.itemTotal && /*#__PURE__*/jsxRuntimeExports.jsx(Money, {
                            label: "MRP total",
                            value: money(b.mrpTotal),
                            tone: "mrp"
                          }), /*#__PURE__*/jsxRuntimeExports.jsx(Money, {
                            label: "Item total",
                            value: money(b.itemTotal)
                          }), b.productDiscount > 0 && /*#__PURE__*/jsxRuntimeExports.jsx(Money, {
                            label: "Product discount",
                            value: `-${money(b.productDiscount)}`,
                            tone: "save"
                          }), b.couponDiscount > 0 && /*#__PURE__*/jsxRuntimeExports.jsx(Money, {
                            label: `Coupon discount${b.coupon?.code ? ` (${b.coupon.code})` : ''}`,
                            value: `-${money(b.couponDiscount)}`,
                            tone: "save"
                          }), /*#__PURE__*/jsxRuntimeExports.jsx(Money, {
                            label: "Subtotal",
                            value: money(b.subtotal)
                          }), /*#__PURE__*/jsxRuntimeExports.jsx(Money, {
                            label: "Shipping",
                            value: b.shipping > 0 ? money(b.shipping) : 'FREE'
                          }), b.platformFee > 0 && /*#__PURE__*/jsxRuntimeExports.jsx(Money, {
                            label: "Platform fee",
                            value: money(b.platformFee)
                          }), b.packagingFee > 0 && /*#__PURE__*/jsxRuntimeExports.jsx(Money, {
                            label: "Packaging fee",
                            value: money(b.packagingFee)
                          }), tax && /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
                            children: [/*#__PURE__*/jsxRuntimeExports.jsx(Money, {
                              label: "Taxable amount",
                              value: money(tax.taxableAmount)
                            }), tax.kind === 'cgst_sgst' ? /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
                              children: [/*#__PURE__*/jsxRuntimeExports.jsx(Money, {
                                label: "CGST",
                                value: money(tax.cgst)
                              }), /*#__PURE__*/jsxRuntimeExports.jsx(Money, {
                                label: "SGST",
                                value: money(tax.sgst)
                              })]
                            }) : tax.kind === 'igst' ? /*#__PURE__*/jsxRuntimeExports.jsx(Money, {
                              label: "IGST",
                              value: money(tax.igst)
                            }) : /*#__PURE__*/jsxRuntimeExports.jsx(Money, {
                              label: "GST",
                              value: money(tax.totalTax)
                            })]
                          })]
                        }) : /*#__PURE__*/jsxRuntimeExports.jsx("p", {
                          className: "muted",
                          children: "This order predates the stored billing breakdown. Only the charged total is on record."
                        }), /*#__PURE__*/jsxRuntimeExports.jsx(Money, {
                          label: "Grand total",
                          value: money((o.amount_paise || 0) / 100),
                          strong: true
                        }), tax?.mode === 'inclusive' && /*#__PURE__*/jsxRuntimeExports.jsx("p", {
                          className: "hint",
                          children: "Inclusive of all taxes."
                        })]
                      })]
                    })]
                  })
                })
              })]
            }, o.id);
          })
        })]
      })
    })]
  });
}
function FulfillmentEditor({
  order,
  onUpdated
}) {
  const [form, setForm] = reactExports.useState(() => ({
    fulfillmentStatus: order.fulfillment_status || '',
    carrierName: order.carrier_name || '',
    trackingNumber: order.tracking_number || '',
    trackingUrl: order.tracking_url || ''
  }));
  const [busy, setBusy] = reactExports.useState('');
  const [message, setMessage] = reactExports.useState('');
  const [error, setError] = reactExports.useState('');
  reactExports.useEffect(() => {
    setForm({
      fulfillmentStatus: order.fulfillment_status || '',
      carrierName: order.carrier_name || '',
      trackingNumber: order.tracking_number || '',
      trackingUrl: order.tracking_url || ''
    });
  }, [order.id, order.fulfillment_status, order.carrier_name, order.tracking_number, order.tracking_url]);
  const field = key => event => setForm(current => ({
    ...current,
    [key]: event.target.value
  }));
  async function save(action = 'save') {
    if (busy) return;
    setBusy(action);
    setMessage('');
    setError('');
    try {
      const safe = validateFulfillmentInput(form);
      const updated = await adminUpdateOrderFulfillment(order.id, safe, {
        markShipped: action === 'shipped',
        markDelivered: action === 'delivered'
      });
      onUpdated(updated);
      setMessage(action === 'save' ? 'Fulfillment details saved.' : action === 'shipped' ? 'Order marked shipped.' : 'Order marked delivered.');
    } catch (err) {
      setError(err?.message || 'Fulfillment details could not be saved.');
    } finally {
      setBusy('');
    }
  }
  return /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
    className: "adm-order-block adm-order-block--wide adm-fulfillment",
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("h3", {
      children: "Fulfillment & tracking"
    }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "hint",
      children: "Enter only details supplied by the carrier. A customer tracking link appears only for an explicit public HTTPS URL."
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm-grid2 adm-fulfillment__fields",
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "field",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
          className: "label",
          htmlFor: `fulfillment-status-${order.id}`,
          children: "Fulfillment status"
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("select", {
          id: `fulfillment-status-${order.id}`,
          className: "select",
          value: form.fulfillmentStatus,
          onChange: field('fulfillmentStatus'),
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("option", {
            value: "",
            children: "Not set"
          }), FULFILLMENT_STATUSES.map(status => /*#__PURE__*/jsxRuntimeExports.jsx("option", {
            value: status,
            children: fulfillmentStatusLabel(status)
          }, status))]
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "field",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
          className: "label",
          htmlFor: `carrier-${order.id}`,
          children: "Carrier"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
          id: `carrier-${order.id}`,
          className: "input",
          maxLength: 120,
          value: form.carrierName,
          onChange: field('carrierName'),
          placeholder: "Carrier name"
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "field",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
          className: "label",
          htmlFor: `tracking-number-${order.id}`,
          children: "Tracking number"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
          id: `tracking-number-${order.id}`,
          className: "input",
          maxLength: 160,
          value: form.trackingNumber,
          onChange: field('trackingNumber'),
          placeholder: "Carrier-issued number"
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "field",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
          className: "label",
          htmlFor: `tracking-url-${order.id}`,
          children: "Tracking URL"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
          id: `tracking-url-${order.id}`,
          className: "input",
          type: "url",
          inputMode: "url",
          maxLength: 2048,
          value: form.trackingUrl,
          onChange: field('trackingUrl'),
          placeholder: "https://carrier.example/track/\u2026"
        })]
      })]
    }), error && /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "error-text",
      role: "alert",
      children: error
    }), message && /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "adm-fulfillment__success",
      role: "status",
      children: message
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm-fulfillment__actions",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
        type: "button",
        className: "btn btn-sm",
        disabled: Boolean(busy),
        onClick: () => save('save'),
        children: busy === 'save' ? 'Saving…' : 'Save details'
      }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
        type: "button",
        className: "btn btn-sm btn-light",
        disabled: Boolean(busy),
        onClick: () => save('shipped'),
        children: busy === 'shipped' ? 'Saving…' : 'Mark shipped'
      }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
        type: "button",
        className: "btn btn-sm btn-light",
        disabled: Boolean(busy),
        onClick: () => save('delivered'),
        children: busy === 'delivered' ? 'Saving…' : 'Mark delivered'
      })]
    })]
  });
}

export { Orders as default };
//# sourceMappingURL=Orders.js.map
