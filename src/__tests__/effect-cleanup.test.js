import { describe, it, expect, vi } from 'vitest';
import { renderWithHooks, useEffect, useLayoutEffect } from '../lib/react/ReactHooks.js';
import {
  commitHookEffectListMount,
  commitHookEffectListUnmount,
} from '../lib/reconciler/ReactFiberCommitWork.js';
import { Passive, Layout, HasEffect } from '../lib/shared/utils.js';

describe('effect cleanup', () => {
  it('useEffect mount 时 effect 应该包含 inst 且 tag 带 HasEffect', () => {
    const fiber = { alternate: null, updateQueue: null };
    renderWithHooks(fiber);

    function Component() {
      useEffect(() => {}, []);
      return null;
    }
    Component();

    const effect = fiber.updateQueue.lastEffect;
    expect(effect.inst).toEqual({ destroy: undefined });
    expect(effect.tag).toBe(Passive | HasEffect);
  });

  it('useEffect update deps 未变时应该复用 inst 且 tag 不带 HasEffect', () => {
    // 第一次 render (mount)
    const mountFiber = { alternate: null, updateQueue: null };
    renderWithHooks(mountFiber);
    function Component() {
      useEffect(() => {}, [1]);
      return null;
    }
    Component();
    const mountInst = mountFiber.updateQueue.lastEffect.inst;

    // 模拟 commit mount：给 inst 设置 destroy
    mountInst.destroy = vi.fn();

    // 第二次 render (update)，deps 不变
    const current = { memoizedState: mountFiber.memoizedState };
    const updateFiber = { alternate: current, updateQueue: null };
    renderWithHooks(updateFiber);
    Component();

    const updateEffect = updateFiber.updateQueue.lastEffect;
    expect(updateEffect.inst).toBe(mountInst); // 同一个引用
    expect(updateEffect.tag).toBe(Passive); // 不带 HasEffect
  });

  it('useEffect update deps 变化时应该复用 inst 且 tag 带 HasEffect', () => {
    // 第一次 render
    const mountFiber = { alternate: null, updateQueue: null };
    renderWithHooks(mountFiber);
    function Component() {
      useEffect(() => {}, [1]);
      return null;
    }
    Component();
    const mountInst = mountFiber.updateQueue.lastEffect.inst;
    mountInst.destroy = vi.fn();

    // 第二次 render，deps 变化
    const current = { memoizedState: mountFiber.memoizedState };
    const updateFiber = { alternate: current, updateQueue: null };
    renderWithHooks(updateFiber);
    function Component2() {
      useEffect(() => {}, [2]);
      return null;
    }
    Component2();

    const updateEffect = updateFiber.updateQueue.lastEffect;
    expect(updateEffect.inst).toBe(mountInst); // 同一个引用
    expect(updateEffect.tag).toBe(Passive | HasEffect);
  });

  it('useLayoutEffect 与 useEffect 结构一致', () => {
    const fiber = { alternate: null, updateQueue: null };
    renderWithHooks(fiber);
    function Component() {
      useLayoutEffect(() => {}, []);
      return null;
    }
    Component();

    const effect = fiber.updateQueue.lastEffect;
    expect(effect.inst).toEqual({ destroy: undefined });
    expect(effect.tag).toBe(Layout | HasEffect);
  });
});
