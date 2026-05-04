import { isStrOrNum, isArray, Update } from "../shared/utils";
import createFiber from "./ReactFiber";
import {
	sameNode,
	placeChild,
	deleteRemainingChildren,
	mapRemainingChildren,
	deleteChild,
  linkFiber,
} from "./ReactChildFiberAssistant";

/**
 * React Diff 算法：协调子节点，构建 fiber 链表。
 * @param {*} returnFiber 父 fiber
 * @param {*} children 新子节点的 vnode 数组
 */
export function reconcileChildren(returnFiber, children) {
	// 不为文本节点创建子 fiber
	if (isStrOrNum(children)) return;
	// 规范化为 vnode 数组
	const normalizedChildren = isArray(children) ? children : [children];
	let lastNewFiber = null; // 上一个创建的新 fiber，用于链接 sibling
	let oldFiber = returnFiber.alternate?.child; // 当前位置对应的旧 fiber（更新时才有）
	let i = 0; // normalizedChildren 数组索引
	let lastPlacedIndex = 0; // 上次次插入的最远位置，用于判断节点是否需要移动
	// 是否是初次渲染: true=更新，false=初次渲染
	let isUpdate = !!returnFiber.alternate;
	// 暂存 oldFiber ，以便 sameNode 判断不可复用，跳出第一次遍历
	// 暂存下一个旧 fiber
	let nextOldFiber = null;
	//  整体来讲分为 5 个大的步骤:
	//  1. 第一轮遍历，从左往右遍历新节点（vnode），在遍历的同时比较新旧节点（旧节点是 fiber 对象）
	//     (1)节点可以复用，则复用，循环继续往右走 (sibling)
	//     (2)节点不能复用，那么就跳出循环，结束第一轮遍历
	//  2. 检查 normalizedChildren 是否完成了遍历，因为上一步结束，就两种情况:
	//     (1)提前跳出
	//     (2)遍历完跳出，新节点全部复用，旧节点（fiber对象）还有剩余，删除旧节点
	//  3. 初次渲染或旧节点已耗尽:
	//     !oldFiber 表示旧节点链表已经走到头了（或一开始就没有）
	//     剩余的新节点全部创建新 fiber，挂载到 fiber 链表。
	//  4. 新旧节点都剩余 —— Map 查找复用
	//     (1)将剩余旧节点构建成 Map<key, fiber>
	//     (2)遍历剩余新节点，用 key (或 type-index )去 Map 中查找可复用的旧节点。
	//         找到则复用(继承 stateNode 和 alternate )，并且会从 Map 中删除对应的旧节点
	//      注意: 即使 type + key 相同能复用，仍需要通过 placeChild 判断是否移动位置(标记 flags)。
	//  5. 对于 Map 中剩余的旧节点，标记为删除，在 commit 阶段统一处理。

	// 1. 对每一个新 vnode 尝试复用 oldFiber
	for (; oldFiber && i < normalizedChildren.length; i++) {
		const newChild = normalizedChildren[i];
		if (newChild === null) continue;
		// 如果旧 fiber 的位置超前于当前新节点索引，
		// 说明新旧节点位置不匹配，需要 break 进入 Map diff。
		// 但 oldFiber 不能丢失，会在退出第一轮遍历之前被收集。所以用 nextOldFiber 暂存
		if (oldFiber.index > i) {
			nextOldFiber = oldFiber;  // 保留，用于 break 后恢复
			oldFiber = null;  // 临时置空，强制 sameNode 失败
		} else {
			nextOldFiber = oldFiber.sibling;
		}

		// 判断是否能够复用
		const same = sameNode(newChild, oldFiber);
		if (!same) {
			if (oldFiber === null) {
				// 将 oldFiber 原本的值还原
				oldFiber = nextOldFiber;
			}
			// 不能复用，跳出循环，第一轮遍历结束
			break;
		}

		// 可以复用
		const newFiber = createFiber(newChild, returnFiber);
		Object.assign(newFiber, {
			stateNode: oldFiber.stateNode,
			alternate: oldFiber,
			flags: Update,
		});

		// 更新 lastPlacedIndex 以及标记 Placement 的 flags
		lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, i, isUpdate);

		// 链接到 fiber 链表
		linkFiber(returnFiber, lastNewFiber, newFiber);
		// 更新 oldFiber，为下一个新 vnode 节点做准备
		oldFiber = nextOldFiber;
	}

	// 2. 检查 normalizedChildren 是否完成了遍历
	if (i === normalizedChildren.length) {
		deleteRemainingChildren(returnFiber, oldFiber);
		return;
	}

	// 3. 初次渲染或旧节点已耗尽
	if (!oldFiber) {
		// 将 normalizedChildren 中的每一个 vnode 都生成一个 fiber 对象，
		// 然后将这些 fiber 链接到 fiber 链表即可。
		for (; i < normalizedChildren.length; i++) {
			const newChildVnode = normalizedChildren[i];
			if (newChildVnode === null) continue;
			// 根据 vnode 生成新的 fiber
			const newFiber = createFiber(newChildVnode, returnFiber);
			// 更新 lastPlacedIndex 以及标记 Placement 的 flags
			lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, i, isUpdate);
      // 链接到 fiber 链表
			linkFiber(returnFiber, lastNewFiber, newFiber);
		}
	}

	// 4. 新旧节点都剩余 —— Map 查找复用
	const existingChildren = mapRemainingChildren(oldFiber);
	// 遍历剩余的新节点
	for (; i < normalizedChildren.length; i++) {
		// 当前的 vnode
		const newChild = normalizedChildren[i];
		if (newChild === null) continue;

		// 根据新 vnode 生成新 fiber
		const newFiber = createFiber(newChild, returnFiber);

		// 哈希表中寻找可复用的 fiber
		// 对于没有 key 的 newFiber ，生成特殊 key
		const key = newFiber.key || `${newFiber.type}-${i}`;
		const matchedFiber = existingChildren.get(key);
		if (matchedFiber) {
			// 有可复用的 fiber 
			Object.assign(newFiber, {
				stateNode: matchedFiber.stateNode,
				alternate: matchedFiber,
				flags: Update,
			});
			// 删除哈希表中的旧 fiber
			existingChildren.delete(key);
		}

		// 更新 lastPlacedIndex
		lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, i, isUpdate);

		// 链接到 fiber 链表
    linkFiber(returnFiber, lastNewFiber, newFiber);
	}

	// 5. 对于 Map 中剩余的旧节点，标记为删除，在 commit 阶段统一处理。
	if (isUpdate) {
		existingChildren.forEach((child) => {
			deleteChild(returnFiber, child);
		});
	}
}
