/**
 * 该模块就是调度器的具体实现
 */

import { push, pop, peek } from "./SchedulerMinHeap";
import { getCurrentTime } from "../shared/utils";
/** @type {Array<Object>} 任务队列 */
const taskQueue = [];
/** @type {number} 任务 id 计数器 */
let taskIdCounter = 1;
/** @type {number} 时间片限制（单位：ms） */
const frameInterval = 5;
/** @type {number} 记录任务开始时间 */
let startTime = -1;
// 通过 MessageChannel 来模拟浏览器的 requestIdleCallback
const channel = new MessageChannel();
/** @type {MessagePort} 调度端端口，用于发起调度请求 */
const port1 = channel.port1;
/** @type {MessagePort} 执行端端口，用于接收调度消息并执行任务 */
const port2 = channel.port2;

/**
 * 判断是否应该让出浏览器的渲染主线程
 * @returns {boolean} 如果超过 5ms 返回 true
 */
export function shouldYieldToHost() {
	const timeElapsed = getCurrentTime() - startTime;
	return timeElapsed >= frameInterval;
}

/**
 * 该函数的作用是为了组装一个任务对象，然后将其放入到任务队列
 * @param {*} callback 是一个需要执行的任务，该任务会在每一帧有剩余时间的时候去执行
 */
export default function scheduleCallback(callback) {
	// 获取当前时间
	const currentTime = getCurrentTime();
	// 计算出过期时间（设置为较长时间，确保任务会被执行）
	const expirationTime = currentTime + 5000;

	// 组装一个新的任务对象
	const newTask = {
		id: taskIdCounter++,
		callback,
		expirationTime,
		sortIndex: expirationTime,
	};

	// 将新的任务推入到任务队列
	push(taskQueue, newTask);
	// 请求调度，产生一个宏任务
	port1.postMessage(null);
}

port2.onmessage = function () {
	// 初始化开始时间
	if (startTime === -1) {
		startTime = getCurrentTime();
	}

	// 从任务队列中取出第一个任务
	let currentTask = peek(taskQueue);

	while (currentTask) {
		// 检查是否应该让出主线程（超过 5ms）
		if (shouldYieldToHost()) {
			// 时间用完，让出主线程，下一帧继续
			port1.postMessage(null);
			return;
		}

		const callback = currentTask.callback;
		currentTask.callback = null;

		// 执行任务 (workloop , 而 workloop 中又会基于 fiber 架构做可中断的:
		// 调用 performUnitOfWork 来执行具体的任务单元)
		const taskResult = callback();
		if (taskResult === undefined) {
			// 进入此 if，说明是任务执行完了才退出来的，那么就可以将其从任务队列中删除了
			pop(taskQueue);
			currentTask = peek(taskQueue);
		} else {
			// 任务未完成，保存回调，下一帧继续
			currentTask.callback = taskResult;
			port1.postMessage(null);
			return;
		}
	}
	// 所有任务完成，重置开始时间
	startTime = -1;
};
