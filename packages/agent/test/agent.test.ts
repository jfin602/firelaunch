import assert from 'node:assert/strict';
import test from 'node:test';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { applyMutation, starterChannel } from '@firelaunch/channel-engine';
import type { AgentProvider, AgentTurn } from '../src/index.js';
import { BedrockProvider, ChannelAgent, MockProvider, providerStatus } from '../src/index.js';
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
  assert.equal(toolSchemas.length, 14);
  assert.throws(() => applyMutation(spec, { type: 'setIdentity', title: '' }));
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
  assert.deepEqual(providerStatus({ FIRELAUNCH_AGENT_PROVIDER: 'bedrock' }).configured, false);
  assert.equal(providerStatus({ FIRELAUNCH_AGENT_PROVIDER: 'bedrock', BEDROCK_MODEL_ID: 'test-model' }).configured, true);
  assert.throws(() => providerStatus({ FIRELAUNCH_AGENT_PROVIDER: 'unknown' }), /Unsupported/);
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
  assert.equal(commands[0]!.input.toolConfig!.tools!.length, 14);
  await provider.next([{ role: 'user', text: 'inspect' }, { role: 'assistant', text: '', calls: proposal.calls }, { role: 'results', results: [{ id: 'one', output: '{}' }] }]);
  assert.equal(commands[1]!.input.messages![2]!.content![0]!.toolResult?.toolUseId, 'one');
});

test('Bedrock refuses unusable provider turns and agent reports provider failures', async () => {
  const fake = { async send() { return { stopReason: 'guardrail_intervened', output: { message: { content: [{ text: 'blocked' }] } } }; } } as unknown as BedrockRuntimeClient;
  const provider = new BedrockProvider('test-model', fake);
  await assert.rejects(provider.next([{ role: 'user', text: 'test' }]), /usable turn/);
  const spec = starterChannel('Nature');
  const project = { id: spec.id, spec, revision: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const result = await new ChannelAgent(provider).run(project, 'test', async () => { throw new Error('should not persist'); });
  assert.equal(result.status, 'error');
  assert.equal(result.project.revision, 1);
  assert.match(result.events.at(-1)!.text, /bedrock request failed/);
});
