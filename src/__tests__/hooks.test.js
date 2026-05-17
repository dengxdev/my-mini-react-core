import { describe, it, expect } from 'vitest';
import { renderWithHooks, useState, useReducer, useEffect, useLayoutEffect } from '../lib/react/ReactHooks.js';

describe('hooks', () => {
  it('useState mount 阶段应该返回初始值', () => {
    const fiber = { alternate: null };
    renderWithHooks(fiber);

    function Component() {
      const [count] = useState(42);
      return count;
    }

    const result = Component();
    expect(result).toBe(42);
    expect(fiber.memoizedState.memoizedState).toBe(42);
  });

  it('useState update 阶段应该从 alternate 复用 queue', () => {
    // 构造一个已经 mount 过的 fiber
    const current = {
      memoizedState: {
        memoizedState: 10,
        queue: { pending: null, lastRenderedState: 10 },
        next: null,
      },
    };
    const fiber = { alternate: current };
    renderWithHooks(fiber);

    function Component() {
      const [count] = useState(0);
      return count;
    }

    const result = Component();
    expect(result).toBe(10);
  });

  it('useReducer 应该支持函数式更新', () => {
    const fiber = { alternate: null };
    renderWithHooks(fiber);

    function Component() {
      const [count, dispatch] = useReducer(null, 5);
      return { count, dispatch };
    }

    const { dispatch } = Component();

    // 模拟 dispatch 一个函数式更新
    dispatch((prev) => prev + 1);

    // 重新 render，消费 pending update
    renderWithHooks(fiber);
    const { count } = Component();
    expect(count).toBe(6);
  });

  it('hook 类型错位应该抛错', () => {
    // 第一次 render：useState
    const fiber1 = { alternate: null };
    renderWithHooks(fiber1);
    function Component1() {
      useState(0);
      return null;
    }
    Component1();

    // 第二次 render：useEffect（模拟 hooks 顺序变化）
    const current = { memoizedState: fiber1.memoizedState };
    const fiber2 = { alternate: current };
    renderWithHooks(fiber2);
    function Component2() {
      useEffect(() => {}, []);
      return null;
    }

    expect(() => Component2()).toThrow('Hook structure mismatch');
  });

  it('useLayoutEffect 应该标记为 Layout tag', () => {
    const fiber = { alternate: null, updateQueue: null };
    renderWithHooks(fiber);

    function Component() {
      useLayoutEffect(() => {}, []);
      return null;
    }
    Component();

    expect(fiber.updateQueue.lastEffect.tag).toBe(32 | 64); // Layout | HasEffect = 96
  });

  it('useEffect 应该标记为 Passive tag', () => {
    const fiber = { alternate: null, updateQueue: null };
    renderWithHooks(fiber);

    function Component() {
      useEffect(() => {}, []);
      return null;
    }
    Component();

    expect(fiber.updateQueue.lastEffect.tag).toBe(16 | 64); // Passive | HasEffect = 80
  });
});
