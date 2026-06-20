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
		// 若 current 从未渲染过（初始 fiber，memoizedProps 与 memoizedState 均为 null），
		// 则 alternate 置 null，确保首次渲染走 Hooks 的 mount 分支
		// （Hooks 依赖 alternate 是否存在来判断 mount/update，初始 fiber 无 hook 链表，
		//   若误判为 update 会因 current.memoizedState 为 null 而崩溃）
		const isInitialMount =
			current.memoizedProps === null && current.memoizedState === null;
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
			alternate: isInitialMount ? null : current,
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
		wip.stateNode = current.stateNode;
		// 将 updateQueue 从 current 转移到 WIP，避免重复处理或丢失
		wip.updateQueue = current.updateQueue;
		current.updateQueue = null;
		wip.memoizedState = current.memoizedState;
		wip.memoizedProps = current.memoizedProps;
	}
	return wip;
}
/**
 * 基于 vnode 创建 fiber 对象
 * @param {*} vnode 当前的 vnode 节点
 * @param {*} returnFiber 父 Fiber 节点
 */
function createFiber(vnode, returnFiber) {
	const fiber = {
		type: vnode.type,	// 原始 vnode.type
		key: vnode.key,	// key
		props: vnode.props,	// props
		stateNode: null,	// 关联的本地状态节点：DOM节点、类实例或null
		child: null,	// 子 fiber
		sibling: null,	// 兄弟 fiber
		return: returnFiber,	// 父 fiber
		flags: NoFlags,	// 该 fiber 对象要做的具体操作
		index: null,	// 记录当前节点在当前层级下的位置
		alternate: null,	// 存储旧的 fiber 对象
		memoizedProps: null,	// 上一次 commit 后的 props
		memoizedState: null,	// 上一次 commit 后的 state（类组件存 state, 
								// 函数组件存 hooks 链表头）
	};
	// tag 值取决于 fiber 的 type 值
	// 不同的 vnode 类型, type 不同
	// 例如: type 可能是一个字符串（原生标签），也可能是一个函数（函数组件或类组件），
	// 还可能是 undefined（文本节点）
	const type = vnode.type;
	if (isStrOrNum(type)) {
		// 原生标签
		fiber.tag = HostComponent;
	} else if (isFn(type)) {
		// 由于函数组件和类组件的 type 都是 function 
		// 根据 isReactComponent 标记来判断是否为类组件
		if (type.prototype.isReactComponent) {
			fiber.tag = ClassComponent;
		} else {
			fiber.tag = FunctionComponent;
		}
	} else if (isUndefined(type)) {
		// 说明这是一个文本节点
		fiber.tag = HostText;
		// 文本节点没有 props 属性，该 fiber 手动设置一个 props 属性
		fiber.props = {
			children: vnode,
		};
	} else {
		fiber.tag = Fragment;
	}
	return fiber;
}

export default createFiber;
