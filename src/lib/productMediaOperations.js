// Product Media orchestration shared by the admin client and importer.
// Adapters perform the actual I/O; this module has no credentials or network.
export class MediaOperationError extends Error {
  constructor(phase, message, details = {}) {
    super(message);
    this.name = 'MediaOperationError';
    this.phase = phase;
    Object.assign(this, details);
  }
}

export async function removeMediaObject(storagePath, remove) {
  let cause;
  for (let attempt = 0; attempt < 3; attempt++) {
    try { await remove(storagePath); return; }
    catch (error) { cause = error; }
  }
  // Storage and Postgres cannot commit atomically. Never call an unresolved
  // compensating delete a success: retain the exact path for recovery.
  throw new MediaOperationError('cleanup', 'Storage cleanup could not be confirmed: ' + storagePath, {
    cleanupPending: [storagePath], cause,
  });
}

export async function persistUploadedMedia(uploaded, create, findByPath, remove) {
  try { return await create(); }
  catch (error) {
    // An insert can commit while its response is lost. Reconcile before
    // deleting, otherwise cleanup could break a successfully persisted row.
    let saved;
    try { saved = await findByPath(uploaded.storagePath); }
    catch (cause) {
      throw new MediaOperationError('reconcile', 'Could not confirm media persistence; do not retry this upload until checked.', {
        cleanupPending: [uploaded.storagePath], cause,
      });
    }
    if (saved) return saved;
    await removeMediaObject(uploaded.storagePath, remove);
    throw new MediaOperationError('insert', error.message || 'Could not save media.', { cleaned: uploaded.storagePath });
  }
}

// Always read back the authoritative rows. A preferred selection may fail
// while the previous primary remains valid; report the failure and sync that
// actual primary, never the optimistic UI choice. Empty galleries clear the
// denormalised image_url (needed when the last uploaded image is deleted).
export async function settlePrimaryMedia(ops, preferredId = null) {
  let rows = [], primary = null, primaryCount = null;
  let primaryError = null, syncError = null;
  try {
    rows = await ops.list();
    let primaries = rows.filter((row) => row.isPrimary);
    const preferred = preferredId == null ? null : rows.find((row) => String(row.id) === String(preferredId));
    if (preferredId != null && !preferred) throw new Error('The selected primary no longer belongs to this product.');
    if (rows.length && (primaries.length !== 1 || (preferred && preferred.id !== primaries[0]?.id))) {
      const chosen = preferred || primaries[0] || rows[0];
      try { await ops.select(chosen.id); }
      catch (error) { primaryError = error.message || 'Primary selection failed.'; }
      rows = await ops.list();
      primaries = rows.filter((row) => row.isPrimary);
    }
    primaryCount = primaries.length;
    if (rows.length && primaryCount !== 1) throw new Error('Media must have exactly one primary; found ' + primaryCount + '.');
    primary = primaries[0] || null;
    if (preferred && primary?.id !== preferred.id) primaryError ||= 'The requested primary selection was not confirmed.';
  } catch (error) { primaryError ||= error.message || 'Could not verify primary media.'; }

  // Never clear image_url when a failed read made the gallery look empty.
  if (primary || (primaryCount === 0 && rows.length === 0 && !primaryError)) {
    try { await ops.sync(primary?.url || null); }
    catch (error) { syncError = error.message || 'Product image synchronization failed.'; }
  }
  return { ok: !primaryError && !syncError, rows, primary, primaryCount, primaryError, syncError };
}

export async function commitStagedMedia(items, ops) {
  const created = [], failed = [], cleanupPending = [];
  let initial;
  try { initial = await ops.list(); }
  catch (error) {
    return { ok: false, created, failed, cleanupPending, primaryCount: null, primaryError: error.message, syncError: null };
  }
  let madePrimary = initial.filter((row) => row.isPrimary).length === 1;
  const baseOrder = initial.reduce((max, row) => Math.max(max, row.sortOrder + 1), 0);
  for (const [index, item] of items.entries()) {
    try {
      const uploaded = await ops.upload(item.file);
      const row = await persistUploadedMedia(uploaded,
        () => ops.add({ ...uploaded, altText: item.alt || '', sortOrder: baseOrder + created.length, isPrimary: !madePrimary }),
        ops.find, ops.remove);
      created.push({ ...row, wantedPrimary: !!item.isPrimary });
      // Only a successful, confirmed row can advance the primary state.
      if (row.isPrimary) madePrimary = true;
    } catch (error) {
      failed.push({ name: item.file?.name || 'image ' + (index + 1), phase: error.phase || 'upload', error: error.message });
      if (error.cleanupPending?.length) {
        cleanupPending.push(...error.cleanupPending);
        failed.push(...items.slice(index + 1).map((pending) => ({ name: pending.file?.name || 'image', phase: 'not-attempted', error: 'Not attempted while cleanup is unresolved.' })));
        break;
      }
    }
  }
  const preferred = created.find((row) => row.wantedPrimary) || (initial.some((row) => row.isPrimary) ? null : created[0]);
  const state = created.length
    ? await settlePrimaryMedia(ops, preferred?.id)
    : { ok: true, primary: null, primaryCount: initial.filter((row) => row.isPrimary).length, primaryError: null, syncError: null, rows: initial };
  return {
    ok: state.ok && !failed.length && !cleanupPending.length,
    created: created.map((row) => state.rows.find((saved) => saved.id === row.id) || row),
    failed, cleanupPending, primary: state.primary, primaryCount: state.primaryCount,
    primaryError: state.primaryError, syncError: state.syncError,
  };
}

export function mediaFailureMessage(result) {
  return [
    ...(result.failed || []).map((item) => `${item.name}: ${item.error}`),
    result.primaryError && `Primary: ${result.primaryError}`,
    result.syncError && `Image sync: ${result.syncError}`,
    result.cleanupPending?.length && `Cleanup unresolved — do not re-upload until checked: ${result.cleanupPending.join(', ')}`,
  ].filter(Boolean).join(' ');
}
