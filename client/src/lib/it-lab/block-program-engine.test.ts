import { describe, expect, it } from 'vitest';
import {
  MAX_EXPANDED_STEPS,
  executeBlockProgram,
  expandBlockProgram,
  type BlockProgramNode,
} from './block-program-engine';
import type { AlgorithmWorld } from './algorithm-engine';

const openWorld: AlgorithmWorld = {
  width: 20,
  height: 20,
  target: { x: 10, y: 10 },
};

describe('block program engine', () => {
  it('expands nested repeats deterministically and preserves source paths', () => {
    const program: BlockProgramNode[] = [
      {
        type: 'REPEAT',
        count: 2,
        body: [
          { type: 'COMMAND', command: 'FORWARD' },
          {
            type: 'REPEAT',
            count: 2,
            body: [{ type: 'COMMAND', command: 'RIGHT' }],
          },
        ],
      },
    ];

    const expansion = expandBlockProgram(program);

    expect(expansion.valid).toBe(true);
    expect(expansion.failureReason).toBeNull();
    expect(expansion.steps.map((step) => step.command)).toEqual([
      'FORWARD',
      'RIGHT',
      'RIGHT',
      'FORWARD',
      'RIGHT',
      'RIGHT',
    ]);
    expect(expansion.steps.map((step) => step.sourcePath)).toEqual([
      [0, 0, 0],
      [0, 0, 1, 0, 0],
      [0, 0, 1, 1, 0],
      [0, 1, 0],
      [0, 1, 1, 0, 0],
      [0, 1, 1, 1, 0],
    ]);
  });

  it('separates stable source nodes from runtime repeat iterations', () => {
    const expansion = expandBlockProgram([
      {
        type: 'REPEAT',
        count: 2,
        body: [
          { type: 'COMMAND', command: 'FORWARD' },
          {
            type: 'REPEAT',
            count: 2,
            body: [{ type: 'COMMAND', command: 'RIGHT' }],
          },
        ],
      },
    ]);

    expect(expansion.steps.map((step) => step.nodePath)).toEqual([
      [0, 0],
      [0, 1, 0],
      [0, 1, 0],
      [0, 0],
      [0, 1, 0],
      [0, 1, 0],
    ]);
    expect(expansion.steps.map((step) => step.iterationPath)).toEqual([
      [0],
      [0, 0],
      [0, 1],
      [1],
      [1, 0],
      [1, 1],
    ]);
  });

  it('rejects invalid repeat counts instead of silently normalizing them', () => {
    const expansion = expandBlockProgram([
      {
        type: 'REPEAT',
        count: 0,
        body: [{ type: 'COMMAND', command: 'FORWARD' }],
      },
    ]);

    expect(expansion).toEqual({
      steps: [],
      valid: false,
      failureReason: 'INVALID_REPEAT_COUNT',
    });
  });

  it('rejects empty repeat bodies', () => {
    const expansion = expandBlockProgram([
      {
        type: 'REPEAT',
        count: 3,
        body: [],
      },
    ]);

    expect(expansion.valid).toBe(false);
    expect(expansion.failureReason).toBe('EMPTY_REPEAT_BODY');
  });

  it('reports the execution cap instead of treating a truncated program as valid', () => {
    const expansion = expandBlockProgram([
      {
        type: 'REPEAT',
        count: 12,
        body: [
          {
            type: 'REPEAT',
            count: 12,
            body: [{ type: 'COMMAND', command: 'FORWARD' }],
          },
        ],
      },
    ]);

    expect(expansion.valid).toBe(false);
    expect(expansion.failureReason).toBe('STEP_LIMIT_EXCEEDED');
    expect(expansion.steps).toHaveLength(MAX_EXPANDED_STEPS);

    const result = executeBlockProgram(
      [
        {
          type: 'REPEAT',
          count: 12,
          body: [
            {
              type: 'REPEAT',
              count: 12,
              body: [{ type: 'COMMAND', command: 'FORWARD' }],
            },
          ],
        },
      ],
      openWorld,
    );

    expect(result.valid).toBe(false);
    expect(result.failureType).toBe('STEP_LIMIT_EXCEEDED');
    expect(result.failureReason).toBe('STEP_LIMIT_EXCEEDED');
    expect(result.steps).toEqual([]);
  });

  it('preserves a world-rule failure as a debuggable executed step', () => {
    const narrowWorld: AlgorithmWorld = {
      width: 2,
      height: 1,
      target: { x: 1, y: 0 },
    };

    const result = executeBlockProgram(
      [
        {
          type: 'REPEAT',
          count: 3,
          body: [{ type: 'COMMAND', command: 'FORWARD' }],
        },
      ],
      narrowWorld,
    );

    expect(result.valid).toBe(false);
    expect(result.failedStep).toBe(2);
    expect(result.failureType).toBe('WORLD_RULE');
    expect(result.failureReason).toBe('OUTSIDE_ARENA');
    expect(result.steps).toHaveLength(2);
    expect(result.steps[1]?.sourcePath).toEqual([0, 1, 0]);
    expect(result.steps[1]?.nodePath).toEqual([0, 0]);
    expect(result.steps[1]?.iterationPath).toEqual([1]);
    expect(result.state.position).toEqual({ x: 1, y: 0 });
  });
});
