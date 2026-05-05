import {
	getIsBatchingUpdates,
	enqueueUpdate,
} from "../shared/batch";

function Component(props) {
	this.props = props;
	this.state = {};
	this._reactInternalFiber = null; // 用于关联 fiber 对象
}
// 由于 Component 本质上是一个函数，所以需要标识类组件
Component.prototype.isReactComponent = true;

Component.prototype.setState = function (partialState) {
	const fiber = this._reactInternalFiber;
	if (!fiber) return;
	// 更新队列
	const updateQueue = fiber.updateQueue || [];
	fiber.updateQueue = updateQueue;
	updateQueue.push({ payload: partialState });

	if (Component._updater && Component._updater.enqueueSetState) {
		if (getIsBatchingUpdates()) {
			// 批处理中：推迟 scheduleUpdateOnFiber 的调用
			enqueueUpdate(() => Component._updater.enqueueSetState(fiber));
		} else {
			Component._updater.enqueueSetState(fiber);
		}
	}
};

const React = {
  Component,
};

export default React;

