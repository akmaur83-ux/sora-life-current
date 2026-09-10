import { r as reactExports, av as adminListConversions, a8 as adminListCreators, j as jsxRuntimeExports, aw as money2, ax as CONVERSION_STATUSES, b as Link, ay as adminGetConversionItems, az as adminGetConversionAudit, aA as adminRefundConversion } from '../bundle.js';

const fmtDateTime = iso => iso ? new Date(iso).toLocaleString('en-IN') : '—';
const STATUS_BADGE = {
  eligible: 'badge-best',
  pending: 'badge-soft',
  cancelled: 'badge-out',
  refunded: 'badge-sale',
  reversed: 'badge-out',
  self_referral: 'badge-soft'
};
function Attribution() {
  const [rows, setRows] = reactExports.useState([]);
  const [creators, setCreators] = reactExports.useState([]);
  const [loading, setLoading] = reactExports.useState(true);
  const [err, setErr] = reactExports.useState('');
  const [msg, setMsg] = reactExports.useState('');
  const [filter, setFilter] = reactExports.useState({
    creatorId: '',
    status: 'all'
  });
  const [expanded, setExpanded] = reactExports.useState(null);
  const [detail, setDetail] = reactExports.useState({
    items: [],
    audit: []
  });
  const [busy, setBusy] = reactExports.useState(false);
  const load = reactExports.useCallback(async () => {
    setLoading(true);
    try {
      const [convs, crs] = await Promise.all([adminListConversions({
        creatorId: filter.creatorId || undefined,
        status: filter.status
      }), creators.length ? Promise.resolve(creators) : adminListCreators()]);
      setRows(convs);
      if (!creators.length) setCreators(crs);
      setErr('');
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [filter, creators]);
  reactExports.useEffect(() => {
    load();
  }, [load]);
  function flash(t) {
    setMsg(t);
    setTimeout(() => setMsg(m => m === t ? '' : m), 2500);
  }
  async function toggle(row) {
    if (expanded === row.id) {
      setExpanded(null);
      return;
    }
    setExpanded(row.id);
    try {
      const [items, audit] = await Promise.all([adminGetConversionItems(row.id), adminGetConversionAudit(row.id)]);
      setDetail({
        items,
        audit
      });
    } catch (e) {
      setErr(e.message || String(e));
    }
  }
  async function refund(row) {
    const input = window.prompt(`Refund amount to reverse from eligible sales for ${row.order_number}?\nCurrent eligible: ${money2(row.eligible_sales)}`, '');
    if (input == null) return;
    const amt = Number(input);
    if (!Number.isFinite(amt) || amt <= 0) {
      setErr('Enter a positive refund amount.');
      return;
    }
    setBusy(true);
    try {
      await adminRefundConversion(row.order_id, amt, 'admin_refund');
      await load();
      flash('Refund recorded; eligible sales adjusted.');
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }
  const totalEligible = rows.filter(r => r.status === 'eligible').reduce((s, r) => s + Number(r.eligible_sales || 0), 0);
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm__head",
      children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h1", {
          children: "Attribution & Sales"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          children: loading ? 'Loading…' : `${rows.length} conversions · ${money2(totalEligible)} eligible (Part 2 — no commission calculated)`
        })]
      })
    }), err && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-banner err",
      children: err
    }), msg && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-banner ok",
      children: msg
    }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "surface",
      style: {
        paddingBlock: 12
      },
      children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-grid2",
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          style: {
            margin: 0
          },
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "Creator"
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("select", {
            className: "select",
            value: filter.creatorId,
            onChange: e => setFilter(f => ({
              ...f,
              creatorId: e.target.value
            })),
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("option", {
              value: "",
              children: "All creators"
            }), creators.map(c => /*#__PURE__*/jsxRuntimeExports.jsxs("option", {
              value: c.id,
              children: [c.display_name, " (", c.creator_code, ")"]
            }, c.id))]
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          style: {
            margin: 0
          },
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "Status"
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("select", {
            className: "select",
            value: filter.status,
            onChange: e => setFilter(f => ({
              ...f,
              status: e.target.value
            })),
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("option", {
              value: "all",
              children: "All statuses"
            }), CONVERSION_STATUSES.map(s => /*#__PURE__*/jsxRuntimeExports.jsx("option", {
              value: s,
              children: s
            }, s))]
          })]
        })]
      })
    }), loading ? /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "muted",
      children: "Loading conversions\u2026"
    }) : rows.length === 0 ? /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-empty",
      children: "No attributed conversions yet. They appear when an order is placed through a creator's tracking link."
    }) : /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-table-wrap",
      children: /*#__PURE__*/jsxRuntimeExports.jsxs("table", {
        className: "adm-table",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("thead", {
          children: /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Order"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Creator"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Campaign"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Link"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              className: "adm-items__amt",
              children: "Eligible"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Status"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Attributed"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {})]
          })
        }), /*#__PURE__*/jsxRuntimeExports.jsx("tbody", {
          children: rows.map(r => /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
            children: [/*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
              className: expanded === r.id ? 'adm-order-row--open' : '',
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("td", {
                children: /*#__PURE__*/jsxRuntimeExports.jsx(Link, {
                  to: `/invoice/${r.order_number}`,
                  className: "adm-mono adm-link",
                  children: r.order_number
                })
              }), /*#__PURE__*/jsxRuntimeExports.jsxs("td", {
                children: [r.creator?.display_name, /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                  className: "hint",
                  style: {
                    display: 'block'
                  },
                  children: r.creator?.creator_code
                })]
              }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                children: r.campaign?.campaign_code || '—'
              }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                className: "adm-mono",
                children: r.link?.public_code || '—'
              }), /*#__PURE__*/jsxRuntimeExports.jsxs("td", {
                className: "adm-items__amt",
                children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
                  className: "adm-price",
                  children: money2(r.eligible_sales)
                }), Number(r.refunded_amount) > 0 && /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
                  className: "hint",
                  style: {
                    display: 'block'
                  },
                  children: ["\u2212", money2(r.refunded_amount), " refunded"]
                })]
              }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                children: /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                  className: `badge ${STATUS_BADGE[r.status] || 'badge-soft'}`,
                  children: r.status
                })
              }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                children: fmtDateTime(r.attributed_at)
              }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                  className: "adm-rowacts",
                  children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
                    className: "btn btn-sm btn-light",
                    onClick: () => toggle(r),
                    children: expanded === r.id ? 'Hide' : 'Items'
                  }), (r.status === 'eligible' || r.status === 'pending') && /*#__PURE__*/jsxRuntimeExports.jsx("button", {
                    className: "btn btn-sm btn-light",
                    onClick: () => refund(r),
                    disabled: busy,
                    children: "Refund"
                  })]
                })
              })]
            }, r.id), expanded === r.id && /*#__PURE__*/jsxRuntimeExports.jsx("tr", {
              className: "adm-order-detail",
              children: /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                colSpan: 8,
                children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                  className: "adm-order-detail__grid",
                  children: [/*#__PURE__*/jsxRuntimeExports.jsxs("section", {
                    className: "adm-order-block adm-order-block--wide",
                    children: [/*#__PURE__*/jsxRuntimeExports.jsx("h3", {
                      children: "Items (product / variant level)"
                    }), /*#__PURE__*/jsxRuntimeExports.jsxs("table", {
                      className: "adm-items",
                      children: [/*#__PURE__*/jsxRuntimeExports.jsx("thead", {
                        children: /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
                          children: [/*#__PURE__*/jsxRuntimeExports.jsx("th", {
                            children: "Product"
                          }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                            children: "Variant"
                          }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                            className: "adm-items__qty",
                            children: "Qty"
                          }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                            className: "adm-items__amt",
                            children: "Line"
                          }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                            className: "adm-items__amt",
                            children: "Eligible"
                          })]
                        })
                      }), /*#__PURE__*/jsxRuntimeExports.jsx("tbody", {
                        children: detail.items.map(it => /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
                          children: [/*#__PURE__*/jsxRuntimeExports.jsxs("td", {
                            children: [it.product_name_snapshot, /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                              className: "hint",
                              style: {
                                display: 'block'
                              },
                              children: it.product_id
                            })]
                          }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                            children: it.variant_label_snapshot || '—'
                          }), /*#__PURE__*/jsxRuntimeExports.jsxs("td", {
                            className: "adm-items__qty",
                            children: ["\xD7 ", it.quantity]
                          }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                            className: "adm-items__amt",
                            children: money2(it.line_amount)
                          }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                            className: "adm-items__amt adm-price",
                            children: money2(it.eligible_amount)
                          })]
                        }, it.id))
                      })]
                    })]
                  }), /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
                    className: "adm-order-block",
                    children: [/*#__PURE__*/jsxRuntimeExports.jsx("h3", {
                      children: "Eligible-sales breakdown"
                    }), /*#__PURE__*/jsxRuntimeExports.jsxs("dl", {
                      className: "adm-kv",
                      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                        children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
                          children: "Gross item sales"
                        }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
                          children: money2(r.gross_item_sales)
                        })]
                      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                        children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
                          children: "Discounts"
                        }), /*#__PURE__*/jsxRuntimeExports.jsxs("dd", {
                          children: ["\u2212", money2(r.discounts)]
                        })]
                      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                        children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
                          children: "Tax (excluded)"
                        }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
                          children: money2(r.tax)
                        })]
                      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                        children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
                          children: "Shipping (excluded)"
                        }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
                          children: money2(r.shipping)
                        })]
                      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                        children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
                          children: "Refunded"
                        }), /*#__PURE__*/jsxRuntimeExports.jsxs("dd", {
                          children: ["\u2212", money2(r.refunded_amount)]
                        })]
                      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                        children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
                          children: /*#__PURE__*/jsxRuntimeExports.jsx("strong", {
                            children: "Eligible base"
                          })
                        }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
                          children: /*#__PURE__*/jsxRuntimeExports.jsx("strong", {
                            className: "adm-price",
                            children: money2(r.eligible_sales)
                          })
                        })]
                      })]
                    })]
                  }), /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
                    className: "adm-order-block",
                    children: [/*#__PURE__*/jsxRuntimeExports.jsx("h3", {
                      children: "Attribution"
                    }), /*#__PURE__*/jsxRuntimeExports.jsxs("dl", {
                      className: "adm-kv",
                      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                        children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
                          children: "Matched code"
                        }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
                          className: "adm-mono",
                          children: r.matched_code || '—'
                        })]
                      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                        children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
                          children: "Model"
                        }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
                          children: "last-click"
                        })]
                      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                        children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
                          children: "Qualified"
                        }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
                          children: fmtDateTime(r.qualified_at)
                        })]
                      })]
                    })]
                  }), /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
                    className: "adm-order-block adm-order-block--wide",
                    children: [/*#__PURE__*/jsxRuntimeExports.jsx("h3", {
                      children: "Audit trail"
                    }), /*#__PURE__*/jsxRuntimeExports.jsx("ol", {
                      className: "adm-timeline",
                      children: detail.audit.map(a => /*#__PURE__*/jsxRuntimeExports.jsxs("li", {
                        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("span", {
                          className: "adm-timeline__label",
                          children: [a.from_status || '∅', " \u2192 ", a.to_status, " ", a.reason ? `· ${a.reason}` : '']
                        }), /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
                          className: "adm-timeline__at",
                          children: [fmtDateTime(a.created_at), a.eligible_delta ? ` · Δ ${money2(a.eligible_delta)}` : '']
                        })]
                      }, a.id))
                    })]
                  })]
                })
              })
            })]
          }))
        })]
      })
    })]
  });
}

export { Attribution as default };
//# sourceMappingURL=Attribution.js.map
