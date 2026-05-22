// 引入 React 原生库
// import { createRoot } from "react-dom/client";
import { createRoot } from "./lib/react-dom/ReactDom.js";

import App from "./App.jsx";

const Root = createRoot(document.getElementById("root"));
Root.render(<App id="testId"/>);