import createFiber from "../reconciler/ReactFiber";
import scheduleUpdateOnFiber from "../reconciler/ReactFiberWorkLoop";
import React from "../react/React.js";

React.Component._updater = {
	enqueueSetState(fiber) {
		scheduleUpdateOnFiber(fiber);
	},
};

class ReactDOMRoot {
	constructor(container) {
		// 供后续 updateContainer 使用
		this._internalRoot = container;
	}
	/**
	 * 该方法的职责是将 vnode 树更新到 container 上
	 * 该方法会调用 updateContainer 方法，updateContainer 方法会创建一个 fiber 对象，
   * 并将该 fiber 对象挂载到 container 上
	 * 之后 updateContainer 会调用 scheduleUpdateOnFiber 方法，
   * scheduleUpdateOnFiber 方法会将该 fiber 对象作为参数传入，开始调度更新
	 * @param {*} children 要挂载到根节点的 vnode 树
	 *  约定:
	 * 1. 以前的虚拟DOM，我们称之为 vnode
	 * 2. 新的虚拟DOM，我们称之为 Fiber
	 */
	render(children) {
		updateContainer(children, this._internalRoot);
	}
}

const ReactDOM = {
	/**
	 * 该方法的职责是创建一个 ReactDOMRoot 实例，并将 container 传入到实例中
	 * 该实例会有一个 render 方法，render 方法的职责是将 vnode 树更新到 container 上
	 * @param {*} container 要挂载的根 DOM 节点
	 * @return 返回值是一个对象，该对象会有一个 render 方法
	 */
	createRoot(container) {
		return new ReactDOMRoot(container);
	},
};

export const { createRoot } = ReactDOM;
export default ReactDOM;

/**
 * 更新容器的方法
 * @param {*} element 要挂载的 vnode 树
 * @param {*} container 容器的 DOM 节点
 */
function updateContainer(element, container) {
	const fiber = createFiber(element, {
		// 该对象就是我的父 fiber 对象，里面会放置一些核心的属性
		type: container.nodeName.toLowerCase(),
		stateNode: container,
		_isContainer: true,
	});
	// 将根 fiber 挂载到 container, 供 scheduleUpdateOnFiber 取到最新的 current
	container._reactRootContainer = fiber;
	// 至此，ReactDom 层的职责结束, 后续 update 阶段控制权交由 reconciler 层
	scheduleUpdateOnFiber(fiber);
}
