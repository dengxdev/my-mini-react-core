import { NoFlags, isStrOrNum, isFn, isUndefined } from "../shared/utils";
import {
	FunctionComponent,
	ClassComponent,
	HostComponent,
	HostText,
	Fragment,
} from "./ReactWorkTags";

/**
 * 基于 current fiber 创建或复用 work-in-progress fiber
 * 这是 React 双缓冲机制的核心：current 树在渲染期间只读，所有修改发生在 WIP 树上
 * @param {Object} current current tree 上的 fiber 节点
 * @returns {Object} work-in-progress fiber 节点
 */
export function createWorkInProgress(current) {
	let wip = current.alternate;
	if (wip === null) {
		// 首次创建 WIP：基于 current 克隆一个骨架
		wip = {
			type: current.type,
			key: current.key,
			props: current.props,
			stateNode: current.stateNode,
			child: null,
			sibling: null,
			return: current.return,
			flags: NoFlags,
			index: current.index,
			alternate: current,
			memoizedProps: current.memoizedProps,
			memoizedState: current.memoizedState,
			updateQueue: current.updateQueue,
			tag: current.tag,
		};
		current.alternate = wip;
	} else {
		// 复用已有的 WIP：重置副作用相关的字段，同步最新的 props/state
		wip.props = current.props;
		wip.flags = NoFlags;
		wip.child = null;
		wip.sibling = null;
		wip.deletions = null;
		wip.updateQueue = null;
		wip.memoizedState = current.memoizedState;
		wip.memoizedProps = current.memoizedProps;
	}
	return wip;
}
/**
 *
 * @param {*} vnode 当前的 vnode 节点
 * @param {*} returnFiber 父 Fiber 节点
 */
function createFiber(vnode, returnFiber) {
	const fiber = {
		// 原始 vnode.type
		type: vnode.type,
		// key
		key: vnode.key,
		// props
		props: vnode.props,
		// 关联的本地状态节点：DOM节点、类实例或null
		stateNode: null,
		// 整个 fiber 树是以链表的形式串联起来的，因此需要 child、sibling 之类的
		// 子 fiber
		child: null,
		// 兄弟 fiber
		sibling: null,
		// 父 fiber
		return: returnFiber,
		// 该 fiber 对象要做的具体操作
		flags: NoFlags,
		// 记录当前节点在当前层级下的位置
		index: null,
		// 存储旧的 fiber 对象
		alternate: null,
		// 上一次 commit 后的 props
		memoizedProps: null,
		// 上一次 commit 后的 state（类组件存 state，函数组件存 hooks 链表头）
		memoizedState: null,
	};

	// 实际上 fiber 对象上面还有一个 tag 值
	// 这个 tag 值是什么取决于 fiber 的 type 值
	// 不同的 vnode 类型，type 是有所不同的

	const type = vnode.type; // 先存储一下 type 值，之后不用每次都去获取
	if (isStrOrNum(type)) {
		// 原生标签
		fiber.tag = HostComponent;
	} else if (isFn(type)) {
		// 注意这里会有两种情况：函数组件和类组件的 type 都是 function
		// 例如函数组件的 type 值为 f xxx()
		// 类组件 class XXX，背后仍然是一个函数
		// 所以我们通过判断 type 是否有 isReactComponent 属性来判断是否为类组件
		if (type.prototype.isReactComponent) {
			// 类组件
			fiber.tag = ClassComponent;
		} else {
			// 函数组件
			fiber.tag = FunctionComponent;
		}
	} else if (isUndefined(type)) {
		// 说明这是一个文本节点
		fiber.tag = HostText;
		// 除此之外还需要多做一件事情
		// 文本节点是没有 props 属性的，我们将手动的给该 fiber 设置一个 props 属性
		fiber.props = {
			children: vnode,
		};
	} else {
		// 说明这是一个 Fragment
		fiber.tag = Fragment;
	}

	return fiber;
}

export default createFiber;
