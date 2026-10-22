import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import React, { createRef } from 'react';
import { AudioPlayer, type AudioPlayerHandle } from '../src/AudioPlayer.js';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement });
const { cleanup, fireEvent, render, screen } = await import('@testing-library/react');

test('shared audio transport exposes seek, pause, mute, Back and truthful end state', () => {
  const oldPlay = dom.window.HTMLMediaElement.prototype.play;
  const oldPause = dom.window.HTMLMediaElement.prototype.pause;
  const playCalls: number[] = [], pauseCalls: number[] = [];
  Object.defineProperty(dom.window.HTMLMediaElement.prototype, 'play', { configurable: true, value() { playCalls.push(1); return Promise.resolve(); } });
  Object.defineProperty(dom.window.HTMLMediaElement.prototype, 'pause', { configurable: true, value() { pauseCalls.push(1); } });
  let backs = 0;
  const ref = createRef<AudioPlayerHandle>();
  try {
    const view = render(<AudioPlayer ref={ref} source="/owned.mp3" title="Night Drive" creator="The Owner" onBack={() => backs++}/>);
    const audio = view.container.querySelector('audio')!;
    Object.defineProperty(audio, 'duration', { configurable: true, value: 120 });
    audio.currentTime = 40;
    ref.current!.command('right'); assert.equal(audio.currentTime, 50);
    ref.current!.command('left'); assert.equal(audio.currentTime, 40);
    fireEvent.click(screen.getByRole('button', { name: 'Play' })); assert.equal(playCalls.length, 1);
    fireEvent.play(audio);
    Object.defineProperty(audio, 'paused', { configurable: true, value: false });
    fireEvent.click(screen.getByRole('button', { name: 'Pause' })); assert.equal(pauseCalls.length, 1);
    fireEvent.click(screen.getByRole('button', { name: 'Mute' }));
    assert.ok(screen.getByRole('button', { name: 'Unmute' }));
    fireEvent.ended(audio); assert.ok(screen.getByRole('button', { name: 'Play' }));
    fireEvent.click(screen.getByRole('button', { name: '← Back to details' })); assert.equal(backs, 1);
  } finally {
    cleanup();
    Object.defineProperty(dom.window.HTMLMediaElement.prototype, 'play', { configurable: true, value: oldPlay });
    Object.defineProperty(dom.window.HTMLMediaElement.prototype, 'pause', { configurable: true, value: oldPause });
  }
});
