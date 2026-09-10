import { r as reactExports, aE as adminListPayouts, j as jsxRuntimeExports, aw as money2, aF as PAYOUT_STATUSES, aG as adminGetPayoutLedger, aH as adminGetPayoutAudit, aI as adminGetKycForCreator, aJ as adminReviewPayout, aK as adminMarkPayoutPaid } from '../bundle.js';

const fmtDateTime = iso => iso ? new Date(iso).toLocaleString('en-IN') : '—';
const STATUS_BADGE = {
  requested: 'badge-soft',
  under_review: 'badge-soft',
  approved: 'badge-best',
  paid: 'badge-best',
  rejected: 'badge-out',
  cancelled: 'badge-out'
};
const STATUS_LABEL = {
  requested: 'Requested',
  under_review: 'Under review',
  approved: 'Approved',
  paid: 'Paid',
  rejected: 'Rejected',
  cancelled: 'Cancelled'
};
const KYC_LABEL = {
  verified: 'Verified',
  pending: 'Under review',
  not_started: 'Not started',
  rejected: 'Rejected',
  needs_update: 'Needs update'
};
function Payouts() {
  const [rows, setRows] = reactExports.useState([]);
  const [loading, setLoading] = reactExports.useState(true);
  const [err, setErr] = reactExports.useState('');
  const [msg, setMsg] = reactExports.useState('');
  const [filter, setFilter] = reactExports.useState('all');
  const [expanded, setExpanded] = reactExports.useState(null);
  const [detail, setDetail] = reactExports.useState({
    ledger: [],
    audit: [],
    kyc: null
  });
  const [busy, setBusy] = reactExports.useState(false);
  const load = reactExports.useCallback(async () => {
    setLoading(true);
    try {
      setRows(await adminListPayouts({
        status: filter
      }));
      setErr('');
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [filter]);
  reactExports.useEffect(() => {
    load();
  }, [load]);
  function flash(t) {
    setMsg(t);
    setTimeout(() => setMsg(m => m === t ? '' : m), 3000);
  }
  async function toggle(row) {
    if (expanded === row.id) {
      setExpanded(null);
      return;
    }
    setExpanded(row.id);
    setDetail({
      ledger: [],
      audit: [],
      kyc: null
    });
    try {
      const [ledger, audit, kyc] = await Promise.all([adminGetPayoutLedger(row.id), adminGetPayoutAudit(row.id), adminGetKycForCreator(row.creator_id)]);
      setDetail({
        ledger,
        audit,
        kyc
      });
    } catch (e) {
      setErr(e.message || String(e));
    }
  }
  async function review(row, action) {
    let notes = null;
    if (action === 'reject') {
      notes = window.prompt('Reason for rejecting this payout (shown to the creator)? The reserved balance is released back to Available.', '');
      if (notes == null) return;
    }
    setBusy(true);
    try {
      const res = await adminReviewPayout(row.id, action, notes);
      if (res && res.ok === false) setErr(mapErr(res.reason));else {
        await load();
        if (expanded === row.id) toggleRefresh(row);
        flash(`Payout ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'moved to review'}.`);
      }
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }
  async function toggleRefresh(row) {
    try {
      const [ledger, audit, kyc] = await Promise.all([adminGetPayoutLedger(row.id), adminGetPayoutAudit(row.id), adminGetKycForCreator(row.creator_id)]);
      setDetail({
        ledger,
        audit,
        kyc
      });
    } catch {/* non-fatal */}
  }
  async function markPaid(row) {
    const reference = window.prompt(`Record the MANUAL payment for ${row.creator?.display_name}.\n\nEnter the bank/UPI transaction reference (required). This does NOT move money — it records that you already paid ${money2(row.requested_amount)} externally.`, '');
    if (reference == null) return;
    if (!reference.trim()) {
      setErr('A transaction reference is required to mark a payout paid.');
      return;
    }
    const amt = Number(row.requested_amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setErr('This payout has an invalid approved amount.');
      return;
    }
    if (!window.confirm(`Confirm: you have already transferred ${money2(amt)} to ${row.creator?.display_name} (ref ${reference.trim()}). Mark this payout as PAID?`)) return;
    setBusy(true);
    try {
      const res = await adminMarkPayoutPaid(row.id, amt, reference.trim(), null);
      if (res && res.ok === false) setErr(mapErr(res.reason, row));else if (res && res.noop === 'already_paid') {
        await load();
        flash('Already marked paid — no change (idempotent).');
      } else {
        await load();
        if (expanded === row.id) toggleRefresh(row);
        flash('Payout marked paid and settled in the ledger.');
      }
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }
  const totals = rows.reduce((a, r) => {
    a[r.status] = (a[r.status] || 0) + 1;
    if (['requested', 'under_review', 'approved'].includes(r.status)) a.outstanding += Number(r.requested_amount || 0);
    if (r.status === 'paid') a.paid += Number(r.paid_amount ?? r.requested_amount ?? 0);
    return a;
  }, {
    outstanding: 0,
    paid: 0
  });
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm__head",
      children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h1", {
          children: "Creator Payouts"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          children: loading ? 'Loading…' : `${rows.length} requests · ${money2(totals.outstanding)} outstanding · ${money2(totals.paid)} paid`
        })]
      })
    }), err && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-banner err",
      children: err
    }), msg && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-banner ok",
      children: msg
    }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-chipbar",
      children: ['all', ...PAYOUT_STATUSES].map(s => /*#__PURE__*/jsxRuntimeExports.jsxs("button", {
        className: `adm-chip ${filter === s ? 'active' : ''}`,
        onClick: () => {
          setFilter(s);
          setExpanded(null);
        },
        children: [s === 'all' ? 'All' : STATUS_LABEL[s], s !== 'all' && totals[s] ? ` (${totals[s]})` : '']
      }, s))
    }), loading ? /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "muted",
      children: "Loading payout requests\u2026"
    }) : rows.length === 0 ? /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm-empty",
      children: ["No payout requests", filter !== 'all' ? ` with status “${STATUS_LABEL[filter]}”` : ' yet', ". They appear when a verified creator requests a payout during the monthly window."]
    }) : /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-payout-grid",
      children: rows.map(r => {
        const snap = r.payout_method_snapshot || {};
        const open = expanded === r.id;
        return /*#__PURE__*/jsxRuntimeExports.jsxs("article", {
          className: `surface adm-payout-card ${open ? 'is-open' : ''}`,
          children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "adm-payout-card__head",
            children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
              children: [/*#__PURE__*/jsxRuntimeExports.jsxs("h3", {
                children: [r.creator?.display_name || 'Creator', " ", /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                  className: "hint adm-mono",
                  children: r.creator?.creator_code
                })]
              }), /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
                className: "hint",
                children: [r.payout_period, " \xB7 requested ", fmtDateTime(r.requested_at)]
              })]
            }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
              className: "adm-payout-card__amt",
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
                className: "adm-price",
                children: money2(r.status === 'paid' ? r.paid_amount ?? r.requested_amount : r.requested_amount)
              }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                className: `badge ${STATUS_BADGE[r.status] || 'badge-soft'}`,
                children: STATUS_LABEL[r.status] || r.status
              })]
            })]
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "adm-payout-card__quick",
            children: [/*#__PURE__*/jsxRuntimeExports.jsxs("span", {
              children: ["Method: ", /*#__PURE__*/jsxRuntimeExports.jsx("strong", {
                children: snap.method === 'upi' ? 'UPI' : snap.method === 'bank' ? 'Bank' : '—'
              })]
            }), /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
              children: [snap.method === 'upi' ? snap.upi : snap.account, snap.method === 'bank' && snap.ifsc ? ` · ${snap.ifsc}` : '']
            }), r.payment_reference && /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
              children: ["Ref: ", /*#__PURE__*/jsxRuntimeExports.jsx("strong", {
                className: "adm-mono",
                children: r.payment_reference
              })]
            })]
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "adm-payout-card__acts",
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
              className: "btn btn-sm btn-light",
              onClick: () => toggle(r),
              children: open ? 'Hide detail' : 'Review detail'
            }), (r.status === 'requested' || r.status === 'under_review') && /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
              children: [r.status === 'requested' && /*#__PURE__*/jsxRuntimeExports.jsx("button", {
                className: "btn btn-sm btn-light",
                disabled: busy,
                onClick: () => review(r, 'review'),
                children: "Mark under review"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
                className: "btn btn-sm",
                disabled: busy,
                onClick: () => review(r, 'approve'),
                children: "Approve"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
                className: "btn btn-sm btn-light",
                disabled: busy,
                onClick: () => review(r, 'reject'),
                children: "Reject"
              })]
            }), r.status === 'approved' && /*#__PURE__*/jsxRuntimeExports.jsx("button", {
              className: "btn btn-sm",
              disabled: busy,
              onClick: () => markPaid(r),
              children: "Mark as paid\u2026"
            })]
          }), open && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "adm-payout-detail",
            children: [/*#__PURE__*/jsxRuntimeExports.jsxs("section", {
              className: "adm-order-block",
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("h3", {
                children: "KYC & payout destination"
              }), detail.kyc ? /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
                children: [/*#__PURE__*/jsxRuntimeExports.jsx("p", {
                  className: "adm-payout-kyc",
                  children: /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
                    className: `badge ${detail.kyc.identity_status === 'verified' ? 'badge-best' : 'badge-out'}`,
                    children: ["KYC: ", KYC_LABEL[detail.kyc.identity_status] || detail.kyc.identity_status]
                  })
                }), /*#__PURE__*/jsxRuntimeExports.jsxs("dl", {
                  className: "adm-kv",
                  children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                    children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
                      children: "Legal name"
                    }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
                      children: detail.kyc.legal_name || '—'
                    })]
                  }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                    children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
                      children: "PAN"
                    }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
                      className: "adm-mono",
                      children: detail.kyc.pan_masked || '—'
                    })]
                  }), snap.method === 'bank' ? /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
                    children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                      children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
                        children: "Account holder"
                      }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
                        children: snap.account_holder || detail.kyc.payout_account_holder || '—'
                      })]
                    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                      children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
                        children: "Account"
                      }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
                        className: "adm-mono",
                        children: snap.account || detail.kyc.payout_account_masked || '—'
                      })]
                    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                      children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
                        children: "IFSC"
                      }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
                        className: "adm-mono",
                        children: snap.ifsc || detail.kyc.ifsc_masked || '—'
                      })]
                    })]
                  }) : /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                    children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
                      children: "UPI"
                    }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
                      className: "adm-mono",
                      children: snap.upi || detail.kyc.upi_masked || '—'
                    })]
                  })]
                }), /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
                  className: "hint",
                  children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
                    "aria-hidden": true,
                    children: "\uD83D\uDD12"
                  }), " Masked only. Pay through your secure banking channel using the real details on file there."]
                })]
              }) : /*#__PURE__*/jsxRuntimeExports.jsx("p", {
                className: "muted",
                children: "No KYC on file for this creator."
              })]
            }), /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
              className: "adm-order-block",
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("h3", {
                children: "Reserved ledger entries"
              }), detail.ledger.length === 0 ? /*#__PURE__*/jsxRuntimeExports.jsx("p", {
                className: "muted",
                children: "No ledger entries linked to this payout."
              }) : /*#__PURE__*/jsxRuntimeExports.jsxs("table", {
                className: "adm-items",
                children: [/*#__PURE__*/jsxRuntimeExports.jsx("thead", {
                  children: /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
                    children: [/*#__PURE__*/jsxRuntimeExports.jsx("th", {
                      children: "Order"
                    }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                      children: "Type"
                    }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                      children: "Status"
                    }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                      className: "adm-items__amt",
                      children: "Amount"
                    })]
                  })
                }), /*#__PURE__*/jsxRuntimeExports.jsx("tbody", {
                  children: detail.ledger.map(l => /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
                    children: [/*#__PURE__*/jsxRuntimeExports.jsx("td", {
                      className: "adm-mono",
                      children: l.order_id ? String(l.order_id).slice(0, 8) : '—'
                    }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                      children: l.type
                    }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                      children: l.status
                    }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                      className: "adm-items__amt adm-price",
                      children: money2(l.amount)
                    })]
                  }, l.id))
                })]
              }), /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
                className: "adm-payout-detail__sum",
                children: ["Reserved total: ", /*#__PURE__*/jsxRuntimeExports.jsx("strong", {
                  children: money2(detail.ledger.reduce((s, l) => s + Number(l.amount || 0), 0))
                }), ' ', "\xB7 Requested: ", /*#__PURE__*/jsxRuntimeExports.jsx("strong", {
                  children: money2(r.requested_amount)
                })]
              })]
            }), /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
              className: "adm-order-block adm-order-block--wide",
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("h3", {
                children: "Status history"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("ol", {
                className: "adm-timeline",
                children: detail.audit.length === 0 ? /*#__PURE__*/jsxRuntimeExports.jsx("li", {
                  children: /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                    className: "adm-timeline__label muted",
                    children: "No history"
                  })
                }) : detail.audit.map((a, i) => /*#__PURE__*/jsxRuntimeExports.jsxs("li", {
                  children: [/*#__PURE__*/jsxRuntimeExports.jsxs("span", {
                    className: "adm-timeline__label",
                    children: [a.from_status || '∅', " \u2192 ", a.to_status, a.note ? ` · ${a.note}` : '', a.reference ? ` · ref ${a.reference}` : '']
                  }), /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
                    className: "adm-timeline__at",
                    children: [fmtDateTime(a.created_at), a.amount != null ? ` · ${money2(a.amount)}` : '']
                  })]
                }, i))
              })]
            })]
          })]
        }, r.id);
      })
    })]
  });
}
function mapErr(reason, row) {
  return {
    reference_required: 'A transaction reference is required to mark a payout paid.',
    invalid_amount: 'This payout has an invalid approved amount.',
    exact_amount_required: `Only the exact approved ${row ? money2(row.requested_amount) : 'amount'} can be settled.`,
    reservation_mismatch: 'The reserved ledger amount does not match this payout. Reject it to release the balance; do not record payment.',
    already_paid_mismatch: 'This payout is already paid with different settlement details.',
    not_approved: 'A payout must be approved before it can be marked paid.',
    duplicate_reference: 'That transaction reference is already used on another payout.',
    bad_action: 'Unknown action.',
    bad_transition: 'That status change isn’t allowed from the current state.',
    terminal: 'This payout is already finalised.',
    not_found: 'Payout not found.'
  }[reason] || reason || 'Something went wrong.';
}

export { Payouts as default };
//# sourceMappingURL=Payouts.js.map
