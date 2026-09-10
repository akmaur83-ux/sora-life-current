import { r as reactExports, a6 as adminGetProgramSettings, j as jsxRuntimeExports, a7 as CREATOR_STATUSES, b as Link, a8 as adminListCreators, a9 as adminSetProgramSettings, aa as adminCreateCreator, ab as adminSetCreatorStatus } from '../bundle.js';

const STATUS_BADGE = {
  active: 'badge-best',
  pending: 'badge-soft',
  paused: 'badge-soft',
  suspended: 'badge-sale',
  archived: 'badge-out'
};
const blank = {
  display_name: '',
  legal_name: '',
  email: '',
  phone: '',
  status: 'pending',
  default_commission_rate: 10,
  default_attribution_window_days: 30,
  payout_eligible: false,
  notes: ''
};
function Creators() {
  const [rows, setRows] = reactExports.useState([]);
  const [loading, setLoading] = reactExports.useState(true);
  const [busy, setBusy] = reactExports.useState(false);
  const [err, setErr] = reactExports.useState('');
  const [msg, setMsg] = reactExports.useState('');
  const [adding, setAdding] = reactExports.useState(false);
  const [form, setForm] = reactExports.useState(blank);
  const [filter, setFilter] = reactExports.useState('all');
  const [program, setProgram] = reactExports.useState(null);
  const [savingProgram, setSavingProgram] = reactExports.useState(false);
  async function load() {
    try {
      setRows(await adminListCreators());
      setErr('');
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }
  reactExports.useEffect(() => {
    load();
    adminGetProgramSettings().then(setProgram).catch(() => {});
  }, []);
  async function saveProgram(next) {
    setSavingProgram(true);
    try {
      const saved = await adminSetProgramSettings(next);
      setProgram(saved);
      flash(next.auto_approve ? 'Applications now auto-approve' : 'Applications now start as pending');
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setSavingProgram(false);
    }
  }
  const set = (k, v) => setForm(s => ({
    ...s,
    [k]: v
  }));
  function flash(t) {
    setMsg(t);
    setTimeout(() => setMsg(m => m === t ? '' : m), 2500);
  }
  async function create(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const created = await adminCreateCreator(form);
      setAdding(false);
      setForm(blank);
      await load();
      flash(`Creator created — code ${created.creator_code}`);
    } catch (e2) {
      setErr(e2.message || String(e2));
    } finally {
      setBusy(false);
    }
  }
  async function setStatus(row, status) {
    setBusy(true);
    try {
      await adminSetCreatorStatus(row.id, status);
      await load();
      flash(`${row.display_name} → ${status}`);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }
  const visible = filter === 'all' ? rows : rows.filter(r => r.status === filter);
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm__head",
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h1", {
          children: "Creators"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          children: loading ? 'Loading…' : `${rows.length} creators · ${rows.filter(r => r.status === 'active').length} active`
        })]
      }), !adding && /*#__PURE__*/jsxRuntimeExports.jsx("button", {
        className: "btn",
        onClick: () => setAdding(true),
        children: "Add creator"
      })]
    }), err && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-banner err",
      children: err
    }), msg && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-banner ok",
      children: msg
    }), program && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "surface",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
        children: "Application approval"
      }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
        className: "hint",
        style: {
          marginTop: -4
        },
        children: "Controls what happens when an existing customer applies from their account."
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-checkrow",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
          type: "checkbox",
          id: "auto-approve",
          checked: !!program.auto_approve,
          disabled: savingProgram,
          onChange: e => saveProgram({
            ...program,
            auto_approve: e.target.checked
          })
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("label", {
          htmlFor: "auto-approve",
          children: ["Auto-approve new applications", ' ', /*#__PURE__*/jsxRuntimeExports.jsx("span", {
            className: "hint",
            children: program.auto_approve ? '(applicants become active immediately)' : '(applicants start as pending for your review)'
          })]
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-grid2",
        style: {
          marginTop: 10
        },
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "Default commission rate (%)"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            type: "number",
            min: "0",
            max: "100",
            step: "0.5",
            defaultValue: program.default_commission_rate,
            onBlur: e => saveProgram({
              ...program,
              default_commission_rate: e.target.value
            })
          }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
            className: "hint",
            children: "Applied to new applicants. Stored for Part 2 \u2014 no commission is calculated yet."
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "Default attribution window (days)"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            type: "number",
            min: "1",
            max: "365",
            defaultValue: program.default_attribution_window_days,
            onBlur: e => saveProgram({
              ...program,
              default_attribution_window_days: e.target.value
            })
          })]
        })]
      })]
    }), adding && /*#__PURE__*/jsxRuntimeExports.jsxs("form", {
      className: "surface",
      onSubmit: create,
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
        children: "New creator"
      }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
        className: "hint",
        style: {
          marginTop: -4,
          marginBottom: 12
        },
        children: "The public creator code is generated automatically and is unique \u2014 you can change it later from the creator\u2019s page."
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-grid2",
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "Display name (public)"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            required: true,
            value: form.display_name,
            onChange: e => set('display_name', e.target.value),
            placeholder: "Anjali Sharma"
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "Legal name (internal)"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            value: form.legal_name,
            onChange: e => set('legal_name', e.target.value)
          })]
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-grid2",
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "Email"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            type: "email",
            required: true,
            value: form.email,
            onChange: e => set('email', e.target.value)
          }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
            className: "hint",
            children: "The creator signs in with this email to reach their portal."
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "Phone"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            value: form.phone,
            onChange: e => set('phone', e.target.value)
          })]
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-grid2",
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "Commission rate (%)"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            type: "number",
            min: "0",
            max: "100",
            step: "0.5",
            value: form.default_commission_rate,
            onChange: e => set('default_commission_rate', e.target.value)
          }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
            className: "hint",
            children: "Stored for Part 2. No commission is calculated yet."
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "Attribution window (days)"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            type: "number",
            min: "1",
            max: "365",
            value: form.default_attribution_window_days,
            onChange: e => set('default_attribution_window_days', e.target.value)
          })]
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-grid2",
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "Status"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("select", {
            className: "select",
            value: form.status,
            onChange: e => set('status', e.target.value),
            children: CREATOR_STATUSES.map(s => /*#__PURE__*/jsxRuntimeExports.jsx("option", {
              value: s,
              children: s
            }, s))
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "Internal notes"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            value: form.notes,
            onChange: e => set('notes', e.target.value)
          })]
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        style: {
          display: 'flex',
          gap: 10,
          marginTop: 14
        },
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
          className: "btn",
          type: "submit",
          disabled: busy,
          children: busy ? 'Creating…' : 'Create creator'
        }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          className: "btn btn-outline",
          type: "button",
          onClick: () => {
            setAdding(false);
            setForm(blank);
          },
          children: "Cancel"
        })]
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "surface",
      style: {
        paddingBlock: 12
      },
      children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "field",
        style: {
          margin: 0
        },
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
          className: "label",
          htmlFor: "cf",
          children: "Filter by status"
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("select", {
          id: "cf",
          className: "select",
          value: filter,
          onChange: e => setFilter(e.target.value),
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("option", {
            value: "all",
            children: "All"
          }), CREATOR_STATUSES.map(s => /*#__PURE__*/jsxRuntimeExports.jsx("option", {
            value: s,
            children: s
          }, s))]
        })]
      })
    }), loading ? /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "muted",
      children: "Loading creators\u2026"
    }) : visible.length === 0 ? /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-empty",
      children: rows.length === 0 ? 'No creators yet. Add your first creator to start the program.' : 'No creators with that status.'
    }) : /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-table-wrap",
      children: /*#__PURE__*/jsxRuntimeExports.jsxs("table", {
        className: "adm-table",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("thead", {
          children: /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Creator"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Code"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              className: "adm-items__amt",
              children: "Commission"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              className: "adm-items__qty",
              children: "Window"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Status"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {})]
          })
        }), /*#__PURE__*/jsxRuntimeExports.jsx("tbody", {
          children: visible.map(r => /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
            className: r.status === 'archived' ? 'is-muted' : '',
            children: [/*#__PURE__*/jsxRuntimeExports.jsxs("td", {
              children: [/*#__PURE__*/jsxRuntimeExports.jsx(Link, {
                to: `/admin/creators/${r.id}`,
                className: "adm-link",
                children: /*#__PURE__*/jsxRuntimeExports.jsx("strong", {
                  children: r.display_name
                })
              }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                className: "hint",
                style: {
                  display: 'block'
                },
                children: r.email
              })]
            }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
              className: "adm-mono",
              children: r.creator_code
            }), /*#__PURE__*/jsxRuntimeExports.jsxs("td", {
              className: "adm-items__amt",
              children: [Number(r.default_commission_rate), "%"]
            }), /*#__PURE__*/jsxRuntimeExports.jsxs("td", {
              className: "adm-items__qty",
              children: [r.default_attribution_window_days, "d"]
            }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
              children: /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                className: `badge ${STATUS_BADGE[r.status] || 'badge-soft'}`,
                children: r.status
              })
            }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
              children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                className: "adm-rowacts",
                children: [/*#__PURE__*/jsxRuntimeExports.jsx(Link, {
                  to: `/admin/creators/${r.id}`,
                  className: "btn btn-sm btn-light",
                  children: "Open"
                }), r.status !== 'active' && r.status !== 'archived' && /*#__PURE__*/jsxRuntimeExports.jsx("button", {
                  className: "btn btn-sm btn-light",
                  onClick: () => setStatus(r, 'active'),
                  disabled: busy,
                  children: "Activate"
                }), r.status === 'active' && /*#__PURE__*/jsxRuntimeExports.jsx("button", {
                  className: "btn btn-sm btn-light",
                  onClick: () => setStatus(r, 'paused'),
                  disabled: busy,
                  children: "Pause"
                })]
              })
            })]
          }, r.id))
        })]
      })
    })]
  });
}

export { Creators as default };
//# sourceMappingURL=Creators.js.map
