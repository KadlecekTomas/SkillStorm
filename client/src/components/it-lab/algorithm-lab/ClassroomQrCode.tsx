'use client';

import { useMemo, type JSX } from 'react';
import { qrMatrix } from '@/lib/qr-code';

type Props = {
  value: string;
  label?: string;
  className?: string;
};

export function ClassroomQrCode({ value, label = 'QR kód pro vstup do hodiny', className }: Props): JSX.Element {
  const matrix = useMemo(() => qrMatrix(value), [value]);
  const quiet = 4;
  const size = matrix.length + quiet * 2;
  const cells: JSX.Element[] = [];

  matrix.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (!dark) return;
      cells.push(
        <rect
          key={`${x}-${y}`}
          x={x + quiet}
          y={y + quiet}
          width="1"
          height="1"
          fill="currentColor"
        />,
      );
    });
  });

  return (
    <svg
      role="img"
      aria-label={label}
      data-testid="algorithm-class-qr"
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className={className}
    >
      <rect width={size} height={size} fill="white" />
      <g className="text-slate-950">{cells}</g>
    </svg>
  );
}
