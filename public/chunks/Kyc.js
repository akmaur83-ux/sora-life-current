import { r as reactExports, aB as adminListKyc, aC as KYC_STATUSES, j as jsxRuntimeExports, aD as KYC_SIGNED_URL_SECONDS, aE as adminSetKycStatus, aF as KYC_DOCUMENT_KINDS, aG as kycDocumentState, aH as adminKycDocumentUrl, aI as adminListKycAudit } from '../bundle.js';

const fmtDateTime = iso => iso ? new Date(iso).toLocaleString('en-IN') : '—';
const STATUS_BADGE = {
  verified: 'badge-best',
  pending: 'badge-soft',
  not_started: 'badge-soft',
  rejected: 'badge-out',
  needs_update: 'badge-sale'
};
const STATUS_LABEL = {
  not_started: 'Not started',
  pending: 'Under review',
  verified: 'Verified',
  rejected: 'Rejected',
  needs_update: 'Needs update'
};
function Kyc() {
  const [rows, setRows] = reactExports.useState([]);
  const [loading, setLoading] = reactExports.useState(true);
  const [err, setErr] = reactExports.useState('');
  const [msg, setMsg] = reactExports.useState('');
  const [filter, setFilter] = reactExports.useState('all');
  const [busy, setBusy] = reactExports.useState(null);
  const load = reactExports.useCallback(async () => {
    setLoading(true);
    try {
      setRows(await adminListKyc());
      setErr('');
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);
  reactExports.useEffect(() => {
    load();
  }, [load]);
  function flash(t) {
    setMsg(t);
    setTimeout(() => setMsg(m => m === t ? '' : m), 2600);
  }
  async function setStatus(row, status) {
    let notes = null;
    if (status === 'rejected' || status === 'needs_update') {
      notes = window.prompt(`Reason for "${STATUS_LABEL[status]}" (shown to the creator)?`, '');
      if (notes == null) return;
    } else if (status === 'verified') {
      if (!window.confirm(`Mark ${row.creator?.display_name || 'this creator'}'s KYC as VERIFIED?\n\nOnly do this after you have genuinely checked their identity and payout details. Verification unlocks payout requests.`)) return;
    }
    setBusy(row.creator_id + status);
    try {
      const res = await adminSetKycStatus(row.creator_id, status, notes);
      if (res && res.ok === false) {
        setErr(res.reason || 'Could not update.');
      } else {
        await load();
        flash(`KYC set to “${STATUS_LABEL[status]}”.`);
      }
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(null);
    }
  }
  const shown = filter === 'all' ? rows : rows.filter(r => r.identity_status === filter);
  const counts = KYC_STATUSES.reduce((a, s) => {
    a[s] = rows.filter(r => r.identity_status === s).length;
    return a;
  }, {});
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm__head",
      children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h1", {
          children: "Creator KYC"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          children: loading ? 'Loading…' : `${rows.length} submitted · ${counts.pending || 0} awaiting review · ${counts.verified || 0} verified`
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
      children: ['all', ...KYC_STATUSES].map(s => /*#__PURE__*/jsxRuntimeExports.jsxs("button", {
        className: `adm-chip ${filter === s ? 'active' : ''}`,
        onClick: () => setFilter(s),
        children: [s === 'all' ? 'All' : STATUS_LABEL[s], s !== 'all' && counts[s] ? ` (${counts[s]})` : '']
      }, s))
    }), loading ? /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "muted",
      children: "Loading KYC submissions\u2026"
    }) : shown.length === 0 ? /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm-empty",
      children: ["No KYC submissions", filter !== 'all' ? ` with status “${STATUS_LABEL[filter]}”` : ' yet', ". They appear when a creator submits their details."]
    }) : /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-kyc-grid",
      children: shown.map(r => {
        const pending = r.identity_status === 'pending' || r.identity_status === 'needs_update' || r.identity_status === 'rejected';
        return /*#__PURE__*/jsxRuntimeExports.jsxs("article", {
          className: "surface adm-kyc-card",
          children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "adm-kyc-card__head",
            children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("h3", {
                children: r.creator?.display_name || 'Creator'
              }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                className: "hint adm-mono",
                children: r.creator?.creator_code || r.creator_id
              })]
            }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
              className: `badge ${STATUS_BADGE[r.identity_status] || 'badge-soft'}`,
              children: STATUS_LABEL[r.identity_status] || r.identity_status
            })]
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("dl", {
            className: "adm-kv adm-kyc-card__kv",
            children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
                children: "Legal name"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
                children: r.legal_name || '—'
              })]
            }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
                children: "PAN"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
                className: "adm-mono",
                children: r.pan_masked || '—'
              })]
            }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
                children: "Method"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
                children: r.payout_method === 'upi' ? 'UPI' : r.payout_method === 'bank' ? 'Bank transfer' : '—'
              })]
            }), r.payout_method === 'bank' && /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
              children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
                  children: "Account holder"
                }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
                  children: r.payout_account_holder || '—'
                })]
              }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
                  children: "Account"
                }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
                  className: "adm-mono",
                  children: r.payout_account_masked || '—'
                })]
              }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
                  children: "IFSC"
                }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
                  className: "adm-mono",
                  children: r.ifsc_masked || '—'
                })]
              })]
            }), r.payout_method === 'upi' && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
                children: "UPI"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
                className: "adm-mono",
                children: r.upi_masked || '—'
              })]
            }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
                children: "Submitted"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
                children: fmtDateTime(r.submitted_at)
              })]
            }), r.verified_at && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
                children: "Verified"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
                children: fmtDateTime(r.verified_at)
              })]
            }), r.verification_notes && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
                children: "Notes"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
                children: r.verification_notes
              })]
            })]
          }), /*#__PURE__*/jsxRuntimeExports.jsx(KycDocuments, {
            row: r,
            onError: setErr
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
            className: "adm-kyc-card__priv hint",
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
              "aria-hidden": true,
              children: "\uD83D\uDD12"
            }), " Only masked values are stored. Document links are signed and expire in ", KYC_SIGNED_URL_SECONDS, " seconds."]
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "adm-kyc-card__acts",
            children: [r.identity_status !== 'verified' && /*#__PURE__*/jsxRuntimeExports.jsx("button", {
              className: "btn btn-sm",
              disabled: busy,
              onClick: () => setStatus(r, 'verified'),
              children: "Verify"
            }), pending && /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
                className: "btn btn-sm btn-light",
                disabled: busy,
                onClick: () => setStatus(r, 'needs_update'),
                children: "Needs update"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
                className: "btn btn-sm btn-light",
                disabled: busy,
                onClick: () => setStatus(r, 'rejected'),
                children: "Reject"
              })]
            }), r.identity_status === 'verified' && /*#__PURE__*/jsxRuntimeExports.jsx("button", {
              className: "btn btn-sm btn-light",
              disabled: busy,
              onClick: () => setStatus(r, 'needs_update'),
              children: "Revoke (needs update)"
            })]
          }), /*#__PURE__*/jsxRuntimeExports.jsx(KycHistory, {
            creatorId: r.creator_id,
            onError: setErr
          })]
        }, r.creator_id);
      })
    })]
  });
}

// ---------------------------------------------------------------
// Documents — one row per kind; a signed link only while it is valid.
// ---------------------------------------------------------------
function KycDocuments({
  row,
  onError
}) {
  const [links, setLinks] = reactExports.useState({}); // kind → { url, expiresAt }
  const [busy, setBusy] = reactExports.useState(null);
  reactExports.useEffect(() => {
    // Drop each link the moment it would stop working.
    const live = Object.entries(links).filter(([, l]) => l.expiresAt > Date.now());
    if (live.length === 0) return undefined;
    const next = Math.min(...live.map(([, l]) => l.expiresAt)) - Date.now();
    const t = setTimeout(() => {
      setLinks(cur => Object.fromEntries(Object.entries(cur).filter(([, l]) => l.expiresAt > Date.now())));
    }, Math.max(0, next));
    return () => clearTimeout(t);
  }, [links]);
  async function sign(doc) {
    setBusy(doc.kind);
    try {
      const url = await adminKycDocumentUrl(doc.path);
      setLinks(cur => ({
        ...cur,
        [doc.kind]: {
          url,
          expiresAt: Date.now() + KYC_SIGNED_URL_SECONDS * 1000
        }
      }));
    } catch (e) {
      onError(e.message || String(e));
    } finally {
      setBusy(null);
    }
  }
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    className: "adm-kyc-docs",
    children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm-kyc-docs__h",
      children: ["Documents", row.documents_updated_at ? /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
        className: "hint",
        children: [" \xB7 updated ", fmtDateTime(row.documents_updated_at)]
      }) : null]
    }), KYC_DOCUMENT_KINDS.map(k => {
      const doc = kycDocumentState(row, k.kind);
      const link = links[k.kind];
      return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-kyc-doc",
        "data-kind": k.kind,
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
          className: "adm-kyc-doc__label",
          children: doc.label
        }), !doc.uploaded ? /*#__PURE__*/jsxRuntimeExports.jsx("span", {
          className: "hint",
          children: "Not uploaded"
        }) : link ? /*#__PURE__*/jsxRuntimeExports.jsxs("a", {
          className: "btn btn-sm",
          href: link.url,
          target: "_blank",
          rel: "noopener noreferrer",
          children: ["Open ", doc.fileType.toUpperCase(), " \u2197"]
        }) : /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          type: "button",
          className: "btn btn-sm btn-light",
          disabled: busy === k.kind,
          onClick: () => sign(doc),
          children: busy === k.kind ? 'Signing…' : `View ${doc.label.toLowerCase()}`
        })]
      }, k.kind);
    })]
  });
}

// ---------------------------------------------------------------
// History — creator_kyc_audit, written by trigger on every status / notes /
// document change. Loaded on demand; the list is the reviewer's record.
// ---------------------------------------------------------------
const shortId = id => id ? String(id).slice(0, 8) : '—';
function KycHistory({
  creatorId,
  onError
}) {
  const [open, setOpen] = reactExports.useState(false);
  const [rows, setRows] = reactExports.useState(null);
  const [loading, setLoading] = reactExports.useState(false);
  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && rows == null) {
      setLoading(true);
      try {
        setRows(await adminListKycAudit(creatorId));
      } catch (e) {
        onError(e.message || String(e));
        setRows([]);
      } finally {
        setLoading(false);
      }
    }
  }
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    className: "adm-kyc-history",
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
      type: "button",
      className: "adm-kyc-history__toggle",
      onClick: toggle,
      "aria-expanded": open,
      children: open ? 'Hide history' : 'History'
    }), open && (loading ? /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "hint",
      children: "Loading\u2026"
    }) : !rows || rows.length === 0 ? /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "hint",
      children: "No changes recorded yet."
    }) : /*#__PURE__*/jsxRuntimeExports.jsx("ol", {
      className: "adm-kyc-history__list",
      children: rows.map(a => /*#__PURE__*/jsxRuntimeExports.jsxs("li", {
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
          className: "adm-kyc-history__when",
          children: fmtDateTime(a.created_at)
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
          className: "adm-kyc-history__what",
          children: [a.from_status && a.from_status !== a.to_status ? `${STATUS_LABEL[a.from_status] || a.from_status} → ${STATUS_LABEL[a.to_status] || a.to_status}` : a.metadata?.documents_changed ? 'Document updated' : a.from_notes !== a.to_notes ? 'Notes changed' : STATUS_LABEL[a.to_status] || a.to_status, a.metadata?.documents_changed && a.from_status && a.from_status !== a.to_status ? ' · document updated' : '']
        }), a.to_notes && a.to_notes !== a.from_notes && /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
          className: "adm-kyc-history__note",
          children: ["\u201C", a.to_notes, "\u201D"]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
          className: "hint adm-mono",
          children: ["by ", shortId(a.actor)]
        })]
      }, a.id))
    }))]
  });
}

export { Kyc as default };
//# sourceMappingURL=Kyc.js.map
