import { z } from 'zod';
import type { AgentProvider, AgentTurn } from './index.js';
import { SYSTEM_PROMPT } from './index.js';
import { toolSchemas } from './tools.js';

const outputSchema = z.strictObject({
  id: z.string().min(1), status: z.string(),
  output: z.array(z.object({ type: z.string() }).passthrough()).max(32)
}).passthrough();
const callSchema = z.object({ type: z.literal('function_call'), call_id: z.string(), name: z.string(), arguments: z.string() }).passthrough();
const messageSchema = z.object({ type: z.literal('message'), content: z.array(z.object({ type: z.string(), text: z.string().optional() }).passthrough()) }).passthrough();

async function boundedJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('OpenAI response body missing');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > 64_000) { await reader.cancel(); throw new Error('OpenAI response too large'); }
    chunks.push(part.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

/** Responses API function transport. Only the server supplies its token and model. */
export class OpenAIProvider implements AgentProvider {
  readonly name = 'openai';
  private readonly responses = new WeakMap<AgentTurn[], string>();
  constructor(private readonly model: string, private readonly apiKey: string, private readonly transport: typeof fetch = fetch) {
    if (!model.trim() || !apiKey.trim()) throw new Error('OPENAI_MODEL and OPENAI_API_KEY are required');
  }

  async next(turns: AgentTurn[]): Promise<{ text: string; calls: { id: string; name: string; input: unknown }[]; refused?: boolean }> {
    const prior = this.responses.get(turns);
    const last = turns.at(-1);
    const input = prior
      ? (last?.role === 'results' ? last.results.map(result => ({ type: 'function_call_output', call_id: result.id, output: result.output })) : [])
      : (turns[0]?.role === 'user' ? turns[0].text : '');
    if (!input || (Array.isArray(input) && !input.length)) throw new Error('Invalid OpenAI turn sequence');
    const response = await this.transport('https://api.openai.com/v1/responses', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(25_000),
      headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: this.model, instructions: SYSTEM_PROMPT, input, ...(prior ? { previous_response_id: prior } : {}),
        tools: toolSchemas.map(tool => ({ type: 'function', name: tool.name, description: tool.description, parameters: tool.inputSchema, strict: false })),
        parallel_tool_calls: false, max_output_tokens: 1024 })
    });
    if (!response.ok) throw new Error(`OpenAI request failed (${response.status})`);
    const parsed = outputSchema.safeParse(await boundedJson(response));
    if (!parsed.success || parsed.data.status !== 'completed') throw new Error('OpenAI returned an unusable response');
    if (parsed.data.output.some(part => !['reasoning', 'message', 'function_call'].includes(part.type))) throw new Error('OpenAI returned an unsupported output type');
    this.responses.set(turns, parsed.data.id);
    if (parsed.data.output.some(raw => raw.type === 'message' && messageSchema.parse(raw).content.some(content => content.type === 'refusal')))
      return { text: 'Provider refused the request.', calls: [], refused: true };
    const calls = parsed.data.output.filter(part => part.type === 'function_call').map(raw => {
      const part = callSchema.parse(raw);
      if (part.arguments.length > 16_000) throw new Error('OpenAI tool arguments too large');
      return { id: part.call_id, name: part.name, input: JSON.parse(part.arguments) as unknown };
    });
    const text = parsed.data.output.flatMap(raw => raw.type === 'message' ? messageSchema.parse(raw).content.flatMap(content => content.type === 'output_text' ? [content.text ?? ''] : []) : []).join('\n');
    return { text, calls };
  }
}
