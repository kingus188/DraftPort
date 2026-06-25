import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAutosaveScheduler } from "../../hooks/autosaveScheduler";

describe("createAutosaveScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("停手 idleMs 后保存一次", () => {
    const onSave = vi.fn();
    const scheduler = createAutosaveScheduler({
      onSave,
      idleMs: 800,
      maxWaitMs: 5000,
    });

    scheduler.schedule();
    vi.advanceTimersByTime(799);
    expect(onSave).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("每次 schedule 重置 idle 计时(debounce)", () => {
    const onSave = vi.fn();
    const scheduler = createAutosaveScheduler({
      onSave,
      idleMs: 800,
      maxWaitMs: 5000,
    });

    scheduler.schedule();
    vi.advanceTimersByTime(500);
    scheduler.schedule();
    vi.advanceTimersByTime(500);
    expect(onSave).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("连续输入时由 maxWaitMs 兜底强制保存", () => {
    const onSave = vi.fn();
    const scheduler = createAutosaveScheduler({
      onSave,
      idleMs: 800,
      maxWaitMs: 5000,
    });

    scheduler.schedule();
    for (let i = 1; i <= 24; i++) {
      vi.advanceTimersByTime(200); // 每 200ms 输入一次,idle 永不触发
      scheduler.schedule();
    }
    expect(onSave).not.toHaveBeenCalled(); // t=4800,尚未到 maxWait

    vi.advanceTimersByTime(200); // t=5000
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("flush 在有待写时立即保存,无待写时不动作", () => {
    const onSave = vi.fn();
    const scheduler = createAutosaveScheduler({
      onSave,
      idleMs: 800,
      maxWaitMs: 5000,
    });

    scheduler.flush();
    expect(onSave).not.toHaveBeenCalled();

    scheduler.schedule();
    scheduler.flush();
    expect(onSave).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5000); // flush 后已无待写
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("cancel 清除待写且不保存", () => {
    const onSave = vi.fn();
    const scheduler = createAutosaveScheduler({
      onSave,
      idleMs: 800,
      maxWaitMs: 5000,
    });

    scheduler.schedule();
    scheduler.cancel();
    vi.advanceTimersByTime(5000);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("保存后重新进入新的计时周期", () => {
    const onSave = vi.fn();
    const scheduler = createAutosaveScheduler({
      onSave,
      idleMs: 800,
      maxWaitMs: 5000,
    });

    scheduler.schedule();
    vi.advanceTimersByTime(800);
    expect(onSave).toHaveBeenCalledTimes(1);

    scheduler.schedule();
    vi.advanceTimersByTime(800);
    expect(onSave).toHaveBeenCalledTimes(2);
  });
});
