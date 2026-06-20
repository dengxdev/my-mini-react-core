/**
 * 该模块用于实现各种 Hooks
 */
import scheduleUpdateOnFiber from "../reconciler/ReactFiberWorkLoop";
import {
	Passive,
	Layout,
	HasEffect,
	currentUpdateLane,
	DefaultLane,
	SyncLane,
} from "../shared/utils";
import {
	enqueueUpdate,
	flushSync as flushSyncImpl,
	batchedUpdates as batchedUpdatesImpl,
	isInsideFlushSync,
	enqueueSyncUpdate,
} from "../shared/batch";

/** @type {Object|null} 当前正在渲染的 fiber 对象 */
let currentlyRenderingFiber = null;
/** @type {Object|null} wip 上 hook 链表的当前游标/尾部 */
let workInProgressHook = null;
/** @type {Object|null} current（旧 fiber）上 hook 链表的当前游标 */
let currentHook = null;

/**
 * 初始化函数组件的 Hooks 环境，准备开始新的渲染
 * @param {*} wip 当前 fiber 对象
 */
export function renderWithHooks(wip) {
	currentlyRenderingFiber = wip;
	// 清空 hook 链表，本次渲染将重新从头构建
	currentlyRenderingFiber.memoizedState = null;
	// 重置 wip 上 hook 链表游标
	workInProgressHook = null;
	// 重置 current 上 hook 链表游标
	currentHook = null;
	// 清空 effect 队列，本次渲染将重新收集
	currentlyRenderingFiber.updateQueue = null;
}

/**
 * 同步执行函数，并立即处理所有状态更新
 * @param {Function} fn 需要同步执行的函数
 * @returns {*} 函数执行的返回值
 */
export const flushSync = flushSyncImpl;
export const batchedUpdates = batchedUpdatesImpl;

/**
 *
 * @param {*} initialState 初始化状态
 */
export function useState(initialState) {
	return useReducer(null, initialState);
}

/**
 *
 * @param {*} reducer 改变状态的纯函数
 * @param {*} initialState 初始化状态
 */
export function useReducer(reducer, initialState) {
	const hook = updateWorkInProgressHook();

	if (!currentlyRenderingFiber.alternate) {
		// 说明是首次渲染
		hook.memoizedState = initialState; // 将当前 hook 的 memoizedState 置为 initialState
		// 初始化 queue，pending 为环形链表头，用于存储待处理的 updates
		hook.queue = {
			pending: null,
			lastRenderedState: initialState,
		};
	} else {
		// 更新阶段：数据结构自检
		// effect/memo/callback 等 hook 节点没有 queue
		if (hook.queue === undefined || hook.queue === null) {
			throw new Error(
				"Hook structure mismatch: expected a state/reducer hook but got a different type. " +
					"This usually happens when hooks are called in a different order between renders.",
			);
		}

		// 消费 pending updates
		// dispatch 时只把 update 推入 queue.pending，真正的状态计算在 render 阶段执行
		const queue = hook.queue;
		const pending = queue.pending;

		if (pending !== null) {
			// 解开环形链表，逐个应用 update
			queue.pending = null;
			const first = pending.next;

			// 如果 eagerState 缓存存在，且当前只有一个 update，直接复用
			if (queue.eagerState !== undefined && first.next === first) {
				hook.memoizedState = queue.eagerState;
				queue.lastRenderedState = queue.eagerState;
			} else {
				let newState = hook.memoizedState;
				let update = first;

				do {
					const action = update.action;
					newState =
						typeof action === "function"
							? action(newState)
							: reducer
								? reducer(newState, action)
								: action;
					update = update.next;
				} while (update !== null && update !== first);

				hook.memoizedState = newState;
				queue.lastRenderedState = newState;
			}
			queue.eagerState = undefined;
		}
	}

	const dispatch = dispatchReducerAction.bind(
		null,
		currentlyRenderingFiber,
		hook.queue,
		reducer,
	);

	return [hook.memoizedState, dispatch];
}

/**
 * 注册一个副作用，在 DOM 更新后异步执行
 * @param {Function} create 创建副作用的函数，返回清理函数
 * @param {Array} [deps] 依赖数组，依赖变化时重新执行副作用
 */
export function useEffect(create, deps) {
	const hook = updateWorkInProgressHook();
	const nextDeps = deps === undefined ? null : deps;

	let inst;

	if (currentlyRenderingFiber.alternate) {
		const prevEffect = hook.memoizedState;

		// 结构自检：如果 memoizedState 不是 effect 对象，说明 hook 类型被交换了
		// effect 对象的特征是：有 tag 属性，create 是函数
		const isValidEffect =
			prevEffect !== null &&
			typeof prevEffect === "object" &&
			prevEffect.tag !== undefined &&
			typeof prevEffect.create === "function";

		if (prevEffect !== null && !isValidEffect) {
			throw new Error(
				"Hook structure mismatch: expected an effect hook but got a different type. " +
					"This usually happens when hooks are called in a different order between renders.",
			);
		}

		if (isValidEffect) {
			inst = prevEffect.inst;
			if (areHookInputsEqual(nextDeps, prevEffect.deps)) {
				// 依赖未变，push 不带 HasEffect 的 effect，保持 updateQueue 结构完整
				hook.memoizedState = pushEffect(Passive, create, inst, nextDeps);
				return;
			}
		}
	} else {
		inst = { destroy: undefined };
	}

	// mount 或 deps 变化：push 带 HasEffect 的 effect
	const effect = pushEffect(Passive | HasEffect, create, inst, nextDeps);
	hook.memoizedState = effect;
}

/**
 * 注册一个副作用，在 DOM 更新前同步执行
 * @param {Function} create 创建副作用的函数，返回清理函数
 * @param {Array} [deps] 依赖数组，依赖变化时重新执行副作用
 */
export function useLayoutEffect(create, deps) {
	const hook = updateWorkInProgressHook();
	const nextDeps = deps === undefined ? null : deps;

	let inst;

	if (currentlyRenderingFiber.alternate) {
		const prevEffect = hook.memoizedState;

		// 结构自检：如果 memoizedState 不是 effect 对象，说明 hook 类型被交换了
		const isValidEffect =
			prevEffect !== null &&
			typeof prevEffect === "object" &&
			prevEffect.tag !== undefined &&
			typeof prevEffect.create === "function";

		if (prevEffect !== null && !isValidEffect) {
			throw new Error(
				"Hook structure mismatch: expected a layout effect hook but got a different type. " +
					"This usually happens when hooks are called in a different order between renders.",
			);
		}

		if (isValidEffect) {
			inst = prevEffect.inst;
			if (areHookInputsEqual(nextDeps, prevEffect.deps)) {
				// 依赖未变，push 不带 HasEffect 的 effect
				hook.memoizedState = pushEffect(Layout, create, inst, nextDeps);
				return;
			}
		}
	} else {
		inst = { destroy: undefined };
	}

	const effect = pushEffect(Layout | HasEffect, create, inst, nextDeps);
	hook.memoizedState = effect;
}

/**
 * 记忆化回调函数，依赖变化时才重新创建
 * @param {Function} callback 回调函数
 * @param {Array} [deps] 依赖数组，依赖变化时重新创建回调
 * @returns {Function} 记忆化的回调函数
 */
export function useCallback(callback, deps) {
	const hook = updateWorkInProgressHook();
	const nextDeps = deps === undefined ? null : deps;

	if (currentlyRenderingFiber.alternate) {
		const prevState = hook.memoizedState;
		if (prevState) {
			if (areHookInputsEqual(nextDeps, prevState.deps)) {
				return prevState.value;
			}
		}
	}

	hook.memoizedState = {
		value: callback,
		deps: nextDeps,
	};

	return callback;
}

/**
 * 记忆化计算结果，依赖变化时才重新计算, beginWork 阶段调用计算函数
 * @param {Function} create 计算函数，返回计算结果
 * @param {Array} [deps] 依赖数组，依赖变化时重新计算
 * @returns {*} 记忆化的计算结果
 */
export function useMemo(create, deps) {
	const hook = updateWorkInProgressHook();
	const nextDeps = deps === undefined ? null : deps;

	if (currentlyRenderingFiber.alternate) {
		const prevState = hook.memoizedState;
		if (prevState) {
			if (areHookInputsEqual(nextDeps, prevState.deps)) {
				return prevState.value;
			}
		}
	}

	const memoizedValue = create();
	hook.memoizedState = {
		value: memoizedValue,
		deps: nextDeps,
	};

	return memoizedValue;
}

/**
 * 新旧依赖数组是否相等
 * @param {Array} nextDeps 新的依赖数组
 * @param {Array} prevDeps 旧的依赖数组
 * @returns {boolean} 是否相等
 */
function areHookInputsEqual(nextDeps, prevDeps) {
	if (prevDeps === null || nextDeps === null) {
		return false;
	}
	if (prevDeps.length !== nextDeps.length) {
		return false;
	}
	return nextDeps.every((dep, i) => Object.is(dep, prevDeps[i]));
}

/**
 * 获取或创建本次渲染（work-in-progress）中当前位置应该使用的 hook
 * 并维护 workInProgressHook 指向新 hook 链表中的下一个 hook
 * @returns {Object} hook 对象
 * @throws {Error} 如果在非函数组件中调用 hooks
 * @throws {Error} 如果本次渲染调用的 hook 数量超过了上次
 */
function updateWorkInProgressHook() {
	// Hook 规则检查 1: 确保在函数组件内部调用
	if (!currentlyRenderingFiber) {
		throw new Error(
			"Hooks can only be called inside the body of a function component.",
		);
	}

	// 这个变量就是存储最终我们要向外部返回的 hook
	let targetHook = null;
	// 旧 fiber
	const current = currentlyRenderingFiber.alternate;
	if (current) {
		// update 阶段，基于旧 fiber 的 hook 链表逐个克隆新节点
		if (workInProgressHook) {
			// 第 N 次调用（N > 1），基于 currentHook 克隆新节点
			currentHook = currentHook.next;
			if (!currentHook) {
				throw new Error("Rendered more hooks than during the previous render.");
			}
			const newHook = {
				memoizedState: currentHook.memoizedState,
				queue: currentHook.queue,
				next: null,
			};
			workInProgressHook = workInProgressHook.next = newHook;
			targetHook = newHook;
		} else {
			// 第一次调用, 取链表头并克隆
			currentHook = current.memoizedState;
			targetHook = {
				memoizedState: currentHook.memoizedState,
				queue: currentHook.queue,
				next: null,
			};
			workInProgressHook = currentlyRenderingFiber.memoizedState = targetHook;
		}
	} else {
		// mount 阶段，没有旧 fiber，创建新的 hook 链表
		targetHook = {
			memoizedState: null, // 存储数据
			queue: null,
			next: null, // 指向下一个 hook
		};
		if (workInProgressHook) {
			// 说明这个链表上面已经有 hook 了
			workInProgressHook = workInProgressHook.next = targetHook;
		} else {
			// 说明 hook 链表上面还没有 hook
			workInProgressHook = currentlyRenderingFiber.memoizedState = targetHook;
		}
	}
	return targetHook;
}

/**
 * 处理状态更新，将 update 推入 queue.pending 环形链表并调度重新渲染
 * 注意：dispatch 阶段不计算最终状态，状态在下次 render 的 useReducer/useState 中统一消费
 * @param {Object} fiber 当前正在处理的 fiber 对象
 * @param {Object} queue 当前 hook 的更新队列
 * @param {Function|null} reducer 状态更新的 reducer 函数，useState 时为 null
 * @param {*} action 状态更新的 action，useState 时为新状态值或更新函数
 */
function basicStateReducer(state, action) {
	return typeof action === "function" ? action(state) : action;
}

function dispatchReducerAction(fiber, queue, reducer, action) {
	// Eager State Bailout 优化：queue 为空时，预先计算新状态
	if (queue.pending === null) {
		const currentState = queue.lastRenderedState;
		const eagerReducer = reducer !== null ? reducer : basicStateReducer;
		try {
			const eagerState = eagerReducer(currentState, action);
			// 状态没变，直接 bailout，不调度重新渲染
			if (Object.is(eagerState, currentState)) return;
			queue.eagerState = eagerState;
		} catch (error) {
			// suppress error，让它在 render 阶段再次抛出
		}
	}

	// 1. 创建 Update 对象（存储 action，而非计算后的值）
	// Lane 模型：根据当前全局上下文决定更新的优先级
	const lane = currentUpdateLane;
	const update = {
		action,
		next: null,
		lane,
	};

	// 2. 将 update 插入 queue.pending 环形链表
	if (queue.pending === null) {
		update.next = update;
	} else {
		update.next = queue.pending.next;
		queue.pending.next = update;
	}
	queue.pending = update;

	// 3. alternate 关系交由 createWorkInProgress 统一管理
	// 不再在此处用浅拷贝手动设置 fiber.alternate，否则会断裂 alternate 双向链，
	// 导致 update 阶段 current（wip.alternate）指向未渲染过的初始 fiber 而崩溃
	// 不再直接修改 current fiber 的 sibling
	// 以前这里写了 fiber.sibling = null, 现在改为在 scheduleUpdateOnFiber 中
	// 通过 createWorkInProgress 创建 WIP 根节点, 在 WIP 上切断 sibling

	// 4. 调度重渲染
	// Lane 模型: SyncLane 直接同步执行，不走微任务批处理
	if (lane === SyncLane) {
		if (isInsideFlushSync) {
			// 在 flushSync 内部：只收集 fiber, 延迟到 flushSync 结束时统一触发
			enqueueSyncUpdate(fiber);
		} else {
			// 普通 SyncLane 场景（如原生事件回调）: 直接同步触发
			scheduleUpdateOnFiber(fiber, SyncLane);
		}
	} else {
		// 统一入队，由微任务批处理合并为一次渲染
		enqueueUpdate(() => scheduleUpdateOnFiber(fiber, lane));
	}
}

/**
 * 创建并添加一个副作用到 fiber 的更新队列
 * @param {number} tag 副作用类型标签
 * @param {Function} create 创建副作用的函数
 * @param {Function} destroy 清理副作用的函数
 * @param {Array|null} deps 依赖数组
 * @returns {Object} 副作用对象
 */
function pushEffect(tag, create, inst, deps) {
	const effect = {
		tag,
		create,
		inst,
		deps,
		next: null,
	};

	if (
		currentlyRenderingFiber.updateQueue === null ||
		currentlyRenderingFiber.updateQueue === undefined
	) {
		// mount 阶段，初始化 updateQueue
		currentlyRenderingFiber.updateQueue = { lastEffect: null };
	}

	const updateQueue = currentlyRenderingFiber.updateQueue;
	if (updateQueue.lastEffect === null) {
		// mount 阶段
		effect.next = effect;
		updateQueue.lastEffect = effect;
	} else {
		// update 阶段
		const lastEffect = updateQueue.lastEffect;
		const firstEffect = lastEffect.next;
		lastEffect.next = effect;
		effect.next = firstEffect;
		updateQueue.lastEffect = effect;
	}

	return effect;
}
