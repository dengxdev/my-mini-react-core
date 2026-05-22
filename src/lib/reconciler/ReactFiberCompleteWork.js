import {
	FunctionComponent,
	ClassComponent,
	HostComponent,
	HostText,
	Fragment,
} from "./ReactWorkTags";
import { updateNode } from "../shared/utils";

/**
 * 完成 fiber 节点的处理，创建 DOM 节点并处理副作用
 * @param {Object} wip 工作中的 fiber 节点
 */
function completeWork(wip) {
	const tag = wip.tag;
	switch (tag) {
		case HostComponent: {
			completeHostComponent(wip);
			break;
		}
		case HostText: {
			completeHostText(wip);
			break;
		}
		// 原生组件在 completeWork 创建 stateNode 是因为它们的 stateNode 是真实 DOM 节点
    // 而函数组件没有 stateNode(为 null), 类组件的 stateNode 是组件实例而非 DOM 节点
    // 两者都不能在 completeWork 阶段创建 DOM。
		case FunctionComponent: {
			completeFunctionComponent(wip);
			break;
		}
		case ClassComponent: {
			break;
		}
		case Fragment: {
			break;
		}
	}
}

export default completeWork;

/**
 * 完成宿主组件的处理，创建 DOM 元素并更新属性
 * @param {Object} wip 工作中的 fiber 节点
 */
function completeHostComponent(wip) {
	if (!wip.stateNode) {
		wip.stateNode = document.createElement(wip.type);
		updateNode(wip.stateNode, {}, wip.props);
	}
}

/**
 * 完成文本节点的处理，创建文本节点
 * @param {Object} wip 工作中的 fiber 节点
 */
function completeHostText(wip) {
	if (!wip.stateNode) {
		wip.stateNode = document.createTextNode(wip.props.children);
	}
}

/**
 * 完成函数组件的处理
 * @param {Object} wip 工作中的 fiber 节点
 */
function completeFunctionComponent(wip) {
	// 副作用环形链表已在 render 阶段的 pushEffect 中完整构建
	// deps 比较也在 hooks 调用阶段完成，此处无需额外处理
	if (!wip.updateQueue || !wip.updateQueue.lastEffect) {
		return;
	}
}
