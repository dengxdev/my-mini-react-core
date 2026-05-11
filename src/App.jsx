import PropTypes from "prop-types";
import { useState, useReducer } from "./lib/react/ReactHooks";

function App({ id }) {
	const [count, setCount] = useState(0);
	const [batchCount, setBatchCount] = useState(0);
	const [funcCount, setFuncCount] = useState(0);

	const [reducerState, dispatch] = useReducer((state, action) => {
		if (action.type === "inc") return state + action.payload;
		if (action.type === "dec") return state - action.payload;
		return state;
	}, 100);

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
		</div>
	);
}
// class App extends React.Component {
// 	constructor(props) {
// 		super(props);
// 	}
// 	render() {
// 		return (
// 			<div className="container" id={this.props.id}>
// 				<div className="one">
// 					<div className="two">
// 						<p>1</p>
// 						<p>2</p>
// 					</div>
// 					<div className="three">
// 						<p>3</p>
// 						<p>4</p>
// 					</div>
// 				</div>
// 				<p>this is a tes1</p>

// 			</div>
// 		);
// 	}
// }

App.propTypes = {
	id: PropTypes.string.isRequired,
};

export default App;
