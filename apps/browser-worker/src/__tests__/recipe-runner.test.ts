import { describe, it, expect, vi } from 'vitest';
import { RecipeRunner, type RecipeAction } from '../recipe-runner.js';

function createMockPage(overrides: Record<string, unknown> = {}) {
  return {
    goto: vi.fn().mockResolvedValue({ status: () => 200 }),
    locator: vi.fn().mockReturnValue({
      click: vi.fn().mockResolvedValue(undefined),
      fill: vi.fn().mockResolvedValue(undefined),
      press: vi.fn().mockResolvedValue(undefined),
      selectOption: vi.fn().mockResolvedValue(undefined),
    }),
    waitForSelector: vi.fn().mockResolvedValue(undefined),
    mouse: { wheel: vi.fn().mockResolvedValue(undefined) },
    screenshot: vi.fn().mockResolvedValue(Buffer.from('png-data')),
    content: vi.fn().mockResolvedValue('<html>rendered</html>'),
    innerText: vi.fn().mockResolvedValue('visible text'),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any;
}

describe('RecipeRunner', () => {
  const runner = new RecipeRunner();

  describe('allowlisted actions', () => {
    it('should execute a goto action', async () => {
      const page = createMockPage();
      const actions: RecipeAction[] = [
        { type: 'goto', url: 'https://example.com' },
      ];
      const result = await runner.run(page, actions);
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().success).toBe(true);
      expect(result._unsafeUnwrap().steps).toHaveLength(1);
      expect(page.goto).toHaveBeenCalledWith('https://example.com', expect.objectContaining({ timeout: 30000 }));
    });

    it('should execute a click action', async () => {
      const page = createMockPage();
      const actions: RecipeAction[] = [
        { type: 'click', selector: 'button' },
      ];
      const result = await runner.run(page, actions);
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().success).toBe(true);
    });

    it('should execute a fill action', async () => {
      const page = createMockPage();
      const actions: RecipeAction[] = [
        { type: 'fill', selector: '#input', value: 'hello' },
      ];
      const result = await runner.run(page, actions);
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().success).toBe(true);
    });

    it('should execute a press action', async () => {
      const page = createMockPage();
      const actions: RecipeAction[] = [
        { type: 'press', selector: '#input', key: 'Enter' },
      ];
      const result = await runner.run(page, actions);
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().success).toBe(true);
    });

    it('should execute a select action', async () => {
      const page = createMockPage();
      const actions: RecipeAction[] = [
        { type: 'select', selector: '#dropdown', value: 'option1' },
      ];
      const result = await runner.run(page, actions);
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().success).toBe(true);
    });

    it('should execute a waitForSelector action', async () => {
      const page = createMockPage();
      const actions: RecipeAction[] = [
        { type: 'waitForSelector', selector: '.loaded' },
      ];
      const result = await runner.run(page, actions);
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().success).toBe(true);
    });

    it('should execute a scroll action with default amount', async () => {
      const page = createMockPage();
      const actions: RecipeAction[] = [
        { type: 'scroll', direction: 'down' },
      ];
      const result = await runner.run(page, actions);
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().success).toBe(true);
      expect(page.mouse.wheel).toHaveBeenCalledWith(0, 500);
    });

    it('should execute a scroll action with custom amount', async () => {
      const page = createMockPage();
      const actions: RecipeAction[] = [
        { type: 'scroll', direction: 'up', amount: 200 },
      ];
      const result = await runner.run(page, actions);
      expect(result.isOk()).toBe(true);
      expect(page.mouse.wheel).toHaveBeenCalledWith(0, -200);
    });

    it('should execute a screenshot action', async () => {
      const page = createMockPage();
      const actions: RecipeAction[] = [
        { type: 'screenshot', fullPage: true },
      ];
      const result = await runner.run(page, actions);
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().success).toBe(true);
    });

    it('should execute extractHtml action', async () => {
      const page = createMockPage();
      const actions: RecipeAction[] = [
        { type: 'extractHtml' },
      ];
      const result = await runner.run(page, actions);
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().success).toBe(true);
    });

    it('should execute extractText action', async () => {
      const page = createMockPage();
      const actions: RecipeAction[] = [
        { type: 'extractText' },
      ];
      const result = await runner.run(page, actions);
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().success).toBe(true);
    });
  });

  describe('disallowed actions', () => {
    it('should reject actions with non-allowlisted types', async () => {
      const page = createMockPage();
      const actions = [
        { type: 'evaluate', selector: 'body' },
      ] as any as RecipeAction[];
      const result = await runner.run(page, actions);
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toContain('not allowlisted');
    });
  });

  describe('step timeout', () => {
    it('should return error result when a step fails', async () => {
      const page = createMockPage({
        goto: vi.fn().mockRejectedValue(new Error('Navigation timeout')),
      });
      const actions: RecipeAction[] = [
        { type: 'goto', url: 'https://example.com' },
      ];
      const result = await runner.run(page, actions);
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().success).toBe(false);
      expect(result._unsafeUnwrap().error).toContain('failed');
    });
  });

  describe('action timeline tracking', () => {
    it('should track all steps in the timeline', async () => {
      const page = createMockPage();
      const actions: RecipeAction[] = [
        { type: 'goto', url: 'https://example.com' },
        { type: 'extractHtml' },
        { type: 'extractText' },
      ];
      const result = await runner.run(page, actions);
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().steps).toHaveLength(3);
      expect(result._unsafeUnwrap().steps[0]?.action.type).toBe('goto');
      expect(result._unsafeUnwrap().steps[1]?.action.type).toBe('extractHtml');
      expect(result._unsafeUnwrap().steps[2]?.action.type).toBe('extractText');
    });
  });
});