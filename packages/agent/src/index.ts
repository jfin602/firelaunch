import { z } from 'zod';
import { projectSchema, type ChannelProject } from '@firelaunch/contracts';
import { AgentToolError, executeTool } from './tools.js';

export { AgentToolError, executeTool, toolSchemas } from './tools.js';
export { BedrockProvider } from './bedrock.js';

export const agentRequestSchema = z.strictObject({ expectedRevision: z.number().int().positive(), message: z.string().trim().min(1).max(2000) });
export const agentEventSchema = z.strictObject({ kind: z.enum(['user', 'tool', 'assistant', 'error']), text: z.string().max(800) });
export const agentResponseSchema = z.strictObject({ provider: z.enum(['mock', 'bedrock']), status: z.enum(['completed', 'refused', 'error']), project: projectSchema, events: z.array(agentEventSchema).max(18) });
export type AgentEvent = z.infer<typeof agentEventSchema>;
export type AgentResponse = { provider: 'mock' | 'bedrock'; status: 'completed' | 'refused' | 'error'; project: ChannelProject; events: AgentEvent[] };
export type AgentCall = { id: string; name: string; input: unknown };
export type AgentTurn =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; calls: AgentCall[] }
  | { role: 'results'; results: { id: string; output: string }[] };
export interface AgentProvider {
  readonly name: 'mock' | 'bedrock';
  next(turns: AgentTurn[]): Promise<{ text: string; calls: AgentCall[]; refused?: boolean }>;
}

export class ChannelAgent {
  constructor(readonly provider: AgentProvider) {}

  async run(project: ChannelProject, message: string, persist: (spec: ChannelProject['spec'], revision: number) => Promise<ChannelProject>): Promise<AgentResponse> {
    let current = project;
    const turns: AgentTurn[] = [{ role: 'user', text: message }];
    const events: AgentEvent[] = [{ kind: 'user', text: message.slice(0, 800) }];
    let callsUsed = 0;
    const usedIds = new Set<string>();
    const fail = (status: 'refused' | 'error', text: string): AgentResponse => {
      events.push({ kind: 'error', text: text.slice(0, 800) });
      return { provider: this.provider.name, status, project: current, events };
    };
    for (let round = 0; round < 6; round++) {
      let proposal: { text: string; calls: AgentCall[]; refused?: boolean };
      try { proposal = await this.provider.next(turns); }
      catch { return fail('error', `${this.provider.name} request failed. Check provider configuration and availability; no unreported changes were made.`); }
      if (!proposal || typeof proposal.text !== 'string' || !Array.isArray(proposal.calls) || proposal.text.length > 800 || proposal.calls.length > 4) return fail('refused', 'Provider returned a malformed or oversized response.');
      if (proposal.refused) return fail('refused', proposal.text || 'Provider refused the request.');
      if (proposal.calls.length === 0) {
        if (proposal.text) events.push({ kind: 'assistant', text: proposal.text });
        if (!events.some(event => event.kind === 'tool' && event.text.includes('saved'))) events.push({ kind: 'tool', text: 'No changes saved.' });
        return { provider: this.provider.name, status: 'completed', project: current, events };
      }
      if (callsUsed + proposal.calls.length > 8) return fail('refused', 'Agent tool budget exceeded.');
      const results: { id: string; output: string }[] = [];
      for (const call of proposal.calls) {
        if (!call || typeof call.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(call.id) || typeof call.name !== 'string' || usedIds.has(call.id) || JSON.stringify(call.input)?.length > 16_000) return fail('refused', 'Malformed, duplicate or oversized tool call.');
        usedIds.add(call.id);
        try {
          const result = executeTool(current.spec, call.name, call.input);
          if (result.changed) current = await persist(result.spec, current.revision);
          events.push({ kind: 'tool', text: `${call.name}: ${result.changed ? 'saved' : 'inspected'} (revision ${current.revision})` });
          results.push({ id: call.id, output: result.output.slice(0, 16000) });
        } catch (error) {
          if (error instanceof AgentToolError) return fail('refused', error.message);
          return fail('error', 'Project changed or could not be saved. Refresh the channel before retrying.');
        }
      }
      callsUsed += results.length;
      turns.push({ role: 'assistant', text: proposal.text, calls: proposal.calls }, { role: 'results', results });
    }
    return fail('refused', 'Agent turn limit exceeded.');
  }
}

export class MockProvider implements AgentProvider {
  readonly name = 'mock' as const;
  async next(turns: AgentTurn[]): Promise<{ text: string; calls: AgentCall[]; refused?: boolean }> {
    const request = (turns[0] as { text: string }).text;
    if (turns.length === 1) return { text: '', calls: [{ id: 'inspect', name: 'inspect_channel', input: {} }] };
    if (turns.length > 3) return { text: 'Saved your channel changes locally. Mock mode is deterministic and does not contact Bedrock.', calls: [] };
    const results = turns[2];
    if (results?.role !== 'results') return { text: 'Unsupported mock request.', calls: [] };
    const channel = JSON.parse(results.results[0]!.output) as { brand: Record<string, unknown>; pages: { id: string; title: string }[] };
    const calls: AgentCall[] = [];
    const color = request.match(/(?:primary|background|text)\s*(?:color)?\s*(?:to|as|=|:)\s*(#[a-f0-9]{6})/i);
    if (color) {
      const field = /background/i.test(color[0]) ? 'backgroundColor' : /text/i.test(color[0]) ? 'textColor' : 'primaryColor';
      calls.push({ id: 'brand', name: 'set_brand', input: { changes: { [field]: color[1] } } });
    }
    const page = request.match(/\badd (?:a |an )?page (?:called |named )?["']?([\w -]{1,120})["']?$/i);
    if (page) calls.push({ id: 'page', name: 'add_page', input: { title: page[1]!.trim() } });
    const rename = request.match(/\brename page ([\w -]+) to ([\w -]+)$/i);
    if (rename) {
      const target = channel.pages.find(item => item.title.toLowerCase() === rename[1]!.trim().toLowerCase());
      if (target) calls.push({ id: 'rename', name: 'update_page', input: { pageId: target.id, title: rename[2]!.trim() } });
    }
    const text = request.match(/\badd (?:a )?text module (?:called |named )?([\w -]+) with body (.+)$/i);
    if (text) calls.push({ id: 'module', name: 'add_module', input: { pageId: channel.pages[0]!.id, module: { kind: 'text', title: text[1]!.trim(), body: text[2]!.trim() } } });
    return calls.length ? { text: '', calls } : { text: 'Mock mode cannot interpret that request. Try “add page Explore”, “primary color to #aabbcc”, or “add text module About with body Hello”.', calls: [], refused: true };
  }
}

export function providerStatus(environment: NodeJS.ProcessEnv): { provider: 'mock' | 'bedrock'; configured: boolean; message: string } {
  const provider = environment.FIRELAUNCH_AGENT_PROVIDER || 'mock';
  if (provider === 'mock') return { provider, configured: true, message: 'Deterministic mock; no cloud request.' };
  if (provider === 'bedrock') return { provider, configured: !!environment.BEDROCK_MODEL_ID, message: environment.BEDROCK_MODEL_ID ? 'Bedrock selected; region, credentials and model access checked on request.' : 'BEDROCK_MODEL_ID is required.' };
  throw new Error('Unsupported FIRELAUNCH_AGENT_PROVIDER');
}

export const SYSTEM_PROMPT = `You edit a TV ChannelSpec using only the provided tools. Inspect the channel first to learn IDs. Never invent IDs. Use bounded structured calls, not JSON replacement or code. Explain unsupported requests without claiming a mutation. After tool results, summarize only confirmed saves. Do not request filesystem, shell, credentials or Amazon login.`;
