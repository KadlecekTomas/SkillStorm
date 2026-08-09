import { readFileSync, writeFileSync } from 'node:fs';

const componentPath = 'client/src/components/it-lab/build-pc/BuildPcLab.tsx';
let component = readFileSync(componentPath, 'utf8');

const oldStyle = "                          style={{ left: `${slot.x}%`, top: `${slot.y}%`, width: `${slot.width}%`, height: `${slot.height}%` }}";
const newStyle = `                          style={{
                            left: \`${'${slot.x}'}%\`,
                            top: \`${'${slot.y}'}%\`,
                            width: \`${'${slot.width}'}%\`,
                            height: \`${'${slot.height}'}%\`,
                            zIndex:
                              slot.id === 'cpu-socket' && !installed.has('cpu')
                                ? 30
                                : slot.id === 'cpu-cooler' && installed.has('cpu')
                                  ? 30
                                  : 10,
                          }}`;

const oldPointer = `<div className="rounded-xl bg-black/20 px-2 py-3">
              <div className="text-lg font-black text-white">0</div>
              <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-600">pointer streams</div>
            </div>`;
const newPointer = `<div className="rounded-xl bg-black/20 px-2 py-3">
              <div data-testid="pointer-stream-count" className="text-lg font-black text-white">0</div>
              <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-600">pointer streams</div>
            </div>`;

if (!component.includes(oldStyle)) throw new Error('BuildPcLab slot style anchor not found');
if (!component.includes(oldPointer)) throw new Error('BuildPcLab pointer counter anchor not found');
component = component.replace(oldStyle, newStyle).replace(oldPointer, newPointer);
writeFileSync(componentPath, component);

const desktopPath = 'client/tests/scenarios/build-a-pc.scenario.ts';
let desktop = readFileSync(desktopPath, 'utf8');
const oldAssertion = "await expect(page.getByText('0 pointer streams')).toBeVisible();";
const newAssertion = "await expect(page.getByTestId('pointer-stream-count')).toHaveText('0');";
if (desktop.split(oldAssertion).length - 1 !== 2) {
  throw new Error('Expected exactly two pointer-stream text assertions');
}
desktop = desktop.split(oldAssertion).join(newAssertion);
writeFileSync(desktopPath, desktop);
