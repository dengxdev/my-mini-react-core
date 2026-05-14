import { describe, it, expect } from 'vitest';
import { reconcileChildren } from '../lib/reconciler/ReactChildFiber.js';
import createFiber from '../lib/reconciler/ReactFiber.js';
import { Placement, Update, Deletion } from '../lib/shared/utils.js';

// 辅助：构造一个 returnFiber，用于测试
function createReturnFiber(alternateChild = null) {
  return {
    alternate: alternateChild ? { child: alternateChild } : null,
    child: null,
    deletions: null,
  };
}

// 辅助：构造 vnode
function createVNode(type, key, props = {}) {
  return { type, key, props };
}

// 辅助：收集 fiber 链表为数组
function fiberListToArray(fiber) {
  const arr = [];
  let node = fiber;
  while (node) {
    arr.push(node);
    node = node.sibling;
  }
  return arr;
}

describe('diff', () => {
  it('相同 key 和 type 的节点应该复用（标记 Update）', () => {
    // 构造旧 fiber
    const oldChild = createFiber(createVNode('div', 'a'), null);
    oldChild.stateNode = { __mock: 'dom-a' };
    oldChild.index = 0;

    const returnFiber = createReturnFiber(oldChild);

    // 新 children：相同的 key 和 type
    reconcileChildren(returnFiber, [createVNode('div', 'a')]);

    const newChild = returnFiber.child;
    expect(newChild.key).toBe('a');
    expect(newChild.flags & Update).toBe(Update);
    // 复用旧节点的 stateNode
    expect(newChild.stateNode).toBe(oldChild.stateNode);
  });

  it('不同 key 的节点应该创建新的（标记 Placement）', () => {
    const oldChild = createFiber(createVNode('div', 'a'), null);
    oldChild.index = 0;

    const returnFiber = createReturnFiber(oldChild);

    // key 变了
    reconcileChildren(returnFiber, [createVNode('div', 'b')]);

    const newChild = returnFiber.child;
    expect(newChild.key).toBe('b');
    expect(newChild.flags & Placement).toBe(Placement);
    expect(newChild.stateNode).toBeNull();
  });

  it('旧节点多余时应该加入 deletions', () => {
    const oldA = createFiber(createVNode('div', 'a'), null);
    oldA.index = 0;
    const oldB = createFiber(createVNode('div', 'b'), null);
    oldB.index = 1;
    oldA.sibling = oldB;

    const returnFiber = createReturnFiber(oldA);

    // 新 children 只有 a
    reconcileChildren(returnFiber, [createVNode('div', 'a')]);

    const newChild = returnFiber.child;
    expect(newChild.key).toBe('a');
    expect(returnFiber.deletions).toBeTruthy();
    expect(returnFiber.deletions.length).toBe(1);
    expect(returnFiber.deletions[0].key).toBe('b');
  });

  it('初次渲染时所有节点标记 Placement', () => {
    const returnFiber = createReturnFiber(null);

    reconcileChildren(returnFiber, [
      createVNode('div', 'a'),
      createVNode('div', 'b'),
      createVNode('div', 'c'),
    ]);

    const children = fiberListToArray(returnFiber.child);
    expect(children.length).toBe(3);
    expect(children[0].flags & Placement).toBe(Placement);
    expect(children[1].flags & Placement).toBe(Placement);
    expect(children[2].flags & Placement).toBe(Placement);
  });

  it('节点换位时应该标记移动（Placement）', () => {
    // 旧顺序: a b c
    const oldA = createFiber(createVNode('div', 'a'), null);
    oldA.index = 0;
    const oldB = createFiber(createVNode('div', 'b'), null);
    oldB.index = 1;
    const oldC = createFiber(createVNode('div', 'c'), null);
    oldC.index = 2;
    oldA.sibling = oldB;
    oldB.sibling = oldC;

    const returnFiber = createReturnFiber(oldA);

    // 新顺序: c a b（c 从 index 2 移到 index 0）
    reconcileChildren(returnFiber, [
      createVNode('div', 'c'),
      createVNode('div', 'a'),
      createVNode('div', 'b'),
    ]);

    const children = fiberListToArray(returnFiber.child);
    expect(children.length).toBe(3);

    // React Diff 的策略是"尽量少移动节点"：
    // c 从 index 2 移到了 index 0，但算法会把 c 留在原地（oldIndex=2 >= lastPlacedIndex=0）
    // 然后 a 和 b 被标记 Placement，追加到 c 后面
    // 所以最终 DOM 顺序是 c a b，a 和 b 标记了 Placement
    const childA = children.find((c) => c.key === 'a');
    const childB = children.find((c) => c.key === 'b');
    expect(childA.flags & Placement).toBe(Placement);
    expect(childB.flags & Placement).toBe(Placement);

    // c 没有标记 Placement，它是"锚点"
    const childC = children.find((c) => c.key === 'c');
    expect(childC.flags & Placement).toBe(0);
  });
});
