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

export type BlockProgramResult = {
  state: AlgorithmState;
  steps: BlockExecutionStep[];
  valid: boolean;
  failedStep: number | null;
};

export const MAX_EXPANDED_STEPS = 64;

function flattenNodes(
  nodes: BlockProgramNode[],
  output: Array<{ command: AlgorithmCommand; sourcePath: number[] }>,
  path: number[] = [],
): void {
  nodes.forEach((node, index) => {
    const sourcePath = [...path, index];
    if (node.type === 'COMMAND') {
      output.push({ command: node.command, sourcePath });
      return;
    }

    const count = Math.max(0, Math.min(12, Math.floor(node.count)));
    for (let iteration = 0; iteration < count; iteration += 1) {
      flattenNodes(node.body, output, [...sourcePath, iteration]);
      if (output.length >= MAX_EXPANDED_STEPS) return;
    }
  });
}

export function expandBlockProgram(nodes: BlockProgramNode[]): Array<{ command: AlgorithmCommand; sourcePath: number[] }> {
  const output: Array<{ command: AlgorithmCommand; sourcePath: number[] }> = [];
  flattenNodes(nodes, output);
  return output.slice(0, MAX_EXPANDED_STEPS);
}

export function executeBlockProgram(nodes: BlockProgramNode[], world: AlgorithmWorld): BlockProgramResult {
  const expanded = expandBlockProgram(nodes);
  let state = initialAlgorithmState();
  const steps: BlockExecutionStep[] = [];

  for (let index = 0; index < expanded.length; index += 1) {
    const item = expanded[index];
    if (!item) continue;
    const result = executeAlgorithmStep(state, item.command, world, index + 1);
    steps.push({ ...result, sourcePath: item.sourcePath });
    if (!result.valid) {
      return { state, steps, valid: false, failedStep: index + 1 };
    }
    state = result.state;
  }

  return { state, steps, valid: true, failedStep: null };
}
