export type AlgorithmCommand = 'FORWARD' | 'LEFT' | 'RIGHT';
export type AlgorithmDirection = 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';
export type GridPosition = { x: number; y: number };

export type AlgorithmWorld = {
  width: number;
  height: number;
  target: GridPosition;
  obstacles?: GridPosition[];
};

export type AlgorithmState = {
  position: GridPosition;
  direction: AlgorithmDirection;
};

export type AlgorithmStepResult = {
  state: AlgorithmState;
  command: AlgorithmCommand;
  stepNumber: number;
  valid: boolean;
  reason: 'OK' | 'OUTSIDE_ARENA' | 'OBSTACLE';
};

export const directionGlyph: Record<AlgorithmDirection, string> = {
  NORTH: '↑',
  EAST: '→',
  SOUTH: '↓',
  WEST: '←',
};

const turnLeft: Record<AlgorithmDirection, AlgorithmDirection> = {
  NORTH: 'WEST',
  WEST: 'SOUTH',
  SOUTH: 'EAST',
  EAST: 'NORTH',
};

const turnRight: Record<AlgorithmDirection, AlgorithmDirection> = {
  NORTH: 'EAST',
  EAST: 'SOUTH',
  SOUTH: 'WEST',
  WEST: 'NORTH',
};

const vector: Record<AlgorithmDirection, GridPosition> = {
  NORTH: { x: 0, y: -1 },
  EAST: { x: 1, y: 0 },
  SOUTH: { x: 0, y: 1 },
  WEST: { x: -1, y: 0 },
};

export const initialAlgorithmState = (): AlgorithmState => ({
  position: { x: 0, y: 0 },
  direction: 'EAST',
});

const samePosition = (a: GridPosition, b: GridPosition): boolean =>
  a.x === b.x && a.y === b.y;

export const executeAlgorithmStep = (
  current: AlgorithmState,
  command: AlgorithmCommand,
  world: AlgorithmWorld,
  stepNumber: number,
): AlgorithmStepResult => {
  if (command === 'LEFT') {
    return {
      state: { ...current, direction: turnLeft[current.direction] },
      command,
      stepNumber,
      valid: true,
      reason: 'OK',
    };
  }

  if (command === 'RIGHT') {
    return {
      state: { ...current, direction: turnRight[current.direction] },
      command,
      stepNumber,
      valid: true,
      reason: 'OK',
    };
  }

  const delta = vector[current.direction];
  const next = {
    x: current.position.x + delta.x,
    y: current.position.y + delta.y,
  };
  const outside = next.x < 0 || next.x >= world.width || next.y < 0 || next.y >= world.height;
  const obstacle = world.obstacles?.some((candidate) => samePosition(candidate, next)) ?? false;

  if (outside || obstacle) {
    return {
      state: current,
      command,
      stepNumber,
      valid: false,
      reason: outside ? 'OUTSIDE_ARENA' : 'OBSTACLE',
    };
  }

  return {
    state: { ...current, position: next },
    command,
    stepNumber,
    valid: true,
    reason: 'OK',
  };
};

export const isTargetReached = (
  state: AlgorithmState,
  world: AlgorithmWorld,
): boolean => samePosition(state.position, world.target);
