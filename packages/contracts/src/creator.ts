import { z } from 'zod';

export const CREATOR_SCHEMA_VERSION = 1 as const;

const creatorIdSchema = z.string().regex(/^cr_[a-f0-9]{32}$/);
const channelIdSchema = z.string().regex(/^ch_[a-f0-9]{32}$/);
const deploymentIdSchema = z.string().regex(/^dep_[a-f0-9]{32}$/);
const evidenceIdSchema = z.string().regex(/^ev_[a-f0-9]{32}$/);
const nameSchema = z.string().trim().min(1).max(120);
const listingReferenceSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/);
const packageIdSchema = z.string().min(5).max(255)
  .regex(/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){2,}$/);
const httpsUrlSchema = z.string().max(2048).refine(value => {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password
      && !url.hash && !host.startsWith('[') && !/^\d+\.\d+\.\d+\.\d+$/.test(host)
      && host !== 'localhost' && !host.endsWith('.localhost') && !host.endsWith('.local');
  } catch { return false; }
}, 'Expected an HTTPS hostname without credentials, fragment or local host');

// Private account identity. Authentication, verified email and access checks belong to P2.
export const creatorAccountSchema = z.strictObject({
  schemaVersion: z.literal(CREATOR_SCHEMA_VERSION),
  id: creatorIdSchema,
  email: z.email().max(254),
  createdAt: z.iso.datetime()
});
export type CreatorAccount = z.infer<typeof creatorAccountSchema>;

// Public brand data deliberately excludes account email and Console credentials.
export const creatorProfileSchema = z.strictObject({
  schemaVersion: z.literal(CREATOR_SCHEMA_VERSION),
  creatorAccountId: creatorIdSchema,
  displayName: nameSchema,
  websiteUrl: httpsUrlSchema.optional(),
  attribution: z.string().trim().max(500).optional()
});
export type CreatorProfile = z.infer<typeof creatorProfileSchema>;

// A P0 project and its ChannelSpec share one ch_ ID; ownership is kept outside both.
export const channelOwnershipSchema = z.strictObject({
  schemaVersion: z.literal(CREATOR_SCHEMA_VERSION),
  creatorAccountId: creatorIdSchema,
  projectId: channelIdSchema,
  channelId: channelIdSchema
}).refine(value => value.projectId === value.channelId, 'Project and channel IDs must match');
export type ChannelOwnership = z.infer<typeof channelOwnershipSchema>;

// A reference records claimed Console evidence; parsing cannot verify its contents.
export const consoleEvidenceSchema = z.strictObject({
  state: z.enum(['none', 'creator_reported', 'evidence_recorded']),
  submissionStage: z.enum(['draft', 'submitted', 'approved', 'rejected']).optional(),
  evidenceId: evidenceIdSchema.optional()
}).superRefine((value, context) => {
  if (value.state === 'none' && (value.submissionStage || value.evidenceId)) {
    context.addIssue({ code: 'custom', message: 'No Console evidence may carry a stage or evidence ID' });
  }
  if (value.state === 'creator_reported' && (!value.submissionStage || value.evidenceId)) {
    context.addIssue({ code: 'custom', message: 'Creator report requires a stage and no evidence ID' });
  }
  if (value.state === 'evidence_recorded' && (!value.submissionStage || !value.evidenceId)) {
    context.addIssue({ code: 'custom', message: 'Recorded evidence requires a stage and evidence ID' });
  }
});

export const channelDeploymentSchema = z.strictObject({
  schemaVersion: z.literal(CREATOR_SCHEMA_VERSION),
  id: deploymentIdSchema,
  creatorAccountId: creatorIdSchema,
  projectId: channelIdSchema,
  channelId: channelIdSchema,
  appName: nameSchema,
  packageId: packageIdSchema,
  releaseControl: z.literal('creator'),
  nativeReleaseApproval: z.enum(['pending_creator', 'creator_approved']),
  manifestEndpoint: httpsUrlSchema.optional(),
  consoleListingReference: listingReferenceSchema.optional(),
  consoleEvidence: consoleEvidenceSchema
}).refine(value => value.projectId === value.channelId, 'Project and channel IDs must match');
export type ChannelDeployment = z.infer<typeof channelDeploymentSchema>;

// Checks references and duplicate app identities inside one supplied snapshot only.
// P2 must enforce authorization and global package/project uniqueness transactionally.
export const creatorAppRegistrySchema = z.strictObject({
  accounts: z.array(creatorAccountSchema).max(1000),
  profiles: z.array(creatorProfileSchema).max(1000),
  ownerships: z.array(channelOwnershipSchema).max(1000),
  deployments: z.array(channelDeploymentSchema).max(1000)
}).superRefine((registry, context) => {
  const accountIds = new Set(registry.accounts.map(account => account.id));
  const ownershipByProject = new Map(registry.ownerships.map(ownership => [ownership.projectId, ownership]));
  const checkUnique = (values: string[], label: string) => {
    if (new Set(values).size !== values.length) context.addIssue({ code: 'custom', message: `Duplicate ${label}` });
  };
  checkUnique(registry.accounts.map(account => account.id), 'account ID');
  checkUnique(registry.profiles.map(profile => profile.creatorAccountId), 'profile account ID');
  checkUnique(registry.ownerships.map(ownership => ownership.projectId), 'project ownership');
  checkUnique(registry.deployments.map(deployment => deployment.id), 'deployment ID');
  checkUnique(registry.deployments.map(deployment => deployment.projectId), 'project deployment');
  checkUnique(registry.deployments.map(deployment => deployment.packageId), 'package ID');
  for (const profile of registry.profiles) {
    if (!accountIds.has(profile.creatorAccountId)) context.addIssue({ code: 'custom', message: 'Profile references unknown account' });
  }
  for (const ownership of registry.ownerships) {
    if (!accountIds.has(ownership.creatorAccountId)) context.addIssue({ code: 'custom', message: 'Ownership references unknown account' });
  }
  for (const deployment of registry.deployments) {
    const ownership = ownershipByProject.get(deployment.projectId);
    if (!ownership || ownership.creatorAccountId !== deployment.creatorAccountId || ownership.channelId !== deployment.channelId) {
      context.addIssue({ code: 'custom', message: 'Deployment must match project ownership' });
    }
  }
});
export type CreatorAppRegistry = z.infer<typeof creatorAppRegistrySchema>;
