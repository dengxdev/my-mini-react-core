/**
 * 对 fiber 对象要做的操作进行的标记
 */

// 没有任何操作
export const NoFlags = 0b00000000000000000000;
// 节点新增、插入、移动
export const Placement = 0b0000000000000000000010; // 2
// 节点更新属性
export const Update = 0b0000000000000000000100; // 4
// 删除节点
export const Deletion = 0b0000000000000000001000; // 8
// 副作用相关 flags
export const Passive = 0b0000000000000000010000; // 16   useEffect
export const Layout = 0b0000000000000000100000; // 32   useLayoutEffect

// Lane 模型（简化版）
export const NoLane = 0;
export const SyncLane = 1;      // 001  同步优先级：flushSync、原生事件
export const DefaultLane = 2;   // 010  默认优先级：普通 setState

// 当前更新使用的 lane，用于在 dispatch 阶段判断优先级
export let currentUpdateLane = DefaultLane;
export function setCurrentUpdateLane(lane) {
	currentUpdateLane = lane;
}

/**
 * 判断参数 s 是否为字符串
 * @param {*} s
 * @returns
 */
export function isStrOrNum(s) {
	return typeof s === "string" || typeof s === "number";
}

/**
 * 判断参数 fn 是否为函数
 * @param {*} fn
 * @returns
 */
export function isFn(fn) {
	return typeof fn === "function";
}

/**
 * 判断参数 s 是否为 undefined
 * @param {*} s
 * @returns
 */
export function isUndefined(s) {
	return s === undefined;
}

/**
 * 判断参数 arr 是否为数组
 * @param {*} arr
 * @returns
 */
export function isArray(arr) {
	// 这个 API 是通过 C++ 来判断数据的数据结构的，所以这个原生 API 就是最合适的 API
	return Array.isArray(arr);
}

/**
 * 该方法主要负责更新 DOM 节点上的属性
 * @param {*} node 真实的 DOM 节点
 * @param {*} prevVal 旧值
 * @param {*} nextVal 新值
 */
export const updateNode = (node, prevVal, nextVal) => {
	// 两个步骤: 
	// 1. 对旧值的处理
	// 2. 对新值的处理

	// 对旧值进行处理
	Object.keys(prevVal).forEach((k) => {
		if (k === "children") {
			// 这里需要判断一下 children 是否是字符串
			// 如果是字符串，说明是文本节点，需要将其设置为空字符串
			if (isStrOrNum(prevVal[k])) {
				node.textContent = "";
			}
		} else if (k.startsWith("on")) {
			// 事件属性
			let eventName = k.slice(2).toLowerCase();
			// 注意: 如果是 change 事件，其实绑定的是 input 事件
			if (eventName === "change") {
				eventName = "input";
			}
			// 移除事件
			node.removeEventListener(eventName, prevVal[k]);
		} else {
			// 普通属性，如 id、className，若新值中没有该属性，将其移除
			if (!(k in nextVal)) {
				node[k] = "";
			}
		}
	});
	// 对新值进行处理，流程基本和上面一样，只不过是反着操作
	Object.keys(nextVal).forEach((k) => {
		if (k === "children") {
			// 判断是否是文本节点
			if (isStrOrNum(nextVal[k])) {
				node.textContent = nextVal[k];
			}
		} else if (k.startsWith("on")) {
			// 绑定事件
			let eventName = k.slice(2).toLowerCase();
			if (eventName === "change") {
				eventName = "input";
			}
			node.addEventListener(eventName, nextVal[k]);
		} else {
			// 普通属性
			node[k] = nextVal[k];
		}
	});
};

/**
 *
 * @returns 返回当前时间
 * 关于 performance API 的说明，可以参阅:
 * https://developer.mozilla.org/zh-CN/docs/Web/API/Performance/now
 */
export const getCurrentTime = () =>
	typeof performance === "object" && typeof performance.now === "function"
		? performance.now()
		: Date.now();
