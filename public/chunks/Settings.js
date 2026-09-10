import { f as useAdminAuth, r as reactExports, a as adminGetSetting, j as jsxRuntimeExports, bJ as SOCIAL_NETWORKS, bK as POLICY_KEYS, bL as validateCompanyForSave, e as adminSetSetting, bI as supabase } from '../bundle.js';

const POLICY_LABELS = {
  privacy: 'Privacy policy',
  terms: 'Terms & conditions',
  shipping: 'Shipping policy',
  returns: 'Returns, refunds & cancellation'
};
function Settings() {
  const {
    session,
    signOut
  } = useAdminAuth();
  const [contact, setContact] = reactExports.useState({
    legalName: '',
    phone: '',
    email: '',
    address: '',
    hours: '',
    social: {},
    policies: {}
  });
  const [loading, setLoading] = reactExports.useState(true);
  const [saving, setSaving] = reactExports.useState(false);
  const [msg, setMsg] = reactExports.useState('');
  const [err, setErr] = reactExports.useState('');
  const [newPassword, setNewPassword] = reactExports.useState('');
  const [pwMsg, setPwMsg] = reactExports.useState('');
  const [pwSaving, setPwSaving] = reactExports.useState(false);
  reactExports.useEffect(() => {
    adminGetSetting('contact').then(v => {
      if (v) setContact(current => ({
        ...current,
        ...v,
        social: v.social || {},
        policies: v.policies || {}
      }));
    }).catch(e => setErr(e.message || String(e))).finally(() => setLoading(false));
  }, []);
  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setErr('');
    setMsg('');
    try {
      const clean = validateCompanyForSave(contact);
      const next = {
        ...contact,
        ...clean,
        social: clean.social,
        policies: clean.policies
      };
      await adminSetSetting('contact', next);
      setContact(next);
      setMsg('Business information saved.');
    } catch (ex) {
      setErr(ex.message || String(ex));
    }
    setSaving(false);
  }
  async function changePassword(e) {
    e.preventDefault();
    if (newPassword.length < 8) {
      setPwMsg('Password must be at least 8 characters.');
      return;
    }
    setPwSaving(true);
    setPwMsg('');
    const {
      error
    } = await supabase.auth.updateUser({
      password: newPassword
    });
    setPwSaving(false);
    setPwMsg(error ? error.message : 'Password updated.');
    if (!error) setNewPassword('');
  }
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    className: "adm-form",
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm__head",
      children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h1", {
          children: "Settings"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          children: "Account, session and contact information."
        })]
      })
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "surface",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
        children: "Signed in as"
      }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
        className: "muted",
        children: session?.user?.email
      }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
        className: "btn btn-outline btn-sm",
        style: {
          marginTop: 12
        },
        onClick: signOut,
        children: "Log out"
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "surface",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
        children: "Change password"
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("form", {
        onSubmit: changePassword,
        style: {
          display: 'flex',
          gap: 10,
          alignItems: 'flex-end',
          flexWrap: 'wrap'
        },
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          style: {
            flex: 1,
            minWidth: 220,
            marginBottom: 0
          },
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "New password"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            type: "password",
            minLength: 8,
            value: newPassword,
            onChange: e => setNewPassword(e.target.value),
            placeholder: "At least 8 characters"
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          className: "btn btn-sm",
          type: "submit",
          disabled: pwSaving,
          children: pwSaving ? 'Updating…' : 'Update password'
        })]
      }), pwMsg && /*#__PURE__*/jsxRuntimeExports.jsx("p", {
        className: "hint",
        style: {
          marginTop: 8
        },
        children: pwMsg
      })]
    }), err && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-banner err",
      children: err
    }), msg && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-banner ok",
      children: msg
    }), !loading && /*#__PURE__*/jsxRuntimeExports.jsxs("form", {
      onSubmit: save,
      className: "surface",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
        children: "Business & support information"
      }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
        className: "muted",
        style: {
          marginBottom: 20
        },
        children: "Only completed, valid fields appear publicly. Leave unknown details blank."
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-formgrid",
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "Business / legal name"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            maxLength: 120,
            value: contact.legalName || '',
            onChange: e => setContact(c => ({
              ...c,
              legalName: e.target.value
            }))
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "Support email"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            type: "email",
            maxLength: 200,
            value: contact.email || '',
            onChange: e => setContact(c => ({
              ...c,
              email: e.target.value
            }))
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "Support phone"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            type: "tel",
            maxLength: 40,
            value: contact.phone || '',
            onChange: e => setContact(c => ({
              ...c,
              phone: e.target.value
            }))
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "Support hours"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            className: "input",
            maxLength: 160,
            placeholder: "Publish only confirmed hours",
            value: contact.hours || '',
            onChange: e => setContact(c => ({
              ...c,
              hours: e.target.value
            }))
          })]
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "field",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
          className: "label",
          children: "Registered / business address"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("textarea", {
          className: "textarea",
          maxLength: 400,
          rows: 3,
          value: contact.address || '',
          onChange: e => setContact(c => ({
            ...c,
            address: e.target.value
          }))
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-settings-group",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h3", {
          children: "Official social profiles"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          className: "muted",
          children: "Optional public HTTPS links. Empty networks stay hidden."
        }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
          className: "adm-formgrid",
          children: SOCIAL_NETWORKS.map(network => /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "field",
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
              className: "label",
              children: network.label
            }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
              className: "input",
              type: "url",
              inputMode: "url",
              placeholder: "https://",
              value: contact.social?.[network.key] || '',
              onChange: e => setContact(c => ({
                ...c,
                social: {
                  ...(c.social || {}),
                  [network.key]: e.target.value
                }
              }))
            })]
          }, network.key))
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-settings-group",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h3", {
          children: "Owner-approved policy text"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          className: "muted",
          children: "Plain text only. Leave a policy blank until its business terms have been approved."
        }), POLICY_KEYS.map(key => /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: POLICY_LABELS[key]
          }), /*#__PURE__*/jsxRuntimeExports.jsx("textarea", {
            className: "textarea",
            rows: 7,
            maxLength: 20000,
            value: contact.policies?.[key] || '',
            onChange: e => setContact(c => ({
              ...c,
              policies: {
                ...(c.policies || {}),
                [key]: e.target.value
              }
            }))
          })]
        }, key))]
      }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
        className: "btn",
        type: "submit",
        disabled: saving,
        children: saving ? 'Saving…' : 'Save business information'
      })]
    })]
  });
}

export { Settings as default };
//# sourceMappingURL=Settings.js.map
