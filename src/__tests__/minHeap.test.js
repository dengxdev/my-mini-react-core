import { describe, it, expect } from "vitest";
import { peek, push, pop } from "../lib/scheduler/SchedulerMinHeap.js";

/**
 * 最小堆（优先队列）单元测试
 * 该最小堆以任务的 sortIndex（过期时间）为键，sortIndex 越小越紧急、越靠近堆顶。
 */

// 辅助：构造一个任务对象
const makeTask = (sortIndex, id) => ({ sortIndex, id, callback: () => {} });

// 辅助：打印当前堆的 sortIndex 序列（仅用于测试过程可视化）
function dumpHeap(heap) {
	return "[" + heap.map((t) => t.sortIndex).join(", ") + "]";
}

describe("最小堆 - 基础操作", () => {
	it("peek: 空堆应返回 null", () => {
		const heap = [];
		expect(peek(heap)).toBe(null);
	});

	it("peek: 非空堆应返回堆顶（最小）任务", () => {
		const heap = [];
		push(heap, makeTask(5, 1));
		push(heap, makeTask(3, 2));
		push(heap, makeTask(8, 3));
		// 堆顶应为 sortIndex 最小的 3
		expect(peek(heap).sortIndex).toBe(3);
		console.log("  堆状态 sortIndex 序列:", dumpHeap(heap));
	});

	it("push: 插入更小的 sortIndex 应上浮到堆顶", () => {
		const heap = [];
		push(heap, makeTask(10, 1));
		push(heap, makeTask(8, 2));
		push(heap, makeTask(6, 3));
		expect(peek(heap).sortIndex).toBe(6);
		// 再插入一个更小的
		push(heap, makeTask(2, 4));
		expect(peek(heap).sortIndex).toBe(2);
		console.log("  上浮后堆顶 sortIndex = 2, 堆序列:", dumpHeap(heap));
	});

	it("pop: 空堆应返回 null", () => {
		const heap = [];
		expect(pop(heap)).toBe(null);
	});

	it("pop: 应按 sortIndex 升序依次弹出（堆排序效果）", () => {
		const heap = [];
		const keys = [9, 4, 7, 1, 6, 3, 8];
		keys.forEach((k, i) => push(heap, makeTask(k, i + 1)));
		console.log("  入堆顺序:", keys.join(", "));
		console.log("  建堆后序列:", dumpHeap(heap));

		const popped = [];
		while (peek(heap)) {
			popped.push(pop(heap).sortIndex);
		}
		console.log("  出堆顺序:", popped.join(", "));
		// 弹出顺序应为升序
		expect(popped).toEqual([1, 3, 4, 6, 7, 8, 9]);
	});
});

describe("最小堆 - 比较函数（双重排序键）", () => {
	it("sortIndex 相同时，按 id 升序排序（保证 FIFO）", () => {
		const heap = [];
		push(heap, makeTask(5, 3));
		push(heap, makeTask(5, 1));
		push(heap, makeTask(5, 2));
		// sortIndex 都是 5，堆顶应为 id 最小的 1
		expect(peek(heap).id).toBe(1);

		const order = [];
		while (peek(heap)) order.push(pop(heap).id);
		expect(order).toEqual([1, 2, 3]);
		console.log("  相同 sortIndex 下出堆 id 顺序:", order.join(", "));
	});
});

describe("最小堆 - 调度场景模拟", () => {
	it("模拟调度器：按过期时间紧急程度取出任务", () => {
		const heap = [];
		// 模拟 5 个更新任务，过期时间各不相同
		push(heap, makeTask(5000, 1)); // 最不紧急
		push(heap, makeTask(1000, 2)); // 最紧急
		push(heap, makeTask(3000, 3));
		push(heap, makeTask(2000, 4));
		push(heap, makeTask(4000, 5));
		console.log("  建堆后堆顶 sortIndex:", peek(heap).sortIndex);

		const execOrder = [];
		while (peek(heap)) {
			execOrder.push(pop(heap).sortIndex);
		}
		console.log("  调度执行顺序(按紧急度):", execOrder.join(", "));
		// 应按过期时间升序执行：1000 → 2000 → 3000 → 4000 → 5000
		expect(execOrder).toEqual([1000, 2000, 3000, 4000, 5000]);
	});

	it("动态插入：调度过程中新增更紧急任务应优先执行", () => {
		const heap = [];
		push(heap, makeTask(3000, 1));
		push(heap, makeTask(5000, 2));

		// 取出第一个任务
		expect(pop(heap).sortIndex).toBe(3000);

		// 此时新来了一个更紧急的任务
		push(heap, makeTask(1000, 3));
		// 堆顶应变为新插入的 1000
		expect(peek(heap).sortIndex).toBe(1000);
		console.log(
			"  动态插入后堆顶 sortIndex:",
			peek(heap).sortIndex,
			"(新任务抢占)",
		);
	});
});
