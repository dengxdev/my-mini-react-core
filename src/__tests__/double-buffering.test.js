import { describe, it, expect } from 'vitest';
import { createRoot } from '../lib/react-dom/ReactDom.js';
import React from '../lib/react/React.js';

describe('double buffering', () => {
  it('初次渲染后 container._reactRootContainer 指向根 fiber', () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    function App() {
      return 'hello';
    }

    root.render({ type: App, props: {}, key: null });
    expect(container._reactRootContainer).toBeTruthy();
    expect(container._reactRootContainer.type).toBe(App);
  });

  it('类组件 setState 后 DOM 应该被复用且内容更新', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    class App extends React.Component {
      constructor(props) {
        super(props);
        this.state = { count: 0 };
      }
      render() {
        return {
          type: 'div',
          props: { id: 'app', children: String(this.state.count) },
          key: null,
        };
      }
    }

    root.render({ type: App, props: {}, key: null });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const firstDiv = container.querySelector('#app');
    expect(firstDiv).toBeTruthy();
    expect(firstDiv.textContent).toBe('0');

    const instance = container._reactRootContainer.stateNode;
    instance.setState({ count: 1 });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const secondDiv = container.querySelector('#app');
    expect(secondDiv.textContent).toBe('1');
    expect(secondDiv).toBe(firstDiv); // DOM 复用
  });

  it('多次 setState 后 current 根正确切换且 DOM 持续更新', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    class App extends React.Component {
      constructor(props) {
        super(props);
        this.state = { count: 0 };
      }
      render() {
        return {
          type: 'span',
          props: { children: String(this.state.count) },
          key: null,
        };
      }
    }

    root.render({ type: App, props: {}, key: null });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const instance = container._reactRootContainer.stateNode;

    instance.setState({ count: 1 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container.querySelector('span').textContent).toBe('1');

    instance.setState({ count: 2 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container.querySelector('span').textContent).toBe('2');

    instance.setState({ count: 3 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container.querySelector('span').textContent).toBe('3');
  });
});
