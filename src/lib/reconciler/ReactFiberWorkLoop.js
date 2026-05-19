// 该文件负责整个 React 的一个执行流
import beginWork from "./ReactFiberBeginWork";
import completeWork from "./ReactFiberCompleteWork";
import commitWorker, { flushPendingPassiveEffects } from "./ReactFiberCommitWork";
import scheduleCallback, { shouldYieldToHost } from "../scheduler/Scheduler";
import { createWorkInProgress } from "./ReactFiber";
import { NoLane, DefaultLane, SyncLane } from "../shared/utils";
import { ClassComponent } from "./ReactWorkTags";

/** @type {Object|null} 当前正在进行的工作 fiber 对象（wip = work in progress） */
let wip = null;

/** @type {Object|null} 当前根节点的 fiber 对象 */
let wipRoot = null;

/** @type {boolean} 标记是否正在渲染中，防止渲染阶段调用 setState 破坏 wip */
let isRendering = false;
/** @type {Array<Object>} 存储渲染阶段产生的更新，等当前渲染完成后再触发 */
let renderPhaseUpdates = [];
/** @type {boolean} Lane 模型：高优先级更新打断低优先级渲染的标志 */
let shouldInterrupt = false;
/** @type {number} 当前渲染的 lane */
let currentRenderLane = NoLane;

function scheduleUpdateOnFiber(fiber, lane = DefaultLane) {
  // 渲染阶段调用 setState，暂存更新，等当前渲染完成后再触发
  if (isRendering) {
    // Lane 模型：如果新更新的优先级更高，标记需要打断当前渲染
    if (lane < currentRenderLane) {
      shouldInterrupt = true;
    }
    renderPhaseUpdates.push({ fiber, lane });
    return;
  }

  // 向上找到根 fiber，确保始终从根开始渲染
  let node = fiber;
  while (node.return && !node.return._isContainer) {
    node = node.return;
  }

  // 通过伪 fiber 找到容器 DOM，再取最新的 current root
  const container = node.return ? node.return.stateNode : null;
  const currentRoot =
    container && container._reactRootContainer ? container._reactRootContainer : node;

  // 不直接用 current 节点作为 wip，而是创建一个新的 WIP 根
  // 这样即使渲染被中断或出错，current tree 的结构依然是完整的
  const wipNode = createWorkInProgress(currentRoot);
  wipNode.sibling = null; // 现在动的是 WIP，不是 current
  wipNode.lane = lane;    // 记录本次更新的 lane，供 workloop 使用
  wip = wipNode;
  wipRoot = wipNode;

  if (lane === SyncLane) {
    // 同步 lane：不走 Scheduler，直接 flushSync
    let result;
    do {
      result = workloop();
    } while (result === workloop);
  } else {
    // 默认 lane：走 Scheduler 调度
    scheduleCallback(workloop);
  }
}

export default scheduleUpdateOnFiber;

/**
 * 该函数会在每一帧有剩余时间的时候执行
 * 不再接收时间参数，内部通过 shouldYieldToHost() 检查是否应该让出主线程
 */
function workloop() {
  isRendering = true;
  currentRenderLane = wipRoot && wipRoot.lane ? wipRoot.lane : NoLane;
  try {
    while (wip) {
      // 检查是否应该让出主线程（超过 5ms）或被高优先级更新打断
      if (shouldYieldToHost() || shouldInterrupt) {
        shouldInterrupt = false;
        // 时间用完或被中断，返回函数让 schedule 调度器知道还有工作要做
        return workloop;
      }
      performUnitOfWork(); // 该方法负责处理一个 fiber 节点
    }
    if (!wip && wipRoot) {
      commitRoot();
    }
    // 返回 undefined 表示所有工作完成
    return undefined;
  } finally {
    isRendering = false;
    currentRenderLane = NoLane;
    // 处理渲染阶段产生的更新
    if (renderPhaseUpdates.length > 0) {
      const updates = renderPhaseUpdates;
      renderPhaseUpdates = [];
      // 取第一个更新触发重新渲染（简化处理）
      scheduleUpdateOnFiber(updates[0].fiber, updates[0].lane);
    }
  }
}

/**
 * 该函数主要负责处理一个 fiber 节点
 * 有下面的事情要做：
 * 1. 处理当前的 fiber 对象
 * 2. 通过深度优先遍历子节点，生成子节点的 fiber 对象，然后继续处理
 * 3. 提交副作用
 * 4. 进行渲染
 */
function performUnitOfWork() {
  beginWork(wip); // 处理当前的 fiber 节点

  if (wip.child) {
    // 如果有子节点，将 wip 往下走
    wip = wip.child;
    return;
  }

  completeWork(wip); // 没有子节点，完成当前节点

  let next = wip; // 先缓存一下当前的 wip
  while (next) {
    if (next.sibling) {
      wip = next.sibling;
      return;
    }
    next = next.return; // 没兄弟？往上回溯到父节点
    if (next) {
      completeWork(next); // 父节点也完成
    }
  }

  // 整棵 fiber 树遍历完毕
  wip = null;
}

/**
 * 执行该方法的时候，说明整个节点的协调工作已经完成
 * 接下来就进入到渲染阶段
 */
function commitRoot() {
  commitWorker(wipRoot);
  // 统一异步调度 passive effects（useEffect）
  flushPendingPassiveEffects();

  // 双缓冲切换：WIP 树成为新的 current 树
  const containerNode = wipRoot && wipRoot.return;
  if (containerNode && containerNode.stateNode) {
    containerNode.stateNode._reactRootContainer = wipRoot;
  }

  // 更新所有类组件实例的 _reactInternalFiber 指向新的 current 树
  const stack = [wipRoot];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node.tag === ClassComponent && node.stateNode) {
      node.stateNode._reactInternalFiber = node;
    }
    if (node.sibling) stack.push(node.sibling);
    if (node.child) stack.push(node.child);
  }

  // 渲染完成后将 wipRoot 置为 null
  wipRoot = null;
}
