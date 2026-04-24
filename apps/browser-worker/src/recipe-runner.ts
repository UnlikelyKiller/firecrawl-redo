import type { Page } from 'playwright';
import { Result, ok, err } from 'neverthrow';

export type RecipeAction =
  | { readonly type: 'goto'; readonly url: string; readonly timeout?: number }
  | { readonly type: 'click'; readonly selector: string; readonly timeout?: number }
  | { readonly type: 'fill'; readonly selector: string; readonly value: string; readonly timeout?: number }
  | { readonly type: 'press'; readonly selector: string; readonly key: string; readonly timeout?: number }
  | { readonly type: 'select'; readonly selector: string; readonly value: string; readonly timeout?: number }
  | { readonly type: 'waitForSelector'; readonly selector: string; readonly timeout?: number }
  | { readonly type: 'scroll'; readonly direction: 'up' | 'down'; readonly amount?: number }
  | { readonly type: 'screenshot'; readonly fullPage?: boolean }
  | { readonly type: 'extractHtml' }
  | { readonly type: 'extractText' };

export interface RecipeStep {
  readonly action: RecipeAction;
  readonly result?: unknown;
}

export interface RecipeResult {
  readonly steps: ReadonlyArray<RecipeStep>;
  readonly success: boolean;
  readonly error?: string;
}

export class RecipeRunnerError extends Error {
  override readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'RecipeRunnerError';
    this.cause = cause;
  }
}

const STEP_TIMEOUT_MS = 30_000;
const TOTAL_TIMEOUT_MS = 120_000;

const ALLOWLISTED_TYPES: ReadonlySet<string> = new Set([
  'goto',
  'click',
  'fill',
  'press',
  'select',
  'waitForSelector',
  'scroll',
  'screenshot',
  'extractHtml',
  'extractText',
]);

function getActionTimeout(action: RecipeAction): number | undefined {
  if ('timeout' in action && typeof action.timeout === 'number') {
    return action.timeout;
  }
  return undefined;
}

export class RecipeRunner {
  async run(page: Page, actions: ReadonlyArray<RecipeAction>): Promise<Result<RecipeResult, RecipeRunnerError>> {
    const steps: RecipeStep[] = [];
    const totalStart = Date.now();

    for (const action of actions) {
      if (!ALLOWLISTED_TYPES.has(action.type)) {
        return err(new RecipeRunnerError(`Action type "${action.type}" is not allowlisted.`));
      }

      const elapsed = Date.now() - totalStart;
      if (elapsed >= TOTAL_TIMEOUT_MS) {
        return err(new RecipeRunnerError(`Total timeout of ${TOTAL_TIMEOUT_MS}ms exceeded after ${steps.length} steps.`));
      }

      const stepTimeout = getActionTimeout(action) ?? STEP_TIMEOUT_MS;
      const remainingBudget = TOTAL_TIMEOUT_MS - elapsed;
      const effectiveTimeout = Math.min(stepTimeout, remainingBudget);

      const stepResult = await this.executeStep(page, action, effectiveTimeout);
      if (stepResult.isErr()) {
        return ok({
          steps,
          success: false,
          error: stepResult.error.message,
        });
      }

      steps.push({ action, result: stepResult.value });
    }

    return ok({ steps, success: true });
  }

  private async executeStep(
    page: Page,
    action: RecipeAction,
    timeout: number,
  ): Promise<Result<unknown, RecipeRunnerError>> {
    const exec = async (): Promise<unknown> => {
      switch (action.type) {
        case 'goto':
          return page.goto(action.url, { timeout, waitUntil: 'domcontentloaded' });

        case 'click':
          return page.locator(action.selector).click({ timeout });

        case 'fill':
          return page.locator(action.selector).fill(action.value, { timeout });

        case 'press':
          return page.locator(action.selector).press(action.key, { timeout });

        case 'select':
          return page.locator(action.selector).selectOption(action.value, { timeout });

        case 'waitForSelector':
          return page.waitForSelector(action.selector, { timeout });

        case 'scroll': {
          const scrollAmount = action.amount ?? 500;
          const direction = action.direction === 'up' ? -scrollAmount : scrollAmount;
          return page.mouse.wheel(0, direction);
        }

        case 'screenshot':
          return page.screenshot({ fullPage: action.fullPage ?? false, timeout });

        case 'extractHtml':
          return page.content();

        case 'extractText':
          return page.innerText('body', { timeout });

        default:
          throw new RecipeRunnerError(`Unreachable: unhandled action type ${(action as {type: string}).type}`);
      }
    };

    try {
      const result = await exec();
      return ok(result);
    } catch (e) {
      return err(new RecipeRunnerError(`Step "${action.type}" failed`, e));
    }
  }
}