import {
  executeAlgorithmStep,
  initialAlgorithmState,
  type AlgorithmCommand,
  type AlgorithmState,
  type AlgorithmStepResult,
  type AlgorithmWorld,
} from './algorithm-engine';

export type BlockProgramNode =
  | { type: 'COMMAND'; command: AlgorithmCommand }
  | { type: 'REPEAT'; count: number; body: BlockProgramNode[] };

export type BlockExecutionStep = AlgorithmStepResult & {
  sourcePath: number[];
};

export type BlockProgramValidationReason =
  | 'INVALID_REPEAT_COUNT'
  | 'EMPTY_REPEAT_BODY'
  | 'MAX_NESTING_DEPTH_EXCEEDED';

export type BlockProgramFailureType =
  | 'PROGRAM_INVALID'
  | 'STEP_LIMIT_EXCEEDED'
  | 'WORLD_RULE';

export type BlockProgramFailureReason =
  | BlockProgramValidationReason
  | 'STEP_LIMIT_EXCEEDED'
  | 'OUTSIDE_ARENA'
  | 'OBSTACLE';

export type ExpandedBlockProgram = {
  steps: Array<{ command: AlgorithmCommand; sourcePath: number[] }>;
  valid: boolean;
  failureReason: BlockProgramValidationReason | 'STEP_LIMIT_EXCEEDED' | null;
};

export type BlockProgramResult = {
  state: AlgorithmState;
  steps: BlockExecutionStep[];
  valid: boolean;
  failedStep: number | null;
  failureType: BlockProgramFailureType | null;
  failureReason: BlockProgramFailureReason | null;
};

export const MAX_EXPANDED_STEPS = 64;
export const MAX_REPEAT_COUNT = 12;
export const MAX_NESTING_DEPTH = 6;

function validateNodes(
  nodes: BlockProgramNode[],
  depth = 0,
): BlockProgramValidationReason | null {
  if (depth > MAX_NESTING_DEPTH) {
    return 'MAX_NESTING_DEPTH_EXCEEDED';
  }

  for (const node of nodes) {
    if (node.type === 'COMMAND') continue;

    if (!Number.isInteger(node.count) || node.count < 1 || node.count > MAX_REPEAT_COUNT) {
      return 'INVALID_REPEAT_COUNT';
    }

    if (node.body.length === 0) {
      return 'EMPTY_REPEAT_BODY';
    }

    const nestedFailure = validateNodes(node.body, depth + 1);
    if (nestedFailure) return nestedFailure;
  }

  return null;
}

function flattenNodes(
  nodes: BlockProgramNode[],
  output: Array<{ command: AlgorithmCommand; sourcePath: number[] }>,
  path: number[] = [],
): boolean {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (!node) continue;

    const sourcePath = [...path, index];
    if (node.type === 'COMMAND') {
      if (output.length >= MAX_EXPANDED_STEPS) return false;
      output.push({ command: node.command, sourcePath });
      continue;
    }

    for (let iteration = 0; iteration < node.count; iteration += 1) {
      const complete = flattenNodes(node.body, output, [...sourcePath, iteration]);
      if (!complete) return false;
    }
  }

  return true;
}

export function expandBlockProgram(nodes: BlockProgramNode[]): ExpandedBlockProgram {
  const validationFailure = validateNodes(nodes);
  if (validationFailure) {
    return {
      steps: [],
      valid: false,
      failureReason: validationFailure,
    };
  }

  const steps: Array<{ command: AlgorithmCommand; sourcePath: number[] }> = [];
  const complete = flattenNodes(nodes, steps);

  return {
    steps,
    valid: complete,
    failureReason: complete ? null : 'STEP_LIMIT_EXCEEDED',
  };
}

export function executeBlockProgram(nodes: BlockProgramNode[], world: AlgorithmWorld): BlockProgramResult {
  const expansion = expandBlockProgram(nodes);
  let state = initialAlgorithmState();
  const steps: BlockExecutionStep[] = [];

  if (!expansion.valid) {
    const stepLimitExceeded = expansion.failureReason === 'STEP_LIMIT_EXCEEDED';
    return {
      state,
      steps,
      valid: false,
      failedStep: null,
      failureType: stepLimitExceeded ? 'STEP_LIMIT_EXCEEDED' : 'PROGRAM_INVALID',
      failureReason: expansion.failureReason,
    };
  }

  for (let index = 0; index < expansion.steps.length; index += 1) {
    const item = expansion.steps[index];
    if (!item) continue;

    const result = executeAlgorithmStep(state, item.command, world, index + 1);
    steps.push({ ...result, sourcePath: item.sourcePath });
    if (!result.valid) {
      const failureReason: 'OUTSIDE_ARENA' | 'OBSTACLE' =
        result.reason === 'OBSTACLE' ? 'OBSTACLE' : 'OUTSIDE_ARENA';
      return {
        state,
        steps,
        valid: false,
        failedStep: index + 1,
        failureType: 'WORLD_RULE',
        failureReason,
      };
    }
    state = result.state;
  }

  return {
    state,
    steps,
    valid: true,
    failedStep: null,
    failureType: null,
    failureReason: null,
  };
}
