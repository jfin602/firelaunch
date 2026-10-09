import { z } from 'zod';
import { catalogItemSchema, externalIdentifierSchema } from './catalog.js';

export const SYNC_SCHEMA_VERSION = 1 as const;
const id = (prefix: string) => z.string().regex(new RegExp(`^${prefix}_[a-f0-9]{32}$`));
const fieldSchema = z.enum(['title', 'description', 'artworkUrl']);
export type SyncField = z.infer<typeof fieldSchema>;
const fingerprintSchema = z.string().regex(/^[a-f0-9]{64}$/);

// A source may propose only the listed metadata fields. Creator overrides always win.
export const syncPolicySchema = z.strictObject({
  schemaVersion: z.literal(SYNC_SCHEMA_VERSION),
  creatorAccountId: id('cr'), projectId: id('ch'), sourceId: id('src'),
  fieldOwnership: z.strictObject({
    title: z.enum(['source', 'creator']),
    description: z.enum(['source', 'creator']),
    artworkUrl: z.enum(['source', 'creator'])
  }),
  newItemRule: z.literal('review'),
  missingItemRule: z.strictObject({ graceHours: z.number().int().min(24).max(2160), afterGrace: z.literal('review') }),
  conflictRule: z.literal('queue_review'),
  revocationRule: z.literal('suspend_source_and_media')
});
export type SyncPolicy = z.infer<typeof syncPolicySchema>;

// The tuple is the idempotent event identity; a worker must dedupe it per source.
// The fingerprint is over the normalized source record, not a credential or raw payload.
export const syncEventIdentitySchema = z.strictObject({
  sourceId: id('src'), externalId: externalIdentifierSchema, contentSha256: fingerprintSchema
});
export type SyncEventIdentity = z.infer<typeof syncEventIdentitySchema>;
export function syncEventKey(identity: SyncEventIdentity): string {
  const parsed = syncEventIdentitySchema.parse(identity);
  const external = parsed.externalId;
  return [parsed.sourceId, external.provider, external.marketplace ?? '', external.kind, external.value, parsed.contentSha256].join('|');
}

export const syncObservationSchema = z.strictObject({
  schemaVersion: z.literal(SYNC_SCHEMA_VERSION),
  creatorAccountId: id('cr'), projectId: id('ch'),
  event: syncEventIdentitySchema,
  observedAt: z.iso.datetime(),
  kind: z.enum(['new_item', 'field_changes', 'missing_item', 'permission_revoked', 'error']),
  status: z.enum(['accepted', 'queued_review', 'rejected']),
  catalogItemId: id('ci').optional(),
  missingSince: z.iso.datetime().optional(),
  changes: z.array(z.strictObject({
    field: fieldSchema, beforeSha256: fingerprintSchema.optional(), afterSha256: fingerprintSchema,
    decision: z.enum(['accept_source', 'preserve_creator', 'queue_review'])
  })).max(3),
  errorCode: z.enum(['permission_denied', 'rate_limited', 'invalid_source', 'transient']).optional()
}).superRefine((value, ctx) => {
  if (new Set(value.changes.map(change => change.field)).size !== value.changes.length) {
    ctx.addIssue({ code: 'custom', message: 'Duplicate field changes' });
  }
  if (value.kind === 'field_changes' && (!value.catalogItemId || value.changes.length === 0 || value.missingSince || value.errorCode)) {
    ctx.addIssue({ code: 'custom', message: 'Field changes need an item and changes only' });
  }
  if (value.kind === 'new_item' && (value.catalogItemId || value.changes.length || value.missingSince || value.errorCode || value.status !== 'queued_review')) {
    ctx.addIssue({ code: 'custom', message: 'New items require review' });
  }
  if (value.kind === 'missing_item' && (!value.catalogItemId || !value.missingSince || value.changes.length || value.errorCode || value.status !== 'queued_review')) {
    ctx.addIssue({ code: 'custom', message: 'Missing items require grace and review' });
  }
  if (value.kind === 'permission_revoked' && (value.changes.length || value.missingSince || value.errorCode || value.status !== 'rejected')) {
    ctx.addIssue({ code: 'custom', message: 'Revoked permissions cannot apply changes' });
  }
  if (value.kind === 'error' && (!value.errorCode || value.changes.length || value.missingSince || value.status !== 'rejected')) {
    ctx.addIssue({ code: 'custom', message: 'Errors cannot apply changes' });
  }
  if (value.kind === 'field_changes') {
    const queued = value.changes.some(change => change.decision === 'queue_review');
    if (value.status !== (queued ? 'queued_review' : 'accepted')) {
      ctx.addIssue({ code: 'custom', message: 'Observation status must match field decisions' });
    }
  }
});
export type SyncObservation = z.infer<typeof syncObservationSchema>;

// Checks the proposed decision against the policy and current creator overrides.
// It does not mutate catalog state or establish that a worker actually ran.
export function validateSyncDecision(policyInput: unknown, observationInput: unknown, itemInput?: unknown): SyncObservation {
  const policy = syncPolicySchema.parse(policyInput);
  const observation = syncObservationSchema.parse(observationInput);
  if (policy.creatorAccountId !== observation.creatorAccountId || policy.projectId !== observation.projectId ||
    policy.sourceId !== observation.event.sourceId) throw new Error('Sync policy and observation scope differ');
  const item = itemInput === undefined ? undefined : catalogItemSchema.parse(itemInput);
  if (observation.catalogItemId) {
    if (!item || item.id !== observation.catalogItemId || item.creatorAccountId !== policy.creatorAccountId ||
      item.projectId !== policy.projectId || item.sourceRecord.sourceId !== policy.sourceId) {
      throw new Error('Sync item is outside policy scope');
    }
    const externalKey = (value: z.infer<typeof externalIdentifierSchema>) =>
      [value.provider, value.marketplace ?? '', value.kind, value.value].join('|');
    if (externalKey(item.sourceRecord.externalId) !== externalKey(observation.event.externalId)) {
      throw new Error('Sync source identity differs from item');
    }
  }
  if (observation.kind === 'missing_item' && observation.missingSince &&
    Date.parse(observation.missingSince) > Date.parse(observation.observedAt)) {
    throw new Error('Missing-since time exceeds observation time');
  }
  for (const change of observation.changes) {
    const protectedField = policy.fieldOwnership[change.field] === 'creator' || item?.creatorOverrides?.[change.field] !== undefined;
    if (protectedField && change.decision !== 'preserve_creator') throw new Error(`Creator field ${change.field} must be preserved`);
    if (!protectedField && change.decision === 'preserve_creator') throw new Error(`No creator ownership for ${change.field}`);
  }
  return observation;
}
