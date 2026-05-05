/**
 * 批处理状态共享模块
 * 供 hooks 和类组件共同使用
 */

let isBatching = false;
let callbacks = [];

export function getIsBatchingUpdates() {
	return isBatching;
}

export function setIsBatchingUpdates(value) {
	isBatching = value;
}

export function enqueueUpdate(callback) {
	callbacks.push(callback);
}

export function flushUpdates() {
	if (callbacks.length > 0) {
		const queue = callbacks;
		callbacks = [];
		queue.forEach((cb) => cb());
	}
}
