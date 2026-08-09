import { readFileSync, writeFileSync } from 'node:fs';

const path = 'client/src/components/it-lab/build-pc/BuildPcLab.tsx';
let source = readFileSync(path, 'utf8');

const beforeDrag = "                  onDragStart={(event) => onDragStart(event, component.id)}";
const afterDrag = "                  onDragStartCapture={(event) => onDragStart(event, component.id)}";
const beforeTap = "                  whileTap={done ? undefined : { scale: 0.98 }}";
const afterTap = "                  whileTap={done ? { scale: 1 } : { scale: 0.98 }}";

if (!source.includes(beforeDrag) || !source.includes(beforeTap)) {
  throw new Error('Expected BuildPcLab repair anchors not found');
}

source = source.replace(beforeDrag, afterDrag).replace(beforeTap, afterTap);
writeFileSync(path, source);
