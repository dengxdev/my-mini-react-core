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
		case FunctionComponent:
		case ClassComponent: {
			completeClassOrFunctionComponent(wip);
			break;
		}
		case Fragment: {
			break;
		}
	}
}

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
 * 完成类组件或函数组件的处理，处理副作用队列
 * @param {Object} wip 工作中的 fiber 节点
 */
function completeClassOrFunctionComponent(wip) {
	if (!wip.updateQueue || wip.updateQueue.length === 0) {
		return;
	}

	const updateQueue = wip.updateQueue;
	const lastEffect = wip.alternate?.updateQueue?.lastEffect;

	if (lastEffect) {
		wip.updateQueue.lastEffect = lastEffect;
	} else {
		wip.updateQueue.lastEffect = null;
	}

	updateQueue.forEach((effect) => {
		const lastEffectRecord = lastEffect?.effectList?.find(
			(lastEffect) => lastEffect.tag === effect.tag
		);

		if (lastEffectRecord) {
			const depsChanged = !areHookInputsEqual(effect.deps, lastEffectRecord.deps);
			if (depsChanged) {
				effect.destroy = lastEffectRecord.destroy;
				effect.create = lastEffectRecord.create;
				effect.deps = lastEffectRecord.deps;
			}
		}

		if (!wip.updateQueue.lastEffect) {
			wip.updateQueue.lastEffect = effect;
		} else {
			effect.next = wip.updateQueue.lastEffect.next;
			wip.updateQueue.lastEffect.next = effect;
			wip.updateQueue.lastEffect = effect;
		}
	});
}

/**
 * 比较两个依赖数组是否相等
 * @param {Array} nextDeps 新的依赖数组
 * @param {Array} prevDeps 旧的依赖数组
 * @returns {boolean} 是否相等
 */
function areHookInputsEqual(nextDeps, prevDeps) {
	if (prevDeps === null) {
		return false;
	}

	if (prevDeps.length !== nextDeps.length) {
		return false;
	}

	for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
		if (Object.is(nextDeps[i], prevDeps[i])) {
			continue;
		}
		return false;
	}

	return true;
}

export default completeWork;

