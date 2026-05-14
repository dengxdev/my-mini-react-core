/**
 * 批处理状态共享模块
 * 基于微任务的自动批处理：同一事件循环中的多次更新合并为一次渲染
 */

import { setCurrentUpdateLane, SyncLane, DefaultLane } from "./utils";

let callbacks = [];
let isFlushScheduled = false;

function scheduleFlush() {
	if (!isFlushScheduled) {
		isFlushScheduled = true;
		queueMicrotask(() => {
			isFlushScheduled = false;
			flushUpdates();
		});
	}
}

export function enqueueUpdate(callback) {
	callbacks.push(callback);
	scheduleFlush();
}

export function flushUpdates() {
	if (callbacks.length === 0) return;
	const queue = callbacks;
	callbacks = [];
	queue.forEach((cb) => cb());
}

/**
 * 同步执行函数，并立即处理所有状态更新
 * 在 flushSync 期间，setState 会走 SyncLane，直接同步执行 workloop
 * @param {Function} fn 需要同步执行的函数
 * @returns {*} 函数执行的返回值
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
 * 批处理执行函数，将多个状态更新合并为一次渲染
 * 在自动批处理模型下为 no-op（与 React 18 行为一致）
 * @param {Function} fn 需要批处理执行的函数
 * @returns {*} 函数执行的返回值
 */
export function batchedUpdates(fn) {
	return fn();
}
