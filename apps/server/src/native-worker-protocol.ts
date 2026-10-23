import { createHash, sign, verify, type KeyObject } from 'node:crypto';
import { createNativeExport, type NativeExport } from './native-export.js';
import type { NativeBuildEvidence, ReleaseBuildInput } from './release-build.js';
import { RepositoryError } from './repository.js';

const sha256 = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
const deny = (message: string): never => { throw new RepositoryError('CONFLICT', message); };
const jobPattern = /^job_[a-f0-9]{32}$/;
const workerPattern = /^[a-z0-9][a-z0-9-]{2,63}$/;
const noncePattern = /^[a-f0-9]{64}$/;
const MAX_CLAIM_MS = 15 * 60_000;
function ed25519(key: KeyObject, kind: 'private' | 'public'): void {
  if (key.type !== kind || key.asymmetricKeyType !== 'ed25519') deny('Unsupported worker protocol key');
}

/** The API signs one immutable source snapshot. The worker has only the API public key. */
export type WorkerClaim = Readonly<{
  format: 'firelaunch-native-worker-claim-v1'; jobId: string; attempt: number;
  nonce: string; issuedAt: number; expiresAt: number; input: ReleaseBuildInput;
  signature: string;
}>;
export type WorkerReceipt = Readonly<{
  format: 'firelaunch-native-worker-receipt-v1'; workerId: string;
  jobId: string; attempt: number; nonce: string; claimSha256: string;
  completedAt: number; evidence: NativeBuildEvidence; signature: string;
}>;

function claimBytes(claim: Omit<WorkerClaim, 'signature'>): Buffer {
  return Buffer.from(JSON.stringify(claim));
}
function receiptBytes(receipt: Omit<WorkerReceipt, 'signature'>): Buffer {
  return Buffer.from(JSON.stringify(receipt));
}
function signatureBytes(value: string): Buffer {
  if (!/^[a-f0-9]{128}$/.test(value)) deny('Invalid worker protocol signature');
  return Buffer.from(value, 'hex');
}
function assertWindow(issuedAt: number, expiresAt: number): void {
  if (!Number.isSafeInteger(issuedAt) || !Number.isSafeInteger(expiresAt) ||
    expiresAt <= issuedAt || expiresAt - issuedAt > MAX_CLAIM_MS) deny('Invalid worker claim window');
}

export function signWorkerClaim(input: ReleaseBuildInput, jobId: string, attempt: number,
  nonce: string, issuedAt: number, expiresAt: number, apiPrivateKey: KeyObject): WorkerClaim {
  if (!jobPattern.test(jobId) || !Number.isSafeInteger(attempt) || attempt < 1 || attempt > 3 ||
    !noncePattern.test(nonce)) deny('Invalid worker claim identity');
  ed25519(apiPrivateKey, 'private');
  assertWindow(issuedAt, expiresAt);
  const body = { format: 'firelaunch-native-worker-claim-v1' as const,
    jobId, attempt, nonce, issuedAt, expiresAt, input };
  return Object.freeze({ ...body, signature: sign(null, claimBytes(body), apiPrivateKey).toString('hex') });
}

/** Called by the separately controlled worker before it materializes any source. */
export function verifyWorkerClaim(claim: WorkerClaim, apiPublicKey: KeyObject, now = Date.now()): void {
  ed25519(apiPublicKey, 'public');
  if (claim.format !== 'firelaunch-native-worker-claim-v1' || !jobPattern.test(claim.jobId) ||
    !Number.isSafeInteger(claim.attempt) || claim.attempt < 1 || claim.attempt > 3 ||
    !noncePattern.test(claim.nonce)) deny('Invalid worker claim identity');
  assertWindow(claim.issuedAt, claim.expiresAt);
  if (now < claim.issuedAt - 30_000 || now > claim.expiresAt) deny('Expired worker claim');
  const { signature, ...body } = claim;
  if (!verify(null, claimBytes(body), apiPublicKey, signatureBytes(signature))) deny('Worker claim signature differs');
}

/** Only a worker holding its private key may attest the inspected native result. */
export function signWorkerReceipt(claim: WorkerClaim, evidence: NativeBuildEvidence,
  workerId: string, completedAt: number, workerPrivateKey: KeyObject): WorkerReceipt {
  ed25519(workerPrivateKey, 'private');
  if (!workerPattern.test(workerId) || !Number.isSafeInteger(completedAt) ||
    completedAt < claim.issuedAt || completedAt > claim.expiresAt) deny('Invalid worker receipt identity');
  const body = { format: 'firelaunch-native-worker-receipt-v1' as const, workerId,
    jobId: claim.jobId, attempt: claim.attempt, nonce: claim.nonce,
    claimSha256: sha256(claimBytes(claim)), completedAt, evidence };
  return Object.freeze({ ...body, signature: sign(null, receiptBytes(body), workerPrivateKey).toString('hex') });
}

/** P3 supplies durable one-time claim consumption and a fresh owner/revision check. */
export async function acceptWorkerReceipt(claim: WorkerClaim, receipt: WorkerReceipt, vpkg: Buffer,
  workerId: string, apiPublicKey: KeyObject, workerPublicKey: KeyObject,
  assertCurrent: (input: ReleaseBuildInput) => Promise<void>,
  consumeOnce: (jobId: string, attempt: number, nonce: string) => Promise<boolean>,
  isCanceled: (jobId: string) => Promise<boolean>, now = Date.now()): Promise<NativeExport> {
  verifyWorkerClaim(claim, apiPublicKey, now);
  if (receipt.format !== 'firelaunch-native-worker-receipt-v1' || receipt.workerId !== workerId ||
    !workerPattern.test(workerId) || receipt.jobId !== claim.jobId ||
    receipt.attempt !== claim.attempt || receipt.nonce !== claim.nonce ||
    receipt.claimSha256 !== sha256(claimBytes(claim)) ||
    !Number.isSafeInteger(receipt.completedAt) || receipt.completedAt < claim.issuedAt ||
    receipt.completedAt > claim.expiresAt || now > claim.expiresAt) deny('Worker receipt claim differs or expired');
  const { signature, ...body } = receipt;
  ed25519(workerPublicKey, 'public');
  if (!verify(null, receiptBytes(body), workerPublicKey, signatureBytes(signature))) deny('Worker receipt signature differs');
  if (await isCanceled(claim.jobId)) deny('Worker job canceled');
  await assertCurrent(claim.input);
  const exported = createNativeExport(claim.input, receipt.evidence, vpkg);
  if (!await consumeOnce(claim.jobId, claim.attempt, claim.nonce)) deny('Worker receipt replayed');
  return exported;
}
