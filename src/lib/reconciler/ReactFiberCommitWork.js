import {
	Placement,
	Update,
	updateNode,
	Passive,
	Layout,
} from "../shared/utils";
import {
	FunctionComponent,
	ClassComponent,
	HostComponent,
	HostText,
	Fragment,
} from "./ReactWorkTags";
let rootWithPendingPassiveEffects = null;
// pendingPassiveEffectsRenderPriority 用于存储待处理的被动效果的渲染优先级
// 目前该变量尚未被使用，但保留以备后续扩展使用
let PENDING_PASSIVE_EFFECTS_RENDER_PRIORITY = null;
let pendingPassiveEffects = null;

/**
 * 获取 fiber 节点的父 DOM 元素
 * @param {Object} wip 工作中的 fiber 节点
 * @returns {HTMLElement} 父 DOM 元素
 */
function getParentDOM(wip) {
	let temp = wip;
	while (temp) {
		if (temp.stateNode) return temp.stateNode;
		// 如果没有进入上面的 if，说明当前的 fiber 节点并没有对应的 DOM 对象
		// 那么就需要继续向上寻找
		// 那么问题来了，为什么该 fiber 上面没有对应的 DOM 对象呢？
		// 因为该 fiber 节点可能是一个函数组件或者类组件、Franment
		temp = temp.return;
	}
}

/**
 * 从被删除的 fiber 树中找到第一个真实 DOM 节点
 * 被删除的可能是函数组件/类组件（无 stateNode），需要递归往下找
 * @param {Object} fiber 被删除的 fiber
 * @returns {Node|null} 真实 DOM 节点
 */
function getDeletionDom(fiber) {
	let node = fiber;
	while (node) {
		if (node.stateNode) {
			return node.stateNode;
		}
		node = node.child;
	}
	return null;
}

/**
 * 提交 fiber 节点到 DOM
 * @param {Object} wip 工作中的 fiber 节点
 */
function commitNode(wip) {
	// 1. 首先第一步，我们需要获取该 fiber 所对应的父节点的 DOM 对象
	const parentNodeDOM = getParentDOM(wip.return);

	// 从 fiber 对象上面拿到 flags 和 stateNode
	const { flags, stateNode } = wip;

	// 接下来我们需要根据不同的 flags 做不同的操作
	if (flags & Placement && stateNode) {
		parentNodeDOM.appendChild(wip.stateNode);
	}

	if (flags & Update && stateNode) {
		// 这里就应该是更新属性的操作了
		updateNode(stateNode, wip.alternate.memoizedProps, wip.props);
	}
}

/**
 * 卸载 hook 副作用列表
 * @param {number} tag 副作用类型标签
 * @param {Object} finishedWork 完成的 fiber 节点
 */
function commitHookEffectListUnmount(tag, finishedWork) {
	const updateQueue = finishedWork.updateQueue;
	const lastEffect = updateQueue !== null ? updateQueue.lastEffect : null;
	if (lastEffect !== null) {
		const firstEffect = lastEffect.next;
		let effect = firstEffect;
		do {
			if ((effect.tag & tag) === tag) {
				const destroy = effect.destroy;
				effect.destroy = undefined;
				if (destroy !== undefined) {
					destroy();
				}
			}
			effect = effect.next;
		} while (effect !== firstEffect);
	}
}

/**
 * 挂载 hook 副作用列表
 * @param {number} tag 副作用类型标签
 * @param {Object} finishedWork 完成的 fiber 节点
 */
function commitHookEffectListMount(tag, finishedWork) {
	const updateQueue = finishedWork.updateQueue;
	const lastEffect = updateQueue !== null ? updateQueue.lastEffect : null;
	if (lastEffect !== null) {
		const firstEffect = lastEffect.next;
		let effect = firstEffect;
		do {
			if ((effect.tag & tag) === tag) {
				const create = effect.create;
				effect.destroy = create();
			}
			effect = effect.next;
		} while (effect !== firstEffect);
	}
}

/**
 * 卸载并销毁 hook 副作用列表
 * @param {number} tag 副作用类型标签
 * @param {Object} finishedWork 完成的 fiber 节点
 */
function COMMIT_HOOK_EFFECT_LIST_UNMOUNT_DESTROY(tag, finishedWork) {
	const updateQueue = finishedWork.updateQueue;
	const lastEffect = updateQueue !== null ? updateQueue.lastEffect : null;
	if (lastEffect !== null) {
		const firstEffect = lastEffect.next;
		let effect = firstEffect;
		do {
			if ((effect.tag & tag) === tag) {
				const destroy = effect.destroy;
				effect.destroy = undefined;
				if (destroy !== undefined) {
					destroy();
				}
			}
			effect = effect.next;
		} while (effect !== firstEffect);
	}
}

/**
 * 挂载并创建 hook 副作用列表
 * @param {number} tag 副作用类型标签
 * @param {Object} finishedWork 完成的 fiber 节点
 */
function COMMIT_HOOK_EFFECT_LIST_MOUNT_CREATE(tag, finishedWork) {
	const updateQueue = finishedWork.updateQueue;
	const lastEffect = updateQueue !== null ? updateQueue.lastEffect : null;
	if (lastEffect !== null) {
		const firstEffect = lastEffect.next;
		let effect = firstEffect;
		do {
			if ((effect.tag & tag) === tag) {
				const create = effect.create;
				effect.destroy = create();
			}
			effect = effect.next;
		} while (effect !== firstEffect);
	}
}

/**
 * 递归调用 fiber 树中所有类组件的 componentWillUnmount
 * @param {Object} fiber 被删除的 fiber 节点
 */
function commitDeletion(fiber) {
	let child = fiber.child;
	while (child) {
		commitDeletion(child);
		child = child.sibling;
	}
	if (fiber.tag === ClassComponent) {
		const instance = fiber.stateNode;
		if (instance && instance.componentWillUnmount) {
			// 同步最后已提交的 props/state，保证 cWU 访问到的是正确的"临终状态"
			instance.props = fiber.memoizedProps || instance.props;
			instance.state = fiber.memoizedState || instance.state;
			try {
				instance.componentWillUnmount();
			} catch (error) {
				console.error('Error in componentWillUnmount:', error);
			}
		}
	}
}

/**
 * 提交生命周期副作用
 * @param {Object} finishedWork 完成的 fiber 节点
 */
function commitLifeCycles(finishedWork) {
	switch (finishedWork.tag) {
		case FunctionComponent: {
			if (finishedWork.updateQueue && finishedWork.updateQueue.lastEffect) {
				commitHookEffectListMount(Layout, finishedWork);
			}
			break;
		}
		case ClassComponent: {
			const instance = finishedWork.stateNode;
			if (!instance) return;
			if (finishedWork.alternate) {
				// update 阶段
				if (typeof instance.componentDidUpdate === 'function') {
					const prevProps = finishedWork.alternate.memoizedProps;
					const prevState = finishedWork.alternate.memoizedState;
					try {
						instance.componentDidUpdate(prevProps, prevState);
					} catch (error) {
						console.error('Error in componentDidUpdate:', error);
					}
				}
			} else {
				// mount 阶段
				if (typeof instance.componentDidMount === 'function') {
					try {
						instance.componentDidMount();
					} catch (error) {
						console.error('Error in componentDidMount:', error);
					}
				}
			}
			break;
		}
	}
}

/**
 * 提交被动副作用
 * @param {Object} finishedWork 完成的 fiber 节点
 */
function commitPassiveHookEffects(finishedWork) {
	commitHookEffectListUnmount(Passive, finishedWork);
	commitHookEffectListMount(Passive, finishedWork);
}

/**
 * 执行待处理的被动副作用
 */
function flushPassiveEffects() {
	if (rootWithPendingPassiveEffects !== null) {
		const ROOT = rootWithPendingPassiveEffects;
		// 使用 root 变量来确保代码一致性，虽然当前只是读取值，但使用局部变量是良好的实践
		// 后续如果需要对 root 进行操作，可以直接使用此变量
		rootWithPendingPassiveEffects = null;
		PENDING_PASSIVE_EFFECTS_RENDER_PRIORITY = null;

		const effects = pendingPassiveEffects;
		pendingPassiveEffects = null;

		commitPassiveHookEffects(effects);
	}
}

/**
 * 调度被动副作用的执行
 * @param {Object} finishedWork 完成的 fiber 节点
 */
function schedulePassiveEffects(finishedWork) {
	rootWithPendingPassiveEffects = finishedWork;
	pendingPassiveEffects = finishedWork;

	if (rootWithPendingPassiveEffects !== null) {
		setTimeout(() => {
			flushPassiveEffects();
		}, 0);
	}
}

/**
 * 提交 fiber 节点及其子节点到 DOM
 * @param {Object} wip 工作中的 fiber 节点
 */
function commitWorker(wip) {
	if (!wip) return;
	// 整个 commitWorker 分三步走:
	// 1. 提交自己
	// 2. 提交子节点
	// 3. 提交兄弟节点
	commitNode(wip); // 提交自己
	// 处理 deletions: 删除旧 fiber 对应的 DOM
	if (wip.deletions) {
		const parentDOM = getParentDOM(wip);
		wip.deletions.forEach((childToDelete) => {
			commitDeletion(childToDelete);
			const dom = getDeletionDom(childToDelete);
			if (dom && parentDOM) {
				parentDOM.removeChild(dom);
			}
		});
	}

	commitWorker(wip.child); // 提交子节点
	commitWorker(wip.sibling); // 提交兄弟节点

	// 处理 Layout 副作用和类组件生命周期（同步执行）
	if (wip.tag === FunctionComponent || wip.tag === ClassComponent) {
		commitLifeCycles(wip);
	}

	// 处理 Passive 副作用（异步执行）
	if (wip.updateQueue && wip.updateQueue.lastEffect) {
		const hasPassiveEffects = wip.updateQueue.lastEffect.tag === Passive;
		if (hasPassiveEffects) {
			schedulePassiveEffects(wip);
		}
	}
}

export default commitWorker;
