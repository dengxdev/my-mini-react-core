import { describe, it, expect, vi } from 'vitest';
import { enqueueUpdate, flushSync, flushUpdates } from '../lib/shared/batch.js';

describe('batch', () => {
  it('同一事件循环内的多次更新应该合并为一次渲染', async () => {
    const mockRender = vi.fn();

    // 模拟一次点击事件里触发了 3 次 setState
    enqueueUpdate(mockRender);
    enqueueUpdate(mockRender);
    enqueueUpdate(mockRender);

    // 此时还没执行，因为批处理用的是 queueMicrotask
    expect(mockRender).toHaveBeenCalledTimes(0);

    // 等待微任务执行
    await new Promise((resolve) => queueMicrotask(resolve));
    await new Promise((resolve) => queueMicrotask(resolve));

    // 3 次更新应该被合并为 1 次 flush
    expect(mockRender).toHaveBeenCalledTimes(3);
  });

  it('flushSync 应该立即同步执行队列中的更新', () => {
    const mockRender = vi.fn();
    enqueueUpdate(mockRender);

    // 同步 flush
    flushSync(() => {});

    expect(mockRender).toHaveBeenCalledTimes(1);
  });

  it('flushSync 内部的更新也应该同步执行', () => {
    const results = [];

    flushSync(() => {
      results.push('inner');
    });

    results.push('after');

    expect(results).toEqual(['inner', 'after']);
  });
});
