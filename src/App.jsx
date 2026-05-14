import PropTypes from "prop-types";
import {
	useState,
	useReducer,
	flushSync,
} from "./lib/react/ReactHooks";

function App({ id }) {
	const [count, setCount] = useState(0);
	const [batchCount, setBatchCount] = useState(0);
	const [funcCount, setFuncCount] = useState(0);

	const [reducerState, dispatch] = useReducer((state, action) => {
		if (action.type === "inc") return state + action.payload;
		if (action.type === "dec") return state - action.payload;
		return state;
	}, 100);

	// Lane 模型 Demo：flushSync（SyncLane）vs 普通 setState（DefaultLane）
	const [syncCount, setSyncCount] = useState(0);
	const [normalCount, setNormalCount] = useState(0);

	const handleSyncIncrement = () => {
		// flushSync 内部会设置 currentUpdateLane = SyncLane
		// 导致 setSyncCount 直接同步执行 workloop，不走 Scheduler
		flushSync(() => {
			setSyncCount((c) => c + 1);
		});
		// 到这里 DOM 已经同步更新完毕
		console.log("[SyncLane] DOM 已同步更新，当前值:", syncCount + 1);
	};

	const handleNormalIncrement = () => {
		// 普通的 setState 走 DefaultLane，通过 enqueueUpdate 进入微任务批处理
		setNormalCount((c) => c + 1);
		setNormalCount((c) => c + 1);
		// 此时 DOM 还未更新，两次更新会被 batch 合并为一次渲染
		console.log("[DefaultLane] 更新已入队，等待批处理");
	};

	return (
		<div className="container" id={id}>
			<div className="one">
				<div className="two">
					<p>1</p>
					<p>2</p>
				</div>
				<div className="three">
					<p>3</p>
					<p>4</p>
				</div>
			</div>
			<p>this is a tes1</p>

			<div>
				<button onClick={() => setCount(count - 1)}>-1</button>
				<span>{count}</span>
				<button onClick={() => setCount(count + 1)}>+1</button>
				<span>（基础 useState）</span>
			</div>

			<div>
				<button
					onClick={() => {
						setBatchCount(batchCount + 1);
						setBatchCount(batchCount + 1);
						setBatchCount(batchCount + 1);
					}}>
					批量 +1 x3
				</button>
				<span>{batchCount}</span>
				<span>（批量更新：预期只 +1）</span>
			</div>

			<div>
				<button
					onClick={() => {
						setFuncCount((c) => c + 1);
						setFuncCount((c) => c + 1);
						setFuncCount((c) => c + 1);
					}}>
					函数式 +1 x3
				</button>
				<span>{funcCount}</span>
				<span>（函数式更新：预期 +3）</span>
			</div>

			<div>
				<button onClick={() => dispatch({ type: "dec", payload: 10 })}>
					-10
				</button>
				<span>{reducerState}</span>
				<button onClick={() => dispatch({ type: "inc", payload: 10 })}>
					+10
				</button>
				<span>（useReducer）</span>
			</div>

			<hr />

			<div style={{ marginTop: "16px" }}>
				<h3>Lane 模型简化版 Demo</h3>
				<div>
					<button onClick={handleSyncIncrement}>
						SyncLane +1（flushSync 同步更新）
					</button>
					<span>{syncCount}</span>
				</div>
				<div>
					<button onClick={handleNormalIncrement}>
						DefaultLane +2（两次 setState 自动批处理）
					</button>
					<span>{normalCount}</span>
				</div>
				<p style={{ fontSize: "12px", color: "#666" }}>
					打开控制台观察两种 lane 的执行日志差异。SyncLane 会绕过
					Scheduler 直接同步执行 workloop；DefaultLane 走
					MessageChannel 调度，支持时间片让出。
				</p>
			</div>
		</div>
	);
}

App.propTypes = {
	id: PropTypes.string.isRequired,
};

export default App;
