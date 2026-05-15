/**
 * 批处理状态共享模块
 *
 * 基于微任务（microtask）的自动批处理机制：
 * 在同一事件循环中产生的多次状态更新会被收集到队列中，
 * 通过 queueMicrotask 调度为一次统一的 flush，从而合并为单次渲染。
 *
 * 该模块同时提供同步强制刷新能力（flushSync），用于需要立即
 * 读取 DOM 或同步执行副作用的场景。
 */

import { setCurrentUpdateLane, SyncLane, DefaultLane } from "./utils";

/** @type {Array<() => void>} 待执行的更新回调队列 */
let callbacks = [];

/** @type {boolean} 是否已调度 flush，避免重复调度 */
let isFlushScheduled = false;

/**
 * 调度一次微任务以 flush 所有被收集的更新。
 * 如果已经调度过，则不会重复调度，保证同一事件循环内的更新只触发一次渲染。
 */
function scheduleFlush() {
	if (!isFlushScheduled) {
		isFlushScheduled = true;
		queueMicrotask(() => {
			isFlushScheduled = false;
			flushUpdates();
		});
	}
}

/**
 * 将状态更新回调加入批处理队列，并触发调度。
 *
 * @param {() => void} callback - 需要被批量执行的状态更新回调
 */
export function enqueueUpdate(callback) {
	callbacks.push(callback);
	scheduleFlush();
}

/**
 * 立即同步执行队列中所有被收集的更新回调。
 * 该函数会直接遍历并清空当前 callbacks 队列。
 *
 * @returns {void}
 */
export function flushUpdates() {
	if (callbacks.length === 0) return;
	const queue = callbacks;
	callbacks = [];
	queue.forEach((cb) => cb());
}

/**
 * 同步执行函数，并立即处理所有 pending 的状态更新。
 *
 * 在 flushSync 期间，状态更新会走 SyncLane，直接同步执行 workLoop，
 * 不会进入微任务批处理队列。常用于需要立即读取 DOM 等同步场景。
 *
 * @template T
 * @param {() => T} fn - 需要同步执行的函数
 * @returns {T} 函数执行的返回值
 */
export function flushSync(fn) {
	// Lane 模型：进入同步上下文
	setCurrentUpdateLane(SyncLane);
	flushUpdates();
	try {
		return fn();
	} finally {
		flushUpdates();
		// 恢复默认 lane
		setCurrentUpdateLane(DefaultLane);
	}
}

/**
 * 批处理执行函数，将多个状态更新合并为一次渲染。
 *
 * 在当前自动批处理模型下，该函数为 no-op（直接执行并返回结果），
 * 行为与 React 18 的自动批处理保持一致。
 *
 * @template T
 * @param {() => T} fn - 需要批处理执行的函数
 * @returns {T} 函数执行的返回值
 */
export function batchedUpdates(fn) {
	return fn();
}
