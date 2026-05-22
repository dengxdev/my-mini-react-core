import { reconcileChildren } from "./ReactChildFiber";
import { renderWithHooks } from "../react/ReactHooks";

/**
 * 更新原生组件 原生组件需要
 * @param {*} wip 需要处理的 fiber 对象节点
 */
export function updateHostComponent(wip) {
  wip.memoizedProps = wip.props;
  reconcileChildren(wip, wip.props.children);
}

/**
 * 更新函数组件
 * @param {*} wip 需要处理的 fiber 对象节点
 */
export function updateFunctionComponent(wip) {
  // 重置 Hooks 链表
  renderWithHooks(wip);
  const { type, props } = wip;
  // 记录到 fiber 上，供下次 update 使用
  wip.memoizedProps = props;
  // 执行函数组件，返回 React Element(vnode 树), Hooks 就在这里执行
  const children = type(props);
  // 传入 reconcileChildren，内部会统一处理为数组
  reconcileChildren(wip, children);
}

/**
 * 更新类组件
 * @param {*} wip 需要处理的 fiber 对象节点
 */
export function updateClassComponent(wip) {
  const { type, props } = wip;
  let instance = wip.stateNode;

  if (!instance) {
    // mount 阶段: new 实例，关联 fiber
    instance = new type(props);
    wip.stateNode = instance;
    instance._reactInternalFiber = wip;
  } else {
    // update 阶段: 复用实例，更新 props，处理 setState 队列
    instance.props = props;
    processUpdateQueue(wip, instance);
  }

  // 记录到 fiber，供下次 update 和生命周期使用
  wip.memoizedProps = props;
  wip.memoizedState = instance.state;

  const children = instance.render();
  reconcileChildren(wip, children);
}

/**
 * 处理类组件的 setState 更新队列
 * @param {Object} wip 工作中的 fiber 节点
 * @param {Object} instance 类组件实例
 */
function processUpdateQueue(wip, instance) {
  const updateQueue = wip.updateQueue;
  if (!updateQueue || updateQueue.length === 0) {
    return;
  }

  let newState = { ...instance.state };
  updateQueue.forEach((update) => {
    const payload = update.payload;
    if (typeof payload === "function") {
      newState = { ...newState, ...payload(newState, instance.props) };
    } else {
      newState = { ...newState, ...payload };
    }
  });

  instance.state = newState;
  wip.updateQueue = null;
}
