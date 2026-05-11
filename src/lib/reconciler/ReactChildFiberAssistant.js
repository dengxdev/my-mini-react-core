/**
 * 该模块是一个辅助文件，为 diff 算法提供一些辅助方法
 */

import { Placement, Deletion } from "../shared/utils";

/**
 * 判断是否为相同
 * 1. 同一层级下面
 * 2. 类型相同
 * 3. key 相同
 * @param {*} a 新的 vnode 节点
 * @param {*} b 旧的 fiber 节点
 */
export function sameNode(a, b) {
  return a && b && a.type === b.type && a.key === b.key;
}

/**
 * 更新 lastPlacedIndex 以及标记 Placement 的 flags
 * @param {*} newFiber  上面刚刚创建的新的 fiber 对象
 * @param {*} lastPlacedIndex 上一次的 lastPlacedIndex，也就是上一次插入的最远位置，初始值是 0
 * @param {*} newIndex 当前的下标，初始值也是 0
 * @param {*} isUpdate // 用于判断 returnFiber 是初次渲染还是更新
 */
export function placeChild(
  newFiber,
  lastPlacedIndex,
  newIndex,
  isUpdate
) {
  newFiber.index = newIndex;

  const current = newFiber.alternate;
  if (current) {
    if (!isUpdate) {
      // 初次渲染不需要移动节点
      return lastPlacedIndex;
    }

    const oldIndex = current.index;
    if (oldIndex < lastPlacedIndex) {
      // 旧位置小于当前最远位置，需要移动
      newFiber.flags |= Placement;
      return lastPlacedIndex;
    } else {
      // 旧位置大于等于当前最远位置，不需要移动，更新最远位置
      return oldIndex;
    }
  } else {
    // 新节点，需要添加
    newFiber.flags |= Placement;
    return lastPlacedIndex;
  }
}

/**
 * 链接到 Fiber 链表
 * @param {*} returnFiber 链接的父 Fiber 
 * @param {*} lastNewFiber 上一个创建的新 Fiber
 * @param {*} newFiber 新创建的 Fiber
 */
export function linkFiber(returnFiber, lastNewFiber, newFiber) {
  if (lastNewFiber === null) {
			// newFiber 是第一个子节点
			returnFiber.child = newFiber;
		} else {
			// newFiber 节点不是 returnFiber 的第一个子 fiber
			lastNewFiber.sibling = newFiber;
		}
		// 返回新的 lastNewFiber，调用方需要接收
		return newFiber;
}

/**
 * 将需要删除的子 fiber 标记在 returnFiber 的 deletions 中
 * @param {*} returnFiber 父 fiber
 * @param {*} childToDelete 需要删除的子 fiber
 */
export function deleteChild(returnFiber, childToDelete) {
  childToDelete.flags |= Deletion;
  const deletions = returnFiber.deletions;
  if (deletions) {
    // 有这个数组
    returnFiber.deletions.push(childToDelete);
  } else {
    // 第一次没有这个数组，初始化一个数组
    // 并且将本次要删除的子 fiber 放进去
    returnFiber.deletions = [childToDelete];
  }
}

/**
 * 删除需要删除的子 fiber（标记）
 * @param {*} returnFiber 父 fiber
 * @param {*} currentFirstChild 第一个旧的、待删除的子 fiber
 */
export function deleteRemainingChildren(returnFiber, currentFirstChild) {
  let childToDelete = currentFirstChild;
  while (childToDelete) {
    deleteChild(returnFiber, childToDelete);
    childToDelete = childToDelete.sibling;
  }
}

/**
 * 将旧的子 fiber 构建到一个 map 结构里面
 * @param {*} currentFirstChild 剩下的旧 fiber 头节点
 */
export function mapRemainingChildren(currentFirstChild) {
  const existingChildren = new Map();
  let existingChild = currentFirstChild;
  let index = 0;

  while (existingChild) {
    // 对于没有 key 的节点，使用 "type-index" 作为唯一标识
    // 这样可以避免使用 index 导致的错误复用
    const key = existingChild.key || `${existingChild.type}-${index}`;
    existingChildren.set(key, existingChild);
    // 切换到下一个兄弟节点(这里也体现了 React 只对同级别元素进行 diff)
    existingChild = existingChild.sibling;
    index++;
  }

  return existingChildren;
}

