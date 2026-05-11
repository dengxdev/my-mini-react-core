// 该文件负责整个 React 的一个执行流
import beginWork from "./ReactFiberBeginWork";
import completeWork from "./ReactFiberCompleteWork";
import commitWorker, { flushPendingPassiveEffects } from "./ReactFiberCommitWork";
import scheduleCallback, { shouldYieldToHost } from "../scheduler/Scheduler";

// wip 的全称为 work in progress，表示正在进行的工作
// 当前正在进行的工作 fiber 对象
let wip = null;

// 当前根节点的 fiber 对象
let wipRoot = null;

// 标记是否正在渲染中，防止渲染阶段调用 setState 破坏 wip
let isRendering = false;
// 存储渲染阶段产生的更新，等当前渲染完成后再触发
let renderPhaseUpdates = [];

function scheduleUpdateOnFiber(fiber) {
  // 渲染阶段调用 setState，暂存更新，等当前渲染完成后再触发
  if (isRendering) {
    renderPhaseUpdates.push(fiber);
    return;
  }

  // 向上找到根 fiber，确保始终从根开始渲染
  let node = fiber;
  while (node.return && node.return.tag !== undefined) {
    node = node.return;
  }

  wip = node;
  wipRoot = node;

  // 先使用 requestIdleCallback 来进行调用
  // 后期使用 scheduler 包来进行调用
  // 当浏览器的每一帧有空闲时间的时候，就会执行 workloop 函数
  // requestIdleCallback(workloop);
  scheduleCallback(workloop);
}

export default scheduleUpdateOnFiber;

// ========== 内部工具函数 ==========

/**
 * 该函数会在每一帧有剩余时间的时候执行
 * 不再接收时间参数，内部通过 shouldYieldToHost() 检查是否应该让出主线程
 */
function workloop() {
  isRendering = true;
  try {
    while (wip) {
      // 检查是否应该让出主线程（超过 5ms）
      if (shouldYieldToHost()) {
        // 时间用完，返回函数让调度器知道还有工作要做
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
    // 处理渲染阶段产生的更新
    if (renderPhaseUpdates.length > 0) {
      const updates = renderPhaseUpdates;
      renderPhaseUpdates = [];
      // 取第一个更新触发重新渲染（简化处理）
      if (updates.length > 0) {
        scheduleUpdateOnFiber(updates[0]);
      }
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
  // 渲染完成后将 wipRoot 置为 null
  wipRoot = null;
}
