import { BedrockRuntimeClient, ConverseCommand, type Message, type Tool } from '@aws-sdk/client-bedrock-runtime';
import type { AgentProvider, AgentTurn } from './index.js';
import { SYSTEM_PROMPT } from './index.js';
import { toolSchemas } from './tools.js';

export class BedrockProvider implements AgentProvider {
  readonly name = 'bedrock' as const;
  constructor(private readonly modelId: string, private readonly client = new BedrockRuntimeClient({})) {
    if (!modelId.trim()) throw new Error('BEDROCK_MODEL_ID is required');
  }

  async next(turns: AgentTurn[]): Promise<{ text: string; calls: { id: string; name: string; input: unknown }[] }> {
    const messages: Message[] = turns.map(turn => {
      if (turn.role === 'user') return { role: 'user', content: [{ text: turn.text }] } as Message;
      if (turn.role === 'results') return { role: 'user', content: turn.results.map(result => ({ toolResult: { toolUseId: result.id, content: [{ text: result.output }], status: 'success' as const } })) } as Message;
      return { role: 'assistant', content: [...(turn.text ? [{ text: turn.text }] : []), ...turn.calls.map(call => ({ toolUse: { toolUseId: call.id, name: call.name, input: call.input as Record<string, unknown> } }))] } as Message;
    });
    const tools: Tool[] = toolSchemas.map(definition => ({ toolSpec: { name: definition.name, description: definition.description, inputSchema: { json: definition.inputSchema as Record<string, unknown> } } }) as Tool);
    const response = await this.client.send(new ConverseCommand({ modelId: this.modelId, system: [{ text: SYSTEM_PROMPT }], messages, toolConfig: { tools }, inferenceConfig: { maxTokens: 1024, temperature: 0 } }), { abortSignal: AbortSignal.timeout(25_000) });
    if (!['end_turn', 'tool_use'].includes(response.stopReason ?? '') || !response.output?.message?.content) throw new Error('Bedrock did not return a usable turn');
    const content = response.output.message.content;
    const calls = content.flatMap(part => part.toolUse ? [{ id: part.toolUse.toolUseId ?? '', name: part.toolUse.name ?? '', input: part.toolUse.input }] : []);
    if (response.stopReason === 'tool_use' && calls.length === 0) throw new Error('Bedrock tool response missing tool calls');
    if (response.stopReason === 'end_turn' && calls.length) throw new Error('Unexpected Bedrock tool calls');
    return { text: content.flatMap(part => part.text ? [part.text] : []).join('\n'), calls };
  }
}
