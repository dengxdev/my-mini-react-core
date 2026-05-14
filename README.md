# Mini React —— 从 0 实现的 React 核心引擎

> 一个大二学生为了搞懂 React 源码到底在干什么，而写的"能跑"的 React。

## 为什么做这个项目

学 React 一年后，我发现自己虽然能熟练写 Hooks，但对背后的机制一知半解：
- `setState` 之后到底发生了什么？
- Fiber 树为什么能"打断"渲染？
- Diff 算法为什么是 O(n) 而不是 O(n³)？
- `useEffect` 和 `useLayoutEffect` 的执行时机差在哪？

所以我决定删掉 `node_modules/react`，自己写一个能跑起来的版本。过程中对照 React 18 源码，把大概 1800 行核心逻辑拆成了 Scheduler、Reconciler、Renderer 三层。写完之后回头看官方源码，终于能看懂了。

## 实现了什么

这不是一个玩具级的 demo，它包含 React 的核心链路：

### 1. Fiber 架构
- 完整的 Fiber 链表结构（child / sibling / return）
- 双缓冲机制（current ↔ workInProgress），支持更新时复用旧节点
- **WIP 树隔离**：渲染期间所有修改发生在 WIP 树上，current tree 保持只读

### 2. 调度器 Scheduler
- 基于 `MessageChannel` 的宏任务调度（和 React 18 一致）
- 时间片机制（5ms），支持 `shouldYieldToHost()` 让出主线程
- 任务优先级队列（基于小顶堆）

### 3. Reconciler 协调器
- **Diff 算法**：单端遍历 + Map 复用，完整实现 React 的两轮 Diff 策略
- **批量更新**：支持自动批处理（batchUpdates）和 `flushSync` 强制刷新
- **Eager Bailout**：状态未变时直接跳过调度

### 4. Hooks（全链路实现）
- `useState` / `useReducer`
- `useEffect` / `useLayoutEffect`（含清理函数和异步调度）
- `useMemo` / `useCallback`
- 支持 Hooks 规则校验（开发时误用会抛错）

### 5. 组件支持
- 函数组件
- 类组件（含 `setState` 更新链路）
- Fragment
- Host Component（原生 DOM 标签）

### 6. Lane 模型简化版
- 定义 `SyncLane`（同步，不可打断）和 `DefaultLane`（默认，可调度）
- `flushSync` 期间自动升级为 SyncLane，直接同步执行 workloop
- workloop 中预留 `shouldInterrupt` 钩子，支持高优先级打断低优先级渲染的代码路径

## 项目结构

```
src/lib
├── react/                    # React 核心 API
│   ├── React.js              # Component 基类
│   └── ReactHooks.js         # 全部 Hooks 实现
├── react-dom/                # DOM 渲染器
│   └── ReactDom.js
├── reconciler/               # 协调器（核心中的核心）
│   ├── ReactFiber.js         # Fiber 节点创建 + createWorkInProgress
│   ├── ReactFiberWorkLoop.js # 工作循环 + 调度入口 + Lane 分发
│   ├── ReactFiberBeginWork.js
│   ├── ReactFiberCompleteWork.js
│   ├── ReactFiberCommitWork.js
│   ├── ReactFiberReconciler.js
│   ├── ReactChildFiber.js    # Diff 算法主逻辑
│   └── ReactChildFiberAssistant.js
├── scheduler/                # 调度器
│   ├── Scheduler.js          # MessageChannel + 时间片
│   └── SchedulerMinHeap.js   # 任务优先级队列
└── shared/                   # 工具函数 + 标志位 + Lane 常量
    ├── batch.js              # 批量更新
    └── utils.js
```

## 架构流程图

```mermaid
flowchart TD
    A[用户触发 setState] --> B[dispatchReducerAction]
    B --> C[创建 Update 推入 pending 环形链表]
    C --> D[scheduleUpdateOnFiber]
    D --> E[向上找到根 Fiber]
    E --> F[createWorkInProgress 创建 WIP 根]
    F --> G{判断 lane}
    G -->|SyncLane| H[直接同步执行 workloop]
    G -->|DefaultLane| I[Scheduler MessageChannel 调度 workloop]
    H --> J[workloop --> performUnitOfWork]
    I --> J
    J --> K[beginWork --> renderWithHooks]
    K --> L[reconcileChildren Diff 算法]
    L --> M[completeWork]
    M --> J
    M --> N[commitRoot --> commitWorker]
    N --> O[commitLifeCycles + flushPassiveEffects]
```

## 本地运行

```bash
pnpm install
pnpm dev
```

`App.jsx` 里可以直接用你自己实现的 React API（项目里我配了 alias，`react` 和 `react-dom` 会指向 `src/lib`）。

## 核心测试

```bash
pnpm test
```

覆盖范围：
- **Diff 算法**：复用、删除、移动、初次渲染 Placement
- **Hooks**：useState/useReducer mount & update、函数式更新、hook 错位检测、effect tag 标记
- **批处理**：同一事件循环合并、flushSync 同步执行

## 我踩过的一些坑

### 坑 1：`linkFiber` 按值传递导致 sibling 链表断裂
一开始写 Diff 后的 fiber 链接逻辑时，我在 `linkFiber` 函数内部直接写了 `lastNewFiber = newFiber`，以为这样调用方的变量会被更新。结果页面永远只能渲染出第一个子节点——JS 的对象引用是按值传递的，函数内部的重新赋值对外部变量毫无影响。后来改为 `return newFiber`，让调用方重新接收返回值，sibling 链表才正常建立。这个 bug 让我对"JS 里没有指针"这件事有了肌肉记忆。

### 坑 2：`scheduleUpdateOnFiber` 一路回溯到了容器对象
最初实现 `scheduleUpdateOnFiber` 时，`while (node.return)` 会一直往上遍历到根节点之外，把 `_isContainer` 容器对象也当成了 fiber，导致后续 `beginWork` 时拿到一个根本不是 fiber 的东西，直接报错。修复方式是在循环条件里加了 `node.return.tag !== undefined`，确保停在真正的 fiber 上。这件事让我意识到 React 的"根"其实有两层：容器（container）和根 fiber（root fiber）。

### 坑 3：useEffect 和 useLayoutEffect 的执行时机
最早我把 useEffect 的 cleanup 和执行都塞进了 `commitWorker` 的同步递归里，结果 useEffect 的回调在 DOM 更新前就执行了，而且每次 commit 节点都会触发一次，性能稀烂。后来改成在 `commitWorker` 阶段只收集 Passive Effect，等整棵树 commit 完成后统一用 `setTimeout` 异步 flush。这才和 React 真正的行为对齐：useLayoutEffect 同步（浏览器绘制前），useEffect 异步（绘制后）。

### 坑 4：渲染阶段触发 setState 导致死循环
如果没有防护，在 `renderWithHooks` 里调用 `setState` 会立刻修改 `wip`，而 `wip` 正在被遍历，结果就是无限重新调度。我加了 `isRendering` 锁和 `renderPhaseUpdates` 队列：渲染阶段产生的更新先暂存，等当前轮次的 `commitRoot` 结束后再统一触发。这也解释了为什么 React 源码里有一堆 `didScheduleRenderPhaseUpdate` 的判断。

### 坑 5：批量更新不是天然的，要自己实现
一开始以为"在一个事件里多次 setState 只会触发一次重渲染"是框架自动做的，结果发现如果不加干预，每次 `dispatchReducerAction` 都会独立调用 `scheduleUpdateOnFiber`，一次点击能触发十几次 render。后来自己实现了 `isBatchingUpdates` 标志位 + `enqueueUpdate` / `flushUpdates`，在合成事件入口和 `scheduleCallback` 里配合，才实现了批量更新。

### 坑 6：Eager State Bailout —— 状态没变就不该 render
有一次写 Counter，点击按钮设置同样的数字，发现组件还是会重新走一遍完整渲染链路。排查后发现 `dispatchReducerAction` 没有把"新状态和旧状态相同"的情况过滤掉。后来引入了 `eagerState` 缓存：在 dispatch 阶段就预跑一遍 reducer，如果 `Object.is` 判定相同，直接 return，不走任何调度。这个优化在 React 源码里叫 Eager State Reducer。

### 坑 7：直接修改 current fiber 的 sibling（已重构）
最初为了限制 work loop 的遍历范围，我在 `dispatchReducerAction` 里直接写了 `fiber.sibling = null`。后来意识到这破坏了 current tree 的只读原则——React 的哲学是 current 不可变，所有修改应该在 WIP 树上进行。

**重构过程**：
1. 在 `ReactFiber.js` 中新增了 `createWorkInProgress`，实现了双缓冲机制中"基于 current 创建 WIP"的标准流程
2. 在 `scheduleUpdateOnFiber` 中，不再直接把 current 节点赋值给 `wip`，而是调用 `createWorkInProgress(node)` 创建一个新的 WIP 根节点
3. 把 `wip.sibling = null` 的切断逻辑从 `dispatchReducerAction` 迁移到 `scheduleUpdateOnFiber` 中，现在动的是 WIP 树，不是 current 树
4. 即使渲染被中断或出错，current tree 的结构依然保持完整

> 面试话术："我最初在 dispatch 阶段为了简化，直接写了 `fiber.sibling = null` 来限制 work loop 的遍历范围。但后来 review 代码时发现这违反了 React 的只读原则——current tree 不应该在渲染期间被修改。所以我重构了 `scheduleUpdateOnFiber`，在设置 `wip` 时通过 `createWorkInProgress` 创建一个新的 WIP 根节点，把 sibling 的切断放在 WIP 树上。这样即使渲染被中断或出错，current tree 的结构依然是完整的。"

## 和 React 源码的差异

这个项目是**为了理解原理**而做的，不是 1:1 还原：

| 特性 | 本项目 | React 18 源码 |
|------|--------|---------------|
| 调度器 | MessageChannel + 时间片 | 同上，但源码还有优先级通道 |
| Diff | 两轮遍历 + Map | 基本一致 |
| 并发模型 | **Lane 模型简化版（SyncLane + DefaultLane + 可打断骨架）** | 完整 Lane 模型 + 31 条优先级位运算 |
| Hooks | 基础 Hooks | 完整 Hooks + 内部优化 |
| WIP 树 | 已引入 `createWorkInProgress`，current 只读 | 完整双缓冲 + 复用池 |
| Suspense | ❌ 未实现 | ✅ |
| Error Boundary | ❌ 未实现 | ✅ |

## 后续计划

**高优先级：**

- [ ] **完整 Lane 模型 + 调度器多优先级**
  - 目前只有 `SyncLane` / `DefaultLane` 两条，源码中是 31 位 lane 位运算 + 5 级调度优先级（`ImmediatePriority` / `UserBlockingPriority` / `NormalPriority` / `LowPriority` / `IdlePriority`）
  - 参考源码：`ReactFiberLane.js`、`SchedulerPriorities.js`

- [ ] **Suspense 边界机制**
  - 支持子树 `throw Promise` → 捕获到 Suspense boundary → 切换 fallback UI → Promise resolve 后恢复真实内容
  - 这是 React 并发特性的门面，面试必问。参考源码：`ReactFiberSuspenseComponent.js`、`ReactFiberThenable.js`

- [ ] **Error Boundary（错误边界）**
  - 类组件支持 `static getDerivedStateFromError` + `componentDidCatch`
  - 渲染阶段抛错时，React 会沿 Fiber 树向上找到最近的 Error Boundary 并进入 fallback 渲染路径
  - 参考源码：`ReactFiberThrow.js` 中的 `throwException` 与 `createRootErrorUpdate`

- [ ] **useTransition / useDeferredValue**
  - React 18 并发特性的标志性 API：`startTransition` 包裹的更新标记为 `TransitionLane`，允许被更高优先级更新打断
  - `useDeferredValue` 依赖 Transition 机制实现"延迟值"，能让 UI 保持响应
  - 参考源码：`ReactFiberTransition.js`、`ReactStartTransition.js`

**中等优先级（性能优化 + 开发体验）：**

- [ ] **React.memo + forwardRef**
  - `memo` 通过自定义比较函数决定是否需要重新渲染；`forwardRef` 解决函数组件 ref 透传问题
  - 参考源码：`ReactMemo.js`、`ReactForwardRef.js`

- [ ] **合成事件系统（SyntheticEvent）**
  - 在根节点统一代理所有事件，实现事件委托、优先级调度、跨浏览器兼容
  - 参考源码：`react-dom/src/events/` 目录

- [ ] **useContext / createContext**
  - 跨层级传递数据，需要配合 Fiber 树在 `beginWork` 时读取/传递 context value
  - 参考源码：`ReactContext.js`、`ReactFiberNewContext.js`

## 关于我

大二前端，正在准备暑期实习。这个项目是我简历上"理解框架原理"的底气来源。如果你也在手写 React，欢迎交流。
