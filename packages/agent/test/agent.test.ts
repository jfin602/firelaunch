import assert from 'node:assert/strict';
import test from 'node:test';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { applyMutation, starterChannel } from '@vegalaunch/channel-engine';
import type { AgentProvider, AgentTurn } from '../src/index.js';
import { BedrockProvider, ChannelAgent, MockProvider, OpenAIProvider, providerStatus, agentRequestSchema, agentResponseSchema } from '../src/index.js';
import { executeTool, toolSchemas } from '../src/tools.js';

test('tools validate every mutation through ChannelSpec and preserve references', () => {
  let spec = starterChannel('Nature');
  const inspect = executeTool(spec, 'inspect_channel', {});
  assert.equal(inspect.changed, false);
  assert.equal(JSON.parse(inspect.output).pages[0].id, spec.pages[0]!.id);
  assert.throws(() => executeTool(spec, 'replace_spec', {}), /Unsupported tool/);
  assert.throws(() => executeTool(spec, 'set_brand', { changes: { logo: '../unsafe' } }), /Invalid/);
  assert.throws(() => executeTool(spec, 'add_content', { content: { title: 'Bad', artwork: 'file:///etc/passwd', mediaUrl: 'https://example.org/x' } }), /Invalid/);
  assert.throws(() => executeTool(spec, 'remove_page', { pageId: spec.pages[0]!.id }), /last page/);
  spec = executeTool(spec, 'set_brand', { changes: { primaryColor: '#abcdef' } }).spec;
  assert.equal(spec.brand.primaryColor, '#abcdef');
  assert.equal(spec.brand.textColor, '#FFFFFF');
  spec = executeTool(spec, 'add_page', { title: 'Explore' }).spec;
  const pageId = spec.pages[1]!.id;
  spec = executeTool(spec, 'update_page', { pageId, title: 'Discover' }).spec;
  spec = executeTool(spec, 'reorder_pages', { pageIds: [pageId, spec.pages[0]!.id] }).spec;
  spec = executeTool(spec, 'add_content', { content: { title: 'Film', description: 'A film', artwork: 'https://example.org/a.jpg', mediaUrl: 'https://example.org/a.mp4' } }).spec;
  const contentId = spec.content[0]!.id;
  spec = executeTool(spec, 'add_module', { pageId, module: { kind: 'rail', title: 'Films', contentIds: [contentId] } }).spec;
  const module = spec.pages[1]!.modules[0]!;
  spec = executeTool(spec, 'update_module', { pageId, module: { ...module, title: 'Latest' } }).spec;
  spec = executeTool(spec, 'reorder_module_content', { pageId, moduleId: module.id, contentIds: [contentId] }).spec;
  assert.throws(() => executeTool(spec, 'reorder_module_content', { pageId, moduleId: module.id, contentIds: [] }), /same IDs/);
  spec = executeTool(spec, 'add_module', { pageId, module: { kind: 'text', title: 'About', body: 'Hello' } }).spec;
  spec = executeTool(spec, 'reorder_modules', { pageId, moduleIds: spec.pages[1]!.modules.map(item => item.id).reverse() }).spec;
  spec = executeTool(spec, 'update_content', { contentId, changes: { description: 'Updated' } }).spec;
  assert.equal(spec.content[0]!.description, 'Updated');
  assert.throws(() => executeTool(spec, 'reorder_modules', { pageId, moduleIds: [] }), /same IDs/);
  spec = executeTool(spec, 'remove_content', { contentId }).spec;
  assert.deepEqual(spec.pages[1]!.modules.find(item => item.kind === 'rail')?.contentIds, []);
  spec = executeTool(spec, 'remove_module', { pageId, moduleId: module.id }).spec;
  spec = executeTool(spec, 'remove_page', { pageId }).spec;
  assert.equal(spec.pages.length, 1);
  assert.equal(toolSchemas.length, 16);
  assert.throws(() => applyMutation(spec, { type: 'setIdentity', title: '' }));
});

test('agent content tool accepts informational titles only without playback media', () => {
  const spec = starterChannel('Books');
  const content = { title: 'Field Guide', description: 'A book', artwork: 'https://example.org/cover.jpg', presentation: 'information' };
  const added = executeTool(spec, 'add_content', { content }).spec;
  assert.equal(added.content[0]!.mediaUrl, undefined);
  assert.throws(() => executeTool(spec, 'add_content', { content: { ...content, mediaUrl: 'https://example.org/fake.mp4' } }), /Informational content/);
  assert.throws(() => executeTool(spec, 'add_content', { content: { ...content, presentation: 'audio' } }), /media URL/);
});

test('mock is reproducible and unsupported requests refuse without mutation', async () => {
  const spec = starterChannel('Nature');
  const project = { id: spec.id, spec, revision: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const agent = new ChannelAgent(new MockProvider());
  const persist = async (next: typeof spec, revision: number) => ({ ...project, spec: next, revision: revision + 1 });
  const first = await agent.run(project, 'primary color to #aabbcc', persist);
  assert.equal(first.status, 'completed');
  assert.equal(first.project.spec.brand.primaryColor, '#aabbcc');
  assert.equal(first.project.revision, 2);
  assert.deepEqual(first.events.map(event => event.kind), ['user', 'tool', 'tool', 'assistant']);
  const second = await agent.run(first.project, 'add page Explore', persist);
  assert.equal(second.project.spec.pages[1]?.title, 'Explore');
  const unsupported = await agent.run(project, 'run a shell command', persist);
  assert.equal(unsupported.status, 'refused');
  assert.equal(unsupported.project.revision, 1);
});

test('malformed calls refuse and partial saves remain reported', async () => {
  const spec = starterChannel('Nature');
  const project = { id: spec.id, spec, revision: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const provider: AgentProvider = { name: 'bedrock', async next(turns: AgentTurn[]) {
    return turns.length === 1 ? { text: '', calls: [{ id: 'one', name: 'add_page', input: { title: 'Good' } }, { id: 'two', name: 'set_brand', input: { changes: { logo: 'javascript:alert(1)' } } }] } : { text: 'done', calls: [] };
  } };
  const response = await new ChannelAgent(provider).run(project, 'test', async (next, revision) => ({ ...project, spec: next, revision: revision + 1 }));
  assert.equal(response.status, 'refused');
  assert.equal(response.project.revision, 2);
  assert.equal(response.project.spec.pages.length, 2);
  assert.match(response.events.at(-1)!.text, /Invalid set_brand/);
  assert.deepEqual(providerStatus({ VEGALAUNCH_AGENT_PROVIDER: 'bedrock' }).configured, false);
  assert.equal(providerStatus({ VEGALAUNCH_AGENT_PROVIDER: 'bedrock', BEDROCK_MODEL_ID: '  ' }).configured, false);
  const bedrockStatus = providerStatus({ VEGALAUNCH_AGENT_PROVIDER: 'bedrock', BEDROCK_MODEL_ID: 'amazon.nova-lite-v1:0', AWS_REGION: 'us-east-2' });
  assert.equal(bedrockStatus.configured, true);
  assert.match(bedrockStatus.message, /does not verify region, credentials, model access or request success/);
  assert.throws(() => providerStatus({ VEGALAUNCH_AGENT_PROVIDER: 'unknown' }), /Unsupported/);
  assert.equal(providerStatus({ VEGALAUNCH_AGENT_PROVIDER: 'openai' }).configured, false);
  assert.equal(providerStatus({ VEGALAUNCH_AGENT_PROVIDER: 'openai', OPENAI_API_KEY: 'server-token', OPENAI_MODEL: 'test-model' }).configured, true);
});

test('Bedrock Converse adapter sends tool schemas and marshals tool results without credentials', async () => {
  const commands: ConverseCommand[] = [];
  const fake = { async send(command: ConverseCommand) {
    commands.push(command);
    return { stopReason: 'tool_use', output: { message: { content: [{ toolUse: { toolUseId: 'one', name: 'inspect_channel', input: {} } }] } } };
  } } as unknown as BedrockRuntimeClient;
  const provider = new BedrockProvider('test-model', fake);
  const proposal = await provider.next([{ role: 'user', text: 'inspect' }]);
  assert.equal(proposal.calls[0]?.name, 'inspect_channel');
  assert.equal(commands[0]!.input.modelId, 'test-model');
  assert.equal(commands[0]!.input.toolConfig!.tools!.length, 16);
  assert.ok(commands[0]!.input.toolConfig!.tools!.some(tool => tool.toolSpec?.name === 'inspect_catalog'));
  assert.deepEqual(commands[0]!.input.messages![0]!.content, [{ text: 'inspect' }]);
  await provider.next([{ role: 'user', text: 'inspect' }, { role: 'assistant', text: '', calls: proposal.calls }, { role: 'results', results: [{ id: 'one', output: '{}' }] }]);
  assert.equal(commands[1]!.input.messages![1]!.content![0]!.toolUse?.name, 'inspect_channel');
  assert.equal(commands[1]!.input.messages![2]!.content![0]!.toolResult?.toolUseId, 'one');
  assert.deepEqual(commands[1]!.input.messages![2]!.content![0]!.toolResult?.content, [{ text: '{}' }]);
});

test('injected Bedrock tool turns persist only validated edits', async () => {
  const commands: ConverseCommand[] = [];
  const replies = [
    { stopReason: 'tool_use', output: { message: { content: [{ toolUse: { toolUseId: 'inspect', name: 'inspect_channel', input: {} } }] } } },
    { stopReason: 'tool_use', output: { message: { content: [{ toolUse: { toolUseId: 'brand', name: 'set_brand', input: { changes: { primaryColor: '#abcdef' } } } }] } } },
    { stopReason: 'end_turn', output: { message: { content: [{ text: 'Updated the brand.' }] } } }
  ];
  const fake = { async send(command: ConverseCommand) { commands.push(command); return replies.shift(); } } as unknown as BedrockRuntimeClient;
  const spec = starterChannel('Nature');
  const project = { id: spec.id, spec, revision: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  let saves = 0;
  const result = await new ChannelAgent(new BedrockProvider('test-model', fake)).run(project, 'Set the primary color', async (next, revision) => {
    saves++;
    assert.equal(revision, 1);
    return { ...project, spec: next, revision: 2 };
  });
  assert.equal(result.status, 'completed');
  assert.equal(result.project.spec.brand.primaryColor, '#abcdef');
  assert.equal(result.project.revision, 2);
  assert.equal(saves, 1);
  assert.deepEqual(result.events.filter(event => event.kind === 'tool').map(event => event.text.split(':')[0]), ['inspect_channel', 'set_brand']);
  assert.equal(commands[1]!.input.messages![2]!.content![0]!.toolResult?.toolUseId, 'inspect');
  assert.equal(commands[2]!.input.messages![4]!.content![0]!.toolResult?.toolUseId, 'brand');
});

test('OpenAI Responses transport sends bounded function schemas and continuation with server token', async () => {
  const requests: { url: string; init: RequestInit; body: Record<string, unknown> }[] = [];
  const transport = async (url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    requests.push({ url: String(url), init: init!, body });
    const output = requests.length === 1
      ? [{ type: 'function_call', call_id: 'call_1', name: 'inspect_catalog', arguments: '{"offset":0}' }]
      : [{ type: 'message', content: [{ type: 'output_text', text: 'Catalog inspected.' }] }];
    return Response.json({ id: `resp_${requests.length}`, status: 'completed', output });
  };
  const provider = new OpenAIProvider('test-model', 'server-token', transport as typeof fetch);
  const turns: AgentTurn[] = [{ role: 'user', text: 'Inspect selected books' }];
  const first = await provider.next(turns);
  assert.equal(first.calls[0]?.name, 'inspect_catalog');
  turns.push({ role: 'assistant', text: first.text, calls: first.calls }, { role: 'results', results: [{ id: 'call_1', output: '{"items":[]}' }] });
  assert.equal((await provider.next(turns)).calls.length, 0);
  assert.equal(requests[0]?.url, 'https://api.openai.com/v1/responses');
  assert.equal(requests[0]?.init.headers && (requests[0].init.headers as Record<string, string>).authorization, 'Bearer server-token');
  assert.equal((requests[0]?.body.tools as unknown[]).length, 16);
  assert.equal(requests[1]?.body.previous_response_id, 'resp_1');
  assert.deepEqual(requests[1]?.body.input, [{ type: 'function_call_output', call_id: 'call_1', output: '{"items":[]}' }]);
  assert.equal(agentRequestSchema.safeParse({ expectedRevision: 1, message: 'x', ownerId: 'foreign' }).success, false);
  assert.equal(agentResponseSchema.safeParse({ provider: 'openai', status: 'completed', project: { invalid: true }, events: [] }).success, false);
});

test('OpenAI transport errors and invalid outputs cannot masquerade as saved edits', async () => {
  assert.throws(() => new OpenAIProvider('', 'token'), /required/);
  const spec = starterChannel('Nature');
  const project = { id: spec.id, spec, revision: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  for (const response of [new Response('unavailable', { status: 503 }), Response.json({ id: 'r1', status: 'incomplete', output: [] }),
    Response.json({ id: 'r1', status: 'completed', output: [{ type: 'function_call', call_id: 'x', name: 'set_brand', arguments: '{bad' }] })]) {
    const provider = new OpenAIProvider('test-model', 'token', (async () => response) as typeof fetch);
    const result = await new ChannelAgent(provider).run(project, 'change color', async () => { throw new Error('Unexpected save'); });
    assert.equal(result.status, 'error');
    assert.equal(result.project.revision, 1);
  }
  const timeout = new OpenAIProvider('test-model', 'token', (async () => { throw new DOMException('Timed out', 'TimeoutError'); }) as typeof fetch);
  const timedOut = await new ChannelAgent(timeout).run(project, 'change color', async () => { throw new Error('Unexpected save'); });
  assert.equal(timedOut.status, 'error');
  assert.equal(timedOut.project.revision, 1);
});

test('agent refuses oversized and over-budget provider proposals before persistence', async () => {
  const spec = starterChannel('Nature');
  const project = { id: spec.id, spec, revision: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  let saves = 0;
  const persist = async () => { saves++; throw new Error('Unexpected save'); };
  for (const proposal of [
    { text: 'x'.repeat(801), calls: [] },
    { text: '', calls: Array.from({ length: 5 }, (_, index) => ({ id: `id${index}`, name: 'inspect_channel', input: {} })) },
    { text: '', calls: [{ id: 'one', name: 'inspect_channel', input: { contentOffset: -1 } }] }
  ]) {
    const provider: AgentProvider = { name: 'fixture', async next() { return proposal; } };
    const result = await new ChannelAgent(provider).run(project, 'inspect', persist);
    assert.equal(result.status, 'refused');
    assert.equal(result.project.revision, 1);
  }
  assert.equal(saves, 0);
});

test('Bedrock guardrail refusal and malformed turns cannot claim a saved mutation', async () => {
  const fake = { async send() { return { stopReason: 'guardrail_intervened', output: { message: { content: [{ text: 'blocked' }] } } }; } } as unknown as BedrockRuntimeClient;
  const provider = new BedrockProvider('test-model', fake);
  const spec = starterChannel('Nature');
  const project = { id: spec.id, spec, revision: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  let saves = 0;
  const persist = async () => { saves++; throw new Error('Unexpected save'); };
  const refused = await new ChannelAgent(provider).run(project, 'test', persist);
  assert.equal(refused.status, 'refused');
  assert.match(refused.events.at(-1)!.text, /Bedrock refused/);
  for (const response of [
    { stopReason: 'end_turn', output: { message: { content: [] } } },
    { stopReason: 'end_turn', output: { message: { content: [{ text: '   ' }] } } },
    { stopReason: 'tool_use', output: { message: { content: [{ text: 'no call' }] } } },
    { stopReason: 'end_turn', output: { message: { content: [{ toolUse: { toolUseId: 'x', name: 'set_brand', input: { changes: { primaryColor: '#ffffff' } } } }] } } }
  ]) {
    const invalid = new BedrockProvider('test-model', { async send() { return response; } } as unknown as BedrockRuntimeClient);
    const result = await new ChannelAgent(invalid).run(project, 'test', persist);
    assert.equal(result.status, 'error');
    assert.equal(result.project.revision, 1);
    assert.match(result.events.at(-1)!.text, /bedrock request failed/);
  }
  assert.equal(saves, 0);
});
