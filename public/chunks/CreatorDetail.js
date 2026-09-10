import { u as useParams, r as reactExports, ae as adminGetCreator, af as adminListCodeAliases, ag as adminListCampaigns, ah as adminListLinks, ai as adminListAudit, aj as adminListAttributionEvents, j as jsxRuntimeExports, b as Link, a7 as CREATOR_STATUSES, ak as adminUpdateCampaign, al as adminCreateCampaign, am as CAMPAIGN_STATUSES, an as buildTrackingUrl, ao as normalizeDestination, ap as DESTINATION_TYPES, aq as CopyButton, ab as adminSetCreatorStatus, ar as adminChangeCreatorCode, as as adminUpdateCreator, at as adminCreateLink, au as adminSetLinkStatus } from '../bundle.js';

const fmtDate = iso => iso ? new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric'
}).format(new Date(iso)) : '—';
const fmtDateTime = iso => iso ? new Date(iso).toLocaleString('en-IN') : '—';
const toInputDate = iso => iso ? new Date(iso).toISOString().slice(0, 10) : '';
const STATUS_BADGE = {
  active: 'badge-best',
  pending: 'badge-soft',
  paused: 'badge-soft',
  suspended: 'badge-sale',
  archived: 'badge-out',
  draft: 'badge-soft',
  ended: 'badge-out'
};
const blankCampaign = {
  name: '',
  campaign_code: '',
  description: '',
  status: 'draft',
  start_at: '',
  end_at: '',
  commission_rate_override: '',
  attribution_window_days: ''
};
const blankLink = {
  campaign_id: '',
  label: '',
  destination_type: 'homepage',
  destination_path: '/'
};
function CreatorDetail() {
  const {
    id
  } = useParams();
  const [creator, setCreator] = reactExports.useState(null);
  const [aliases, setAliases] = reactExports.useState([]);
  const [campaigns, setCampaigns] = reactExports.useState([]);
  const [links, setLinks] = reactExports.useState([]);
  const [audit, setAudit] = reactExports.useState([]);
  const [events, setEvents] = reactExports.useState([]);
  const [loading, setLoading] = reactExports.useState(true);
  const [busy, setBusy] = reactExports.useState(false);
  const [err, setErr] = reactExports.useState('');
  const [msg, setMsg] = reactExports.useState('');
  const [editing, setEditing] = reactExports.useState(false);
  const [profile, setProfile] = reactExports.useState({});
  const [newCode, setNewCode] = reactExports.useState('');
  const [campaignForm, setCampaignForm] = reactExports.useState(null); // null | blank | row
  const [linkForm, setLinkForm] = reactExports.useState(null);
  const load = reactExports.useCallback(async () => {
    try {
      const c = await adminGetCreator(id);
      if (!c) {
        setErr('Creator not found.');
        setLoading(false);
        return;
      }
      setCreator(c);
      const [al, cs, ls, au, ev] = await Promise.all([adminListCodeAliases(id), adminListCampaigns(id), adminListLinks(id), adminListAudit({
        entityId: id,
        limit: 20
      }), adminListAttributionEvents(id, 10)]);
      setAliases(al);
      setCampaigns(cs);
      setLinks(ls);
      setAudit(au);
      setEvents(ev);
      setErr('');
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [id]);
  reactExports.useEffect(() => {
    load();
  }, [load]);
  function flash(t) {
    setMsg(t);
    setTimeout(() => setMsg(m => m === t ? '' : m), 2500);
  }
  async function run(fn, okMsg) {
    setBusy(true);
    setErr('');
    try {
      await fn();
      await load();
      if (okMsg) flash(okMsg);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }
  if (loading) return /*#__PURE__*/jsxRuntimeExports.jsx("p", {
    className: "muted",
    children: "Loading creator\u2026"
  });
  if (!creator) return /*#__PURE__*/jsxRuntimeExports.jsx("div", {
    className: "adm-banner err",
    children: err || 'Creator not found.'
  });
  const campaignById = Object.fromEntries(campaigns.map(c => [c.id, c]));
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm__head",
      children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        children: [/*#__PURE__*/jsxRuntimeExports.jsx(Link, {
          to: "/admin/creators",
          className: "adm-back",
          children: "\u2190 Creators"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("h1", {
          children: creator.display_name
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
            className: "adm-mono",
            children: creator.creator_code
          }), " \xB7", ' ', /*#__PURE__*/jsxRuntimeExports.jsx("span", {
            className: `badge ${STATUS_BADGE[creator.status] || 'badge-soft'}`,
            children: creator.status
          }), " \xB7", ' ', Number(creator.default_commission_rate), "% commission \xB7 ", creator.default_attribution_window_days, "-day window \xB7 joined ", fmtDate(creator.joined_at)]
        })]
      })
    }), err && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-banner err",
      children: err
    }), msg && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-banner ok",
      children: msg
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "surface",
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-order-block__head",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
          children: "Profile"
        }), !editing && /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          className: "btn btn-sm btn-light",
          onClick: () => {
            setProfile({
              ...creator
            });
            setEditing(true);
          },
          children: "Edit"
        })]
      }), !editing ? /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("dl", {
          className: "adm-kv",
          children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
              children: "Display name"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
              children: creator.display_name
            })]
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
              children: "Legal name"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
              children: creator.legal_name || '—'
            })]
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
              children: "Email"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
              children: creator.email
            })]
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
              children: "Phone"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
              children: creator.phone || '—'
            })]
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
              children: "Portal account"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
              children: creator.user_id ? 'Linked' : 'Not yet claimed'
            })]
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
              children: "Payout eligible"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
              children: creator.payout_eligible ? 'Yes' : 'No'
            })]
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("dt", {
              children: "Last updated"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("dd", {
              children: fmtDateTime(creator.updated_at)
            })]
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
          className: "adm-rowacts",
          style: {
            marginTop: 12
          },
          children: CREATOR_STATUSES.filter(s => s !== creator.status).map(s => /*#__PURE__*/jsxRuntimeExports.jsx("button", {
            className: "btn btn-sm btn-light",
            disabled: busy,
            onClick: () => run(() => adminSetCreatorStatus(creator.id, s), `Status → ${s}`),
            children: s === 'active' ? 'Activate' : s === 'suspended' ? 'Suspend' : s === 'archived' ? 'Archive' : `Set ${s}`
          }, s))
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          style: {
            marginTop: 16
          },
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "Public creator code"
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "adm-inline",
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
              className: "input",
              placeholder: creator.creator_code,
              value: newCode,
              onChange: e => setNewCode(e.target.value.toUpperCase())
            }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
              className: "btn btn-sm",
              disabled: busy || !newCode.trim(),
              onClick: () => run(async () => {
                await adminChangeCreatorCode(creator.id, newCode);
                setNewCode('');
              }, 'Creator code changed'),
              children: "Change code"
            })]
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
            className: "hint",
            children: ["Changing the code keeps the old one as an alias, so links already shared keep working.", aliases.length > 0 && /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
              children: [" Retired: ", aliases.map(a => a.code).join(', ')]
            })]
          })]
        })]
      }) : /*#__PURE__*/jsxRuntimeExports.jsxs("form", {
        onSubmit: e => {
          e.preventDefault();
          run(() => adminUpdateCreator(creator.id, profile), 'Profile saved').then(() => setEditing(false));
        },
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "adm-grid2",
          children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "field",
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
              className: "label",
              children: "Display name"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
              className: "input",
              required: true,
              value: profile.display_name || '',
              onChange: e => setProfile(p => ({
                ...p,
                display_name: e.target.value
              }))
            })]
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "field",
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
              className: "label",
              children: "Legal name"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
              className: "input",
              value: profile.legal_name || '',
              onChange: e => setProfile(p => ({
                ...p,
                legal_name: e.target.value
              }))
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
              value: profile.email || '',
              onChange: e => setProfile(p => ({
                ...p,
                email: e.target.value
              }))
            })]
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "field",
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
              className: "label",
              children: "Phone"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
              className: "input",
              value: profile.phone || '',
              onChange: e => setProfile(p => ({
                ...p,
                phone: e.target.value
              }))
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
              value: profile.default_commission_rate ?? 0,
              onChange: e => setProfile(p => ({
                ...p,
                default_commission_rate: e.target.value
              }))
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
              value: profile.default_attribution_window_days ?? 30,
              onChange: e => setProfile(p => ({
                ...p,
                default_attribution_window_days: e.target.value
              }))
            })]
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "adm-checkrow",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
            type: "checkbox",
            id: "pe",
            checked: !!profile.payout_eligible,
            onChange: e => setProfile(p => ({
              ...p,
              payout_eligible: e.target.checked
            }))
          }), /*#__PURE__*/jsxRuntimeExports.jsx("label", {
            htmlFor: "pe",
            children: "Payout eligible (recorded for Part 3 \u2014 no payouts exist yet)"
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "Internal notes"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("textarea", {
            className: "input",
            rows: 3,
            value: profile.notes || '',
            onChange: e => setProfile(p => ({
              ...p,
              notes: e.target.value
            }))
          }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
            className: "hint",
            children: "Visible to admins only \u2014 never shown in the creator portal."
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          style: {
            display: 'flex',
            gap: 10
          },
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
            className: "btn",
            type: "submit",
            disabled: busy,
            children: "Save"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
            className: "btn btn-outline",
            type: "button",
            onClick: () => setEditing(false),
            children: "Cancel"
          })]
        })]
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "surface",
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-order-block__head",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
          children: "Campaigns"
        }), !campaignForm && /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          className: "btn btn-sm",
          onClick: () => setCampaignForm({
            ...blankCampaign
          }),
          children: "New campaign"
        })]
      }), campaignForm && /*#__PURE__*/jsxRuntimeExports.jsxs("form", {
        onSubmit: e => {
          e.preventDefault();
          const payload = {
            ...campaignForm,
            start_at: campaignForm.start_at || null,
            end_at: campaignForm.end_at || null
          };
          run(() => campaignForm.id ? adminUpdateCampaign(campaignForm.id, payload) : adminCreateCampaign(creator.id, payload), campaignForm.id ? 'Campaign updated' : 'Campaign created').then(() => setCampaignForm(null));
        },
        style: {
          borderTop: '1px solid var(--line)',
          paddingTop: 14,
          marginTop: 10
        },
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "adm-grid2",
          children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "field",
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
              className: "label",
              children: "Name"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
              className: "input",
              required: true,
              placeholder: "YouTube Review",
              value: campaignForm.name,
              onChange: e => setCampaignForm(f => ({
                ...f,
                name: e.target.value
              }))
            })]
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "field",
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
              className: "label",
              children: "Campaign code"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
              className: "input",
              placeholder: "YT-SEABUCKTHORN (auto if blank)",
              value: campaignForm.campaign_code,
              onChange: e => setCampaignForm(f => ({
                ...f,
                campaign_code: e.target.value.toUpperCase()
              })),
              disabled: !!campaignForm.id
            })]
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "Description"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            value: campaignForm.description || '',
            onChange: e => setCampaignForm(f => ({
              ...f,
              description: e.target.value
            }))
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
              value: campaignForm.status,
              onChange: e => setCampaignForm(f => ({
                ...f,
                status: e.target.value
              })),
              children: CAMPAIGN_STATUSES.map(s => /*#__PURE__*/jsxRuntimeExports.jsx("option", {
                value: s,
                children: s
              }, s))
            }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
              className: "hint",
              children: "An ended campaign stops attributing until an admin sets it active again."
            })]
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "field",
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
              className: "label",
              children: "Attribution window override (days)"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
              className: "input",
              type: "number",
              min: "1",
              max: "365",
              placeholder: `default ${creator.default_attribution_window_days}`,
              value: campaignForm.attribution_window_days ?? '',
              onChange: e => setCampaignForm(f => ({
                ...f,
                attribution_window_days: e.target.value
              }))
            })]
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "adm-grid2",
          children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "field",
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
              className: "label",
              children: "Starts"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
              className: "input",
              type: "date",
              value: toInputDate(campaignForm.start_at),
              onChange: e => setCampaignForm(f => ({
                ...f,
                start_at: e.target.value ? new Date(e.target.value).toISOString() : ''
              }))
            })]
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "field",
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
              className: "label",
              children: "Ends"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
              className: "input",
              type: "date",
              value: toInputDate(campaignForm.end_at),
              onChange: e => setCampaignForm(f => ({
                ...f,
                end_at: e.target.value ? new Date(e.target.value).toISOString() : ''
              }))
            })]
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "Commission override (%)"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            type: "number",
            min: "0",
            max: "100",
            step: "0.5",
            placeholder: `default ${creator.default_commission_rate}`,
            value: campaignForm.commission_rate_override ?? '',
            onChange: e => setCampaignForm(f => ({
              ...f,
              commission_rate_override: e.target.value
            }))
          }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
            className: "hint",
            children: "Stored for the Part 2 commission engine. Nothing is calculated now."
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          style: {
            display: 'flex',
            gap: 10
          },
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
            className: "btn",
            type: "submit",
            disabled: busy,
            children: campaignForm.id ? 'Save campaign' : 'Create campaign'
          }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
            className: "btn btn-outline",
            type: "button",
            onClick: () => setCampaignForm(null),
            children: "Cancel"
          })]
        })]
      }), campaigns.length === 0 ? /*#__PURE__*/jsxRuntimeExports.jsx("div", {
        className: "adm-empty",
        children: "No campaigns yet."
      }) : /*#__PURE__*/jsxRuntimeExports.jsx("div", {
        className: "adm-table-wrap",
        children: /*#__PURE__*/jsxRuntimeExports.jsxs("table", {
          className: "adm-table",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("thead", {
            children: /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("th", {
                children: "Campaign"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                children: "Code"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                children: "Period"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                children: "Status"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {})]
            })
          }), /*#__PURE__*/jsxRuntimeExports.jsx("tbody", {
            children: campaigns.map(c => /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
              children: [/*#__PURE__*/jsxRuntimeExports.jsxs("td", {
                children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
                  children: c.name
                }), c.description && /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                  className: "hint",
                  style: {
                    display: 'block'
                  },
                  children: c.description
                })]
              }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                className: "adm-mono",
                children: c.campaign_code
              }), /*#__PURE__*/jsxRuntimeExports.jsxs("td", {
                children: [fmtDate(c.start_at), " \u2192 ", c.end_at ? fmtDate(c.end_at) : 'open']
              }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                children: /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                  className: `badge ${STATUS_BADGE[c.status] || 'badge-soft'}`,
                  children: c.status
                })
              }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                  className: "adm-rowacts",
                  children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
                    className: "btn btn-sm btn-light",
                    onClick: () => setCampaignForm({
                      ...c
                    }),
                    disabled: busy,
                    children: "Edit"
                  }), c.status !== 'active' && /*#__PURE__*/jsxRuntimeExports.jsx("button", {
                    className: "btn btn-sm btn-light",
                    disabled: busy,
                    onClick: () => run(() => adminUpdateCampaign(c.id, {
                      status: 'active'
                    }), 'Campaign active'),
                    children: "Activate"
                  }), c.status === 'active' && /*#__PURE__*/jsxRuntimeExports.jsx("button", {
                    className: "btn btn-sm btn-light",
                    disabled: busy,
                    onClick: () => run(() => adminUpdateCampaign(c.id, {
                      status: 'paused'
                    }), 'Campaign paused'),
                    children: "Pause"
                  })]
                })
              })]
            }, c.id))
          })]
        })
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "surface",
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-order-block__head",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
          children: "Tracking links"
        }), !linkForm && /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          className: "btn btn-sm",
          onClick: () => setLinkForm({
            ...blankLink
          }),
          children: "Create tracking link"
        })]
      }), linkForm && (() => {
        const previewCampaign = campaignById[linkForm.campaign_id];
        const previewUrl = buildTrackingUrl({
          destination_path: normalizeDestination(linkForm.destination_path, linkForm.destination_type),
          public_code: 'TRK-XXXXXX'
        }, creator, previewCampaign);
        return /*#__PURE__*/jsxRuntimeExports.jsxs("form", {
          onSubmit: e => {
            e.preventDefault();
            run(() => adminCreateLink(creator.id, linkForm), 'Tracking link created').then(() => setLinkForm(null));
          },
          style: {
            borderTop: '1px solid var(--line)',
            paddingTop: 14,
            marginTop: 10
          },
          children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "adm-grid2",
            children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
              className: "field",
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
                className: "label",
                children: "Campaign"
              }), /*#__PURE__*/jsxRuntimeExports.jsxs("select", {
                className: "select",
                value: linkForm.campaign_id,
                onChange: e => setLinkForm(f => ({
                  ...f,
                  campaign_id: e.target.value
                })),
                children: [/*#__PURE__*/jsxRuntimeExports.jsx("option", {
                  value: "",
                  children: "\u2014 none (creator-level link) \u2014"
                }), campaigns.map(c => /*#__PURE__*/jsxRuntimeExports.jsxs("option", {
                  value: c.id,
                  children: [c.name, " (", c.campaign_code, ")"]
                }, c.id))]
              })]
            }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
              className: "field",
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
                className: "label",
                children: "Label (internal)"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
                className: "input",
                placeholder: "Instagram bio",
                value: linkForm.label,
                onChange: e => setLinkForm(f => ({
                  ...f,
                  label: e.target.value
                }))
              })]
            })]
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "adm-grid2",
            children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
              className: "field",
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
                className: "label",
                children: "Destination type"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("select", {
                className: "select",
                value: linkForm.destination_type,
                onChange: e => {
                  const t = e.target.value;
                  setLinkForm(f => ({
                    ...f,
                    destination_type: t,
                    destination_path: t === 'homepage' ? '/' : f.destination_path
                  }));
                },
                children: DESTINATION_TYPES.map(t => /*#__PURE__*/jsxRuntimeExports.jsx("option", {
                  value: t,
                  children: t
                }, t))
              })]
            }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
              className: "field",
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
                className: "label",
                children: "Destination path"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
                className: "input",
                value: linkForm.destination_path,
                disabled: linkForm.destination_type === 'homepage',
                placeholder: "/product/biosash-sea-buckthorn-juice",
                onChange: e => setLinkForm(f => ({
                  ...f,
                  destination_path: e.target.value
                }))
              }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
                className: "hint",
                children: "Internal SORA LIFE paths only \u2014 external URLs are rejected."
              })]
            })]
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "field",
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
              className: "label",
              children: "Preview"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("code", {
              className: "adm-preview-url",
              children: previewUrl
            }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
              className: "hint",
              children: "The real link gets its own unique TRK code on creation."
            })]
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            style: {
              display: 'flex',
              gap: 10
            },
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
              className: "btn",
              type: "submit",
              disabled: busy,
              children: "Create link"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
              className: "btn btn-outline",
              type: "button",
              onClick: () => setLinkForm(null),
              children: "Cancel"
            })]
          })]
        });
      })(), links.length === 0 ? /*#__PURE__*/jsxRuntimeExports.jsx("div", {
        className: "adm-empty",
        children: "No tracking links yet."
      }) : /*#__PURE__*/jsxRuntimeExports.jsx("div", {
        className: "adm-linklist",
        children: links.map(l => {
          const url = buildTrackingUrl(l, creator, campaignById[l.campaign_id]);
          return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: `adm-linkrow ${l.status !== 'active' ? 'is-muted' : ''}`,
            children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
              className: "adm-linkrow__main",
              children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                className: "adm-linkrow__head",
                children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
                  className: "adm-mono",
                  children: l.public_code
                }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                  className: `badge ${l.status === 'active' ? 'badge-best' : 'badge-out'}`,
                  children: l.status
                }), campaignById[l.campaign_id] && /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                  className: "adm-chip",
                  children: campaignById[l.campaign_id].name
                }), l.label && /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                  className: "hint",
                  children: l.label
                })]
              }), /*#__PURE__*/jsxRuntimeExports.jsx("code", {
                className: "adm-preview-url",
                children: url
              })]
            }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
              className: "adm-rowacts",
              children: [/*#__PURE__*/jsxRuntimeExports.jsx(CopyButton, {
                value: url,
                className: "btn btn-sm"
              }), l.status === 'active' ? /*#__PURE__*/jsxRuntimeExports.jsx("button", {
                className: "btn btn-sm btn-light",
                disabled: busy,
                onClick: () => run(() => adminSetLinkStatus(l.id, 'paused'), 'Link deactivated'),
                children: "Deactivate"
              }) : /*#__PURE__*/jsxRuntimeExports.jsx("button", {
                className: "btn btn-sm btn-light",
                disabled: busy,
                onClick: () => run(() => adminSetLinkStatus(l.id, 'active'), 'Link activated'),
                children: "Activate"
              })]
            })]
          }, l.id);
        })
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "surface",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
        children: "Recent link activity"
      }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
        className: "hint",
        style: {
          marginTop: -4
        },
        children: "Attribution foundation only \u2014 visits recorded under this creator\u2019s links. No sale is attributed and no commission exists in this phase."
      }), events.length === 0 ? /*#__PURE__*/jsxRuntimeExports.jsx("div", {
        className: "adm-empty",
        children: "No attribution events recorded yet."
      }) : /*#__PURE__*/jsxRuntimeExports.jsx("div", {
        className: "adm-table-wrap",
        children: /*#__PURE__*/jsxRuntimeExports.jsxs("table", {
          className: "adm-table",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("thead", {
            children: /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("th", {
                children: "Event"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                children: "Matched code"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                children: "Landing"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                children: "When"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                children: "Window ends"
              })]
            })
          }), /*#__PURE__*/jsxRuntimeExports.jsx("tbody", {
            children: events.map(e => /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("td", {
                children: e.event_type
              }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                className: "adm-mono",
                children: e.matched_code || '—'
              }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                className: "adm-mono",
                children: e.landing_path || '—'
              }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                children: fmtDateTime(e.occurred_at)
              }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                children: fmtDate(e.expires_at)
              })]
            }, e.id))
          })]
        })
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "surface",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
        children: "Audit trail"
      }), audit.length === 0 ? /*#__PURE__*/jsxRuntimeExports.jsx("div", {
        className: "adm-empty",
        children: "No recorded changes yet."
      }) : /*#__PURE__*/jsxRuntimeExports.jsx("ol", {
        className: "adm-timeline",
        children: audit.map(a => /*#__PURE__*/jsxRuntimeExports.jsxs("li", {
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
            className: "adm-timeline__label",
            children: a.action.replace(/_/g, ' ')
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
            className: "adm-timeline__at",
            children: [fmtDateTime(a.created_at), a.metadata?.from && a.metadata?.to && /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
              children: [" \xB7 ", a.metadata.from, " \u2192 ", a.metadata.to]
            })]
          })]
        }, a.id))
      })]
    })]
  });
}

export { CreatorDetail as default };
//# sourceMappingURL=CreatorDetail.js.map
