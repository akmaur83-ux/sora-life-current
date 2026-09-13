import { r as reactExports, j as jsxRuntimeExports, aT as normalizeLadder, aU as DEFAULT_BEYOND_STEP, aV as adminGetTierLadder, aW as validateLadder, aX as ladderErrorMessage, aY as rupees, aZ as adminListLevelRewards, a_ as groupRewardsByLevel, a$ as REWARD_OPTION_SLOTS, b0 as validateRewardOption, b1 as REWARD_TYPES, b2 as REWARD_TYPE_LABEL, b3 as adminListRewardClaims, b4 as CLAIM_STATUSES, b5 as CLAIM_STATUS_LABEL, b6 as DEFAULT_LADDER, b7 as adminSetTierLadder, b8 as rewardOptionErrorMessage, b9 as adminUpsertLevelReward, ba as adminDeleteLevelReward, bb as adminSetRewardClaimStatus } from '../bundle.js';

const fmtDateTime = iso => iso ? new Date(iso).toLocaleString('en-IN') : '—';
const CLAIM_BADGE = {
  pending: 'badge-soft',
  fulfilled: 'badge-best',
  cancelled: 'badge-out'
};
function CreatorTiers() {
  const [err, setErr] = reactExports.useState('');
  const [msg, setMsg] = reactExports.useState('');
  function flash(t) {
    setMsg(t);
    setTimeout(() => setMsg(m => m === t ? '' : m), 2800);
  }
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm__head",
      children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h1", {
          children: "Creator tiers & rewards"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
          children: "Commission ladder, level rewards and reward claims. Rate changes apply to future sales only."
        })]
      })
    }), err && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-banner err",
      children: err
    }), msg && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-banner ok",
      children: msg
    }), /*#__PURE__*/jsxRuntimeExports.jsx(LadderEditor, {
      onError: setErr,
      onFlash: flash
    }), /*#__PURE__*/jsxRuntimeExports.jsx(RewardsEditor, {
      onError: setErr,
      onFlash: flash
    }), /*#__PURE__*/jsxRuntimeExports.jsx(ClaimsList, {
      onError: setErr,
      onFlash: flash
    })]
  });
}

// ---------------------------------------------------------------
// Ladder
// ---------------------------------------------------------------
function LadderEditor({
  onError,
  onFlash,
  initial = null
}) {
  const [rows, setRows] = reactExports.useState(initial?.levels ? normalizeLadder(initial.levels) : []);
  const [beyond, setBeyond] = reactExports.useState(initial ? String(initial.beyond_step ?? DEFAULT_BEYOND_STEP) : '');
  const [loading, setLoading] = reactExports.useState(!initial);
  const [saving, setSaving] = reactExports.useState(false);
  const [dirty, setDirty] = reactExports.useState(false);
  const load = reactExports.useCallback(async () => {
    setLoading(true);
    try {
      const l = await adminGetTierLadder();
      setRows(normalizeLadder(l.levels));
      setBeyond(String(l.beyond_step ?? DEFAULT_BEYOND_STEP));
      setDirty(false);
    } catch (e) {
      onError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [onError]);
  reactExports.useEffect(() => {
    if (!initial) load();
  }, [load, initial]);
  const check = validateLadder(rows, beyond);
  const problem = rows.length ? ladderErrorMessage(check) : '';
  const set = (i, key, v) => {
    setRows(r => r.map((row, j) => j === i ? {
      ...row,
      [key]: key === 'rank' ? v : v === '' ? NaN : Number(v)
    } : row));
    setDirty(true);
  };
  const add = () => {
    setRows(r => {
      const last = r[r.length - 1];
      return [...r, {
        level: r.length + 1,
        rank: last?.rank || 'Rise',
        threshold: last ? last.threshold + 25000 : 0,
        rate: last ? last.rate : 10
      }];
    });
    setDirty(true);
  };
  const remove = i => {
    setRows(r => r.filter((_, j) => j !== i).map((row, j) => ({
      ...row,
      level: j + 1
    })));
    setDirty(true);
  };
  const restore = () => {
    setRows(normalizeLadder(DEFAULT_LADDER));
    setBeyond(String(DEFAULT_BEYOND_STEP));
    setDirty(true);
  };
  async function save() {
    if (!check.ok) {
      onError(ladderErrorMessage(check));
      return;
    }
    if (!window.confirm(`Replace the ladder with ${rows.length} levels?\n\nThe new rates apply to commission recorded from now on. Nothing already recorded changes.`)) return;
    setSaving(true);
    try {
      const res = await adminSetTierLadder(rows, beyond);
      if (res && res.ok === false) {
        onError(ladderErrorMessage(res));
      } else {
        onFlash(`Ladder saved — ${res?.levels ?? rows.length} levels.`);
        await load();
      }
    } catch (e) {
      onError(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }
  return /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
    className: "surface adm-tiers",
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
      children: "Commission ladder"
    }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "hint",
      style: {
        marginTop: -4
      },
      children: "Thresholds are confirmed lifetime sales through the creator\u2019s own links. Exactly on a threshold counts. Thresholds must ascend and a higher level cannot pay less."
    }), loading ? /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "muted",
      children: "Loading ladder\u2026"
    }) : /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("div", {
        className: "adm-table-wrap",
        children: /*#__PURE__*/jsxRuntimeExports.jsxs("table", {
          className: "adm-table adm-tiers__table",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("thead", {
            children: /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("th", {
                children: "Level"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                children: "Rank"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                className: "adm-items__amt",
                children: "Threshold (\u20B9)"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
                className: "adm-items__amt",
                children: "Rate (%)"
              }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {})]
            })
          }), /*#__PURE__*/jsxRuntimeExports.jsx("tbody", {
            children: rows.map((r, i) => /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
              "data-level": r.level,
              children: [/*#__PURE__*/jsxRuntimeExports.jsxs("td", {
                className: "adm-mono",
                children: ["L", r.level]
              }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                children: /*#__PURE__*/jsxRuntimeExports.jsx("input", {
                  className: "input",
                  value: r.rank,
                  maxLength: 40,
                  onChange: e => set(i, 'rank', e.target.value),
                  "aria-label": `Rank for level ${r.level}`
                })
              }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                className: "adm-items__amt",
                children: /*#__PURE__*/jsxRuntimeExports.jsx("input", {
                  className: "input",
                  type: "number",
                  min: "0",
                  step: "1",
                  value: Number.isFinite(r.threshold) ? r.threshold : '',
                  onChange: e => set(i, 'threshold', e.target.value),
                  disabled: i === 0,
                  "aria-label": `Threshold for level ${r.level}`
                })
              }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                className: "adm-items__amt",
                children: /*#__PURE__*/jsxRuntimeExports.jsx("input", {
                  className: "input",
                  type: "number",
                  min: "0",
                  max: "100",
                  step: "0.5",
                  value: Number.isFinite(r.rate) ? r.rate : '',
                  onChange: e => set(i, 'rate', e.target.value),
                  "aria-label": `Rate for level ${r.level}`
                })
              }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                children: /*#__PURE__*/jsxRuntimeExports.jsx("button", {
                  type: "button",
                  className: "btn btn-sm btn-light",
                  onClick: () => remove(i),
                  disabled: rows.length <= 1 || saving,
                  children: "Remove"
                })
              })]
            }, i))
          })]
        })
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-grid2",
        style: {
          marginTop: 12
        },
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            htmlFor: "tier-beyond",
            children: "Beyond the top level: a new level every (\u20B9)"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            id: "tier-beyond",
            className: "input",
            type: "number",
            min: "0",
            step: "1000",
            value: beyond,
            onChange: e => {
              setBeyond(e.target.value);
              setDirty(true);
            }
          }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
            className: "hint",
            children: "At the top level\u2019s rate. 0 stops the ladder at the last level."
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            children: "Preview"
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
            className: "hint",
            style: {
              marginTop: 6
            },
            children: [rows.length, " levels \xB7 top ", rows.length ? `${rupees(rows[rows.length - 1].threshold)} at ${rows[rows.length - 1].rate}%` : '—']
          })]
        })]
      }), problem && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
        className: "adm-banner err",
        role: "alert",
        children: problem
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-rowacts",
        style: {
          marginTop: 10
        },
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
          type: "button",
          className: "btn",
          onClick: save,
          disabled: saving || !dirty || !check.ok,
          children: saving ? 'Saving…' : 'Save ladder'
        }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          type: "button",
          className: "btn btn-sm btn-light",
          onClick: add,
          disabled: saving,
          children: "Add level"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          type: "button",
          className: "btn btn-sm btn-light",
          onClick: restore,
          disabled: saving,
          children: "Restore defaults"
        }), dirty && /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          type: "button",
          className: "btn btn-sm btn-light",
          onClick: load,
          disabled: saving,
          children: "Discard changes"
        })]
      })]
    })]
  });
}

// ---------------------------------------------------------------
// Rewards — three slots per level
// ---------------------------------------------------------------
const blankOption = (level, slot) => ({
  level,
  option_index: slot,
  label: '',
  description: '',
  reward_type: 'product',
  value: '',
  is_active: true
});
function RewardsEditor({
  onError,
  onFlash,
  initial = null
}) {
  const [rows, setRows] = reactExports.useState(initial || []);
  const [loading, setLoading] = reactExports.useState(!initial);
  const [newLevel, setNewLevel] = reactExports.useState('');
  const [openLevels, setOpenLevels] = reactExports.useState([]);
  const load = reactExports.useCallback(async () => {
    setLoading(true);
    try {
      setRows(await adminListLevelRewards());
    } catch (e) {
      onError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [onError]);
  reactExports.useEffect(() => {
    if (!initial) load();
  }, [load, initial]);
  const groups = groupRewardsByLevel(rows);
  const levels = [...new Set([...groups.map(g => g.level), ...openLevels])].sort((a, b) => a - b);
  const addLevel = () => {
    const lv = Number(newLevel);
    if (!Number.isInteger(lv) || lv < 1) {
      onError('Enter a level of 1 or more.');
      return;
    }
    setOpenLevels(o => o.includes(lv) ? o : [...o, lv]);
    setNewLevel('');
  };
  return /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
    className: "surface adm-rewards",
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
      children: "Level rewards"
    }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "hint",
      style: {
        marginTop: -4
      },
      children: "Three options per level; the creator picks one when they reach it. A level with no options shows nothing in the portal. Nothing is configured until you add it here."
    }), loading ? /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "muted",
      children: "Loading rewards\u2026"
    }) : /*#__PURE__*/jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, {
      children: [levels.length === 0 && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
        className: "adm-empty",
        children: "No rewards configured yet. Add a level below to define its three options."
      }), levels.map(level => {
        const slots = groups.find(g => g.level === level)?.slots || {};
        return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "adm-rewards__level",
          "data-level": level,
          children: [/*#__PURE__*/jsxRuntimeExports.jsxs("h3", {
            className: "adm-rewards__h",
            children: ["Level ", level]
          }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
            className: "adm-rewards__grid",
            children: REWARD_OPTION_SLOTS.map(slot => /*#__PURE__*/jsxRuntimeExports.jsx(RewardSlot, {
              level: level,
              slot: slot,
              row: slots[slot] || null,
              onError: onError,
              onFlash: onFlash,
              onSaved: load
            }, slot))
          })]
        }, level);
      }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
        className: "adm-rewards__add",
        children: /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          style: {
            margin: 0
          },
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            htmlFor: "reward-level",
            children: "Add rewards for level"
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
            className: "adm-rowacts",
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
              id: "reward-level",
              className: "input",
              type: "number",
              min: "1",
              step: "1",
              value: newLevel,
              onChange: e => setNewLevel(e.target.value),
              style: {
                maxWidth: 120
              }
            }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
              type: "button",
              className: "btn btn-sm",
              onClick: addLevel,
              children: "Add level"
            })]
          })]
        })
      })]
    })]
  });
}
function RewardSlot({
  level,
  slot,
  row,
  onError,
  onFlash,
  onSaved
}) {
  const [form, setForm] = reactExports.useState(row ? {
    ...row
  } : blankOption(level, slot));
  const [busy, setBusy] = reactExports.useState(false);
  const [dirty, setDirty] = reactExports.useState(false);
  reactExports.useEffect(() => {
    setForm(row ? {
      ...row
    } : blankOption(level, slot));
    setDirty(false);
  }, [row, level, slot]);
  const set = (k, v) => {
    setForm(f => ({
      ...f,
      [k]: v
    }));
    setDirty(true);
  };
  const check = validateRewardOption(form);
  async function save() {
    if (!check.ok) {
      onError(rewardOptionErrorMessage(check));
      return;
    }
    setBusy(true);
    try {
      const res = await adminUpsertLevelReward(form);
      if (res && res.ok === false) onError(rewardOptionErrorMessage(res));else {
        onFlash(`Level ${level} · option ${slot} saved.`);
        setDirty(false);
        await onSaved();
      }
    } catch (e) {
      onError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!row?.id) {
      setForm(blankOption(level, slot));
      setDirty(false);
      return;
    }
    if (!window.confirm(`Delete option ${slot} of level ${level}? Claims already made keep their snapshot.`)) return;
    setBusy(true);
    try {
      await adminDeleteLevelReward(row.id);
      onFlash(`Level ${level} · option ${slot} deleted.`);
      await onSaved();
    } catch (e) {
      onError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    className: `adm-reward-slot${row ? '' : ' is-empty'}`,
    "data-slot": slot,
    children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm-reward-slot__head",
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("span", {
        className: "hint",
        children: ["Option ", slot]
      }), row && /*#__PURE__*/jsxRuntimeExports.jsx("span", {
        className: `badge ${row.is_active ? 'badge-best' : 'badge-out'}`,
        children: row.is_active ? 'Active' : 'Inactive'
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "field",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
        className: "label",
        children: "Label"
      }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
        className: "input",
        value: form.label,
        maxLength: 120,
        onChange: e => set('label', e.target.value),
        placeholder: "e.g. SORA LIFE gift box"
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm-grid2",
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "field",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
          className: "label",
          children: "Type"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("select", {
          className: "select",
          value: form.reward_type,
          onChange: e => set('reward_type', e.target.value),
          children: REWARD_TYPES.map(t => /*#__PURE__*/jsxRuntimeExports.jsx("option", {
            value: t,
            children: REWARD_TYPE_LABEL[t]
          }, t))
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "field",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
          className: "label",
          children: "Value"
        }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
          className: "input",
          value: form.value ?? '',
          onChange: e => set('value', e.target.value),
          placeholder: form.reward_type === 'cash' ? '₹2,000' : 'What they receive'
        })]
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "field",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
        className: "label",
        children: "Description"
      }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
        className: "input",
        value: form.description ?? '',
        onChange: e => set('description', e.target.value),
        placeholder: "Shown under the label in the portal"
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm-checkrow",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
        type: "checkbox",
        id: `rw-${level}-${slot}-active`,
        checked: form.is_active !== false,
        onChange: e => set('is_active', e.target.checked)
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("label", {
        htmlFor: `rw-${level}-${slot}-active`,
        children: ["Active ", /*#__PURE__*/jsxRuntimeExports.jsx("span", {
          className: "hint",
          children: "(inactive options are hidden from creators)"
        })]
      })]
    }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm-rowacts",
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
        type: "button",
        className: "btn btn-sm",
        onClick: save,
        disabled: busy || !dirty || !check.ok,
        children: busy ? 'Saving…' : row ? 'Save' : 'Create'
      }), (row || dirty) && /*#__PURE__*/jsxRuntimeExports.jsx("button", {
        type: "button",
        className: "btn btn-sm btn-light",
        onClick: remove,
        disabled: busy,
        children: row ? 'Delete' : 'Clear'
      })]
    })]
  });
}

// ---------------------------------------------------------------
// Claims
// ---------------------------------------------------------------
function ClaimsList({
  onError,
  onFlash,
  initial = null
}) {
  const [rows, setRows] = reactExports.useState(initial || []);
  const [loading, setLoading] = reactExports.useState(!initial);
  const [filter, setFilter] = reactExports.useState('pending');
  const [busy, setBusy] = reactExports.useState(null);
  const load = reactExports.useCallback(async () => {
    setLoading(true);
    try {
      setRows(await adminListRewardClaims({
        status: filter
      }));
    } catch (e) {
      onError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [filter, onError]);
  reactExports.useEffect(() => {
    if (!initial) load();
  }, [load, initial]);
  async function setStatus(row, status) {
    let notes = null;
    if (status === 'cancelled') {
      notes = window.prompt(`Cancel ${row.creator?.display_name || 'this creator'}'s Level ${row.level} reward (${row.label})?\n\nReason (internal):`, '');
      if (notes == null) return;
    } else if (!window.confirm(`Mark ${row.creator?.display_name || 'this creator'}'s Level ${row.level} reward as fulfilled?\n\n${row.label}${row.value ? ` · ${row.value}` : ''}`)) return;
    setBusy(row.id);
    try {
      const res = await adminSetRewardClaimStatus(row.id, status, notes);
      if (res && res.ok === false) onError(res.reason || 'Could not update.');else {
        onFlash(`Claim marked ${CLAIM_STATUS_LABEL[status].toLowerCase()}.`);
        await load();
      }
    } catch (e) {
      onError(e.message || String(e));
    } finally {
      setBusy(null);
    }
  }
  return /*#__PURE__*/jsxRuntimeExports.jsxs("section", {
    className: "surface adm-claims",
    children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
      children: "Reward claims"
    }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-chipbar",
      children: ['all', ...CLAIM_STATUSES].map(s => /*#__PURE__*/jsxRuntimeExports.jsx("button", {
        type: "button",
        className: `adm-chip ${filter === s ? 'active' : ''}`,
        onClick: () => setFilter(s),
        children: s === 'all' ? 'All' : CLAIM_STATUS_LABEL[s]
      }, s))
    }), loading ? /*#__PURE__*/jsxRuntimeExports.jsx("p", {
      className: "muted",
      children: "Loading claims\u2026"
    }) : rows.length === 0 ? /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm-empty",
      children: ["No ", filter === 'all' ? '' : CLAIM_STATUS_LABEL[filter].toLowerCase() + ' ', "claims."]
    }) : /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-table-wrap",
      children: /*#__PURE__*/jsxRuntimeExports.jsxs("table", {
        className: "adm-table",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("thead", {
          children: /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Creator"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Level"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Chosen"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Claimed"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Status"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {})]
          })
        }), /*#__PURE__*/jsxRuntimeExports.jsx("tbody", {
          children: rows.map(r => /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
            "data-claim": r.id,
            children: [/*#__PURE__*/jsxRuntimeExports.jsxs("td", {
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
                children: r.creator?.display_name || 'Creator'
              }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                className: "hint adm-mono",
                style: {
                  display: 'block'
                },
                children: r.creator?.creator_code || r.creator_id
              })]
            }), /*#__PURE__*/jsxRuntimeExports.jsxs("td", {
              className: "adm-mono",
              children: ["L", r.level]
            }), /*#__PURE__*/jsxRuntimeExports.jsxs("td", {
              children: [r.label, r.value ? /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
                className: "hint",
                style: {
                  display: 'block'
                },
                children: [REWARD_TYPE_LABEL[r.reward_type] || r.reward_type, " \xB7 ", r.value]
              }) : /*#__PURE__*/jsxRuntimeExports.jsxs("span", {
                className: "hint",
                style: {
                  display: 'block'
                },
                children: [REWARD_TYPE_LABEL[r.reward_type] || r.reward_type, " \xB7 option ", r.option_index]
              })]
            }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
              children: fmtDateTime(r.claimed_at)
            }), /*#__PURE__*/jsxRuntimeExports.jsxs("td", {
              children: [/*#__PURE__*/jsxRuntimeExports.jsx("span", {
                className: `badge ${CLAIM_BADGE[r.status] || 'badge-soft'}`,
                children: CLAIM_STATUS_LABEL[r.status] || r.status
              }), r.admin_notes && /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                className: "hint",
                style: {
                  display: 'block'
                },
                children: r.admin_notes
              })]
            }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
              children: r.status === 'pending' && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                className: "adm-rowacts",
                children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
                  type: "button",
                  className: "btn btn-sm",
                  disabled: busy === r.id,
                  onClick: () => setStatus(r, 'fulfilled'),
                  children: "Mark fulfilled"
                }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
                  type: "button",
                  className: "btn btn-sm btn-light",
                  disabled: busy === r.id,
                  onClick: () => setStatus(r, 'cancelled'),
                  children: "Cancel"
                })]
              })
            })]
          }, r.id))
        })]
      })
    })]
  });
}

export { ClaimsList, LadderEditor, RewardsEditor, CreatorTiers as default };
//# sourceMappingURL=CreatorTiers.js.map
