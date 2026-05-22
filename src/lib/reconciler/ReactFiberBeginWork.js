// 在 beginWork 中，主要就是根据 fiber 不同的 tag 值，调用不同的方法来处理
import {
  FunctionComponent,
  ClassComponent,
  HostComponent,
  Fragment,
} from "./ReactWorkTags";
import {
  updateHostComponent,
  updateFunctionComponent,
  updateClassComponent,
} from "./ReactFiberReconciler";

/**
 * 根据 fiber 不同的 tag 值，调用不同的方法来处理
 * HostText 在后续的 complete 阶段会被特殊处理，不在 beginWork 中处理
 * @param {*} wip
 */
function beginWork(wip) {
  const tag = wip.tag;
  switch (tag) {
    case HostComponent: {
      updateHostComponent(wip);
      break;
    }
    case FunctionComponent: {
      updateFunctionComponent(wip);
      break;
    }
    case ClassComponent: {
      updateClassComponent(wip);
      break;
    }
    case Fragment: {
      break;
    }
  }
}

export default beginWork;

