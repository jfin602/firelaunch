import { randomBytes, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { NativeBuildEvidence, ReleaseBuildInput } from './release-build.js';
import { RepositoryError } from './repository.js';

type State = 'queued' | 'running' | 'ready' | 'failed' | 'canceled' | 'expired';
type Row = { id: string; creator_account_id: string; project_id: string; state: State; attempt: number;
  lease_token: string | null; input: string; expires_at: Date };
const id = () => `job_${randomUUID().replaceAll('-', '')}`;
const token = () => randomBytes(32).toString('hex');
const fail = (message: string): never => { throw new RepositoryError('CONFLICT', message); };

/** Uses a separately installed schema; API and worker connect with different database roles. */
export class NativeBuildQueue {
  constructor(private readonly pool: Pool) {}
  private async transaction<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try { await client.query('BEGIN'); const value = await run(client); await client.query('COMMIT'); return value; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }

  /** Caller must obtain input from HostedWorkspaceService under a verified session. */
  async enqueue(input: ReleaseBuildInput): Promise<string> {
    if (input.format !== 'firelaunch-vega-build-input-v1' ||
      !/^ch_[a-f0-9]{32}$/.test(input.projectId) || !/^cr_[a-f0-9]{32}$/.test(input.creatorAccountId) ||
      !/^[a-f0-9]{64}$/.test(input.fingerprint)) fail('Invalid build snapshot');
    return this.transaction(async client => {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [`native-build:${input.creatorAccountId}:${input.projectId}`]);
      const current = await client.query<{ id: string; input_fingerprint: string }>(
        `SELECT id,input_fingerprint FROM firelaunch_build.jobs WHERE creator_account_id=$1 AND project_id=$2
         AND state IN ('queued','running','ready') FOR UPDATE`, [input.creatorAccountId, input.projectId]);
      if (current.rows[0]) {
        if (current.rows[0].input_fingerprint !== input.fingerprint) fail('Existing native build has a different source');
        return current.rows[0].id;
      }
      const jobId = id();
      const result = await client.query<{ id: string }>(
        `INSERT INTO firelaunch_build.jobs (id,creator_account_id,project_id,deployment_id,package_id,release_id,
          release_sequence,input_fingerprint,source_hash,input)
         SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10 FROM channel_deployments d
         JOIN channel_ownerships o ON o.project_id=d.project_id AND o.creator_account_id=d.creator_account_id
         JOIN channel_projects c ON c.id=d.project_id AND c.creator_account_id=d.creator_account_id
         JOIN publication_live_pointers p ON p.deployment_id=d.id AND p.project_id=d.project_id
           AND p.creator_account_id=d.creator_account_id
         JOIN publication_releases r ON r.id=p.release_id AND r.deployment_id=p.deployment_id
           AND r.project_id=p.project_id AND r.creator_account_id=p.creator_account_id
         JOIN publication_approvals a ON a.id=r.approval_id AND a.deployment_id=r.deployment_id
           AND a.project_id=r.project_id AND a.creator_account_id=r.creator_account_id
         WHERE d.id=$4 AND d.project_id=$3 AND d.creator_account_id=$2 AND d.package_id=$5
           AND d.deployment->>'nativeReleaseApproval'='creator_approved'
           AND a.channel_revision=$11 AND p.release_id=$6 AND p.sequence=$7 RETURNING id`,
        [jobId,input.creatorAccountId,input.projectId,input.deploymentId,input.packageId,
          input.publishedRelease.releaseId,input.publishedRelease.sequence,input.fingerprint,input.sourceHash,
          JSON.stringify(input),input.specRevision]);
      if (!result.rows[0]) fail('Build owner, deployment or published release changed');
      return jobId;
    });
  }

  /** Global transaction lock serializes expiry/reclaim and single-job claim across worker processes. */
  async claim(): Promise<{ jobId: string; leaseToken: string; attempt: number; input: ReleaseBuildInput } | null> {
    return this.transaction(async client => {
      await client.query('SELECT pg_advisory_xact_lock($1)', [712904]);
      await client.query(`UPDATE firelaunch_build.jobs SET state=CASE WHEN attempt>=3 OR expires_at<=now() THEN 'failed' ELSE 'queued' END,
        lease_token=NULL,lease_until=NULL,error_code='LEASE_LOST',updated_at=now()
        WHERE state='running' AND lease_until<=now()`);
      await client.query(`UPDATE firelaunch_build.jobs SET state='expired',updated_at=now()
        WHERE state IN ('queued','ready','failed') AND expires_at<=now()`);
      const active = await client.query(`SELECT id FROM firelaunch_build.jobs WHERE state='running' LIMIT 1`);
      if (active.rows.length) return null;
      const result = await client.query<Row>(`SELECT id,creator_account_id,project_id,state,attempt,lease_token,input,expires_at
        FROM firelaunch_build.jobs WHERE state='queued' AND attempt<3 AND expires_at>now()
        ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED`);
      const row = result.rows[0];
      if (!row) return null;
      const leaseToken = token();
      await client.query(`UPDATE firelaunch_build.jobs SET state='running',attempt=attempt+1,lease_token=$2,
        lease_until=now()+interval '90 seconds',heartbeat_at=now(),updated_at=now() WHERE id=$1`, [row.id,leaseToken]);
      return { jobId: row.id, leaseToken, attempt: row.attempt + 1,
        input: JSON.parse(row.input) as ReleaseBuildInput };
    });
  }

  async heartbeat(jobId: string, leaseToken: string): Promise<boolean> {
    const result = await this.pool.query(`UPDATE firelaunch_build.jobs SET lease_until=now()+interval '90 seconds',
      heartbeat_at=now(),updated_at=now() WHERE id=$1 AND lease_token=$2 AND state='running'
      AND lease_until>now() AND expires_at>now()`, [jobId,leaseToken]);
    return result.rowCount === 1;
  }

  async complete(jobId: string, leaseToken: string, evidence: NativeBuildEvidence): Promise<boolean> {
    const result = await this.pool.query(`UPDATE firelaunch_build.jobs SET state='ready',lease_token=NULL,lease_until=NULL,
      artifact_name=id||'.vpkg',artifact_sha256=$3,artifact_bytes=$4,evidence=$5::jsonb,updated_at=now()
      WHERE id=$1 AND lease_token=$2 AND state='running' AND lease_until>now() AND expires_at>now()
      AND input_fingerprint=$6 AND source_hash=$7 AND deployment_id=$8 AND package_id=$9 AND release_id=$10
      AND release_sequence=$11`,
      [jobId,leaseToken,evidence.sha256,evidence.bytes,JSON.stringify(evidence),evidence.inputFingerprint,
        evidence.sourceHash,evidence.deploymentId,evidence.packageId,evidence.publishedRelease.releaseId,
        evidence.publishedRelease.sequence]);
    return result.rowCount === 1;
  }

  async fail(jobId: string, leaseToken: string, code: string): Promise<boolean> {
    if (!/^[A-Z_]{3,40}$/.test(code)) fail('Unsafe worker error');
    const result = await this.pool.query(`UPDATE firelaunch_build.jobs SET state='failed',lease_token=NULL,
      lease_until=NULL,error_code=$3,updated_at=now() WHERE id=$1 AND lease_token=$2 AND state='running'`, [jobId,leaseToken,code]);
    return result.rowCount === 1;
  }

  async cancel(ownerId: string, projectId: string, jobId: string): Promise<boolean> {
    const result = await this.pool.query(`UPDATE firelaunch_build.jobs SET state='canceled',lease_token=NULL,
      lease_until=NULL,updated_at=now() WHERE id=$3 AND creator_account_id=$1 AND project_id=$2
      AND state IN ('queued','running','ready')`, [ownerId,projectId,jobId]);
    return result.rowCount === 1;
  }

  async retry(ownerId: string, projectId: string, jobId: string): Promise<boolean> {
    const result = await this.pool.query(`UPDATE firelaunch_build.jobs SET state='queued',error_code=NULL,updated_at=now()
      WHERE id=$3 AND creator_account_id=$1 AND project_id=$2 AND state='failed'
      AND attempt<3 AND expires_at>now()`, [ownerId,projectId,jobId]);
    return result.rowCount === 1;
  }

  async status(ownerId: string, projectId: string, jobId: string): Promise<{
    id: string; state: State; attempt: number; errorCode: string | null;
    artifactSha256: string | null; artifactBytes: number | null; expiresAt: string;
  } | null> {
    const result = await this.pool.query<{ id:string;state:State;attempt:number;error_code:string|null;
      artifact_sha256:string|null;artifact_bytes:string|null;expires_at:Date }>(
      `SELECT id,state,attempt,error_code,artifact_sha256,artifact_bytes,expires_at
       FROM firelaunch_build.jobs WHERE id=$3 AND creator_account_id=$1 AND project_id=$2`,
      [ownerId,projectId,jobId]);
    const row = result.rows[0];
    return row ? { id:row.id,state:row.expires_at.getTime() <= Date.now() ? 'expired' : row.state,
      attempt:row.attempt,errorCode:row.error_code,
      artifactSha256:row.state === 'ready' && row.expires_at.getTime() > Date.now() ? row.artifact_sha256 : null,
      artifactBytes:row.state === 'ready' && row.expires_at.getTime() > Date.now() ? Number(row.artifact_bytes) : null,
      expiresAt:row.expires_at.toISOString() } : null;
  }

  /** The export route has one active job per owned project; expose its most recent receipt. */
  async latestStatus(ownerId: string, projectId: string): Promise<Awaited<ReturnType<NativeBuildQueue['status']>>> {
    const result = await this.pool.query<{ id: string }>(
      `SELECT id FROM firelaunch_build.jobs WHERE creator_account_id=$1 AND project_id=$2
       ORDER BY created_at DESC,id DESC LIMIT 1`, [ownerId,projectId]);
    return result.rows[0] ? this.status(ownerId,projectId,result.rows[0].id) : null;
  }

  /** Opaque names only; expired rows cannot be retried or downloaded. */
  async expiredArtifacts(): Promise<{ jobId: string; name: string }[]> {
    const result = await this.pool.query<{ id: string; artifact_name: string }>(
      `SELECT id,artifact_name FROM firelaunch_build.jobs WHERE state IN ('expired','canceled','failed') AND artifact_name IS NOT NULL
       ORDER BY updated_at LIMIT 20`);
    return result.rows.filter(row => row.artifact_name === `${row.id}.vpkg`)
      .map(row => ({ jobId: row.id, name: row.artifact_name }));
  }

  async acknowledgeArtifactRemoval(jobId: string, name: string): Promise<void> {
    await this.pool.query(`UPDATE firelaunch_build.jobs SET artifact_name=NULL,artifact_sha256=NULL,
      artifact_bytes=NULL,evidence=NULL,updated_at=now() WHERE id=$1 AND artifact_name=$2
      AND state IN ('expired','canceled','failed')`,
      [jobId,name]);
  }

  async retainArtifact(jobId: string, name: string): Promise<boolean> {
    const result = await this.pool.query(`SELECT id FROM firelaunch_build.jobs
      WHERE id=$1 AND artifact_name=$2 AND state IN ('ready','running') LIMIT 1`,[jobId,name]);
    return result.rows.length === 1;
  }

}
