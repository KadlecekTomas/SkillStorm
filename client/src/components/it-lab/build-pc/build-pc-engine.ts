export type BuildPcDifficulty = 'EXPLORER' | 'BUILDER';
export type BuildPcScaffolding = 'GUIDED' | 'ASSISTED' | 'INDEPENDENT';

export type PcComponentId =
  | 'cpu'
  | 'cooler'
  | 'ram'
  | 'ssd'
  | 'gpu'
  | 'psu'
  | 'atx24'
  | 'eps8';

export type PcSlotId =
  | 'cpu-socket'
  | 'cpu-cooler'
  | 'dimm-a2'
  | 'm2-slot'
  | 'pcie-x16'
  | 'psu-bay'
  | 'atx24-header'
  | 'eps8-header';

export type PcComponentDefinition = {
  id: PcComponentId;
  name: string;
  shortName: string;
  purpose: string;
  target: PcSlotId;
  checkpoint: string;
  accent: string;
};

export type PcSlotDefinition = {
  id: PcSlotId;
  label: string;
  hint: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type BuildPcSemanticEvent =
  | 'COMPONENT_SELECTED'
  | 'COMPONENT_PLACED'
  | 'PLACEMENT_REJECTED'
  | 'HINT_REQUESTED'
  | 'EXPERIMENT_RESET'
  | 'CHECKPOINT_COMPLETED'
  | 'POWER_ON_ATTEMPTED'
  | 'BUILD_COMPLETED';

export const PC_COMPONENTS: PcComponentDefinition[] = [
  {
    id: 'cpu',
    name: 'Procesor',
    shortName: 'CPU',
    purpose: 'Provádí instrukce a výpočty.',
    target: 'cpu-socket',
    checkpoint: 'Usaď CPU do socketu.',
    accent: 'from-violet-400 to-fuchsia-500',
  },
  {
    id: 'cooler',
    name: 'Chladič procesoru',
    shortName: 'COOLER',
    purpose: 'Odvádí teplo z procesoru.',
    target: 'cpu-cooler',
    checkpoint: 'Zajisti chlazení CPU.',
    accent: 'from-cyan-400 to-sky-500',
  },
  {
    id: 'ram',
    name: 'Operační paměť',
    shortName: 'RAM',
    purpose: 'Drží data, se kterými počítač právě pracuje.',
    target: 'dimm-a2',
    checkpoint: 'Vlož RAM do správného DIMM slotu.',
    accent: 'from-emerald-400 to-teal-500',
  },
  {
    id: 'ssd',
    name: 'NVMe SSD',
    shortName: 'SSD',
    purpose: 'Ukládá systém, aplikace a soubory.',
    target: 'm2-slot',
    checkpoint: 'Přidej systémové úložiště.',
    accent: 'from-amber-300 to-orange-500',
  },
  {
    id: 'gpu',
    name: 'Grafická karta',
    shortName: 'GPU',
    purpose: 'Zpracovává grafiku a paralelní výpočty.',
    target: 'pcie-x16',
    checkpoint: 'Připoj grafickou kartu přes PCIe.',
    accent: 'from-rose-400 to-red-500',
  },
  {
    id: 'psu',
    name: 'Napájecí zdroj',
    shortName: 'PSU',
    purpose: 'Převádí a rozvádí elektrickou energii.',
    target: 'psu-bay',
    checkpoint: 'Usaď zdroj do skříně.',
    accent: 'from-slate-300 to-slate-500',
  },
  {
    id: 'atx24',
    name: '24pin ATX kabel',
    shortName: 'ATX 24',
    purpose: 'Napájí základní desku.',
    target: 'atx24-header',
    checkpoint: 'Napájej základní desku.',
    accent: 'from-yellow-300 to-amber-500',
  },
  {
    id: 'eps8',
    name: '8pin CPU EPS',
    shortName: 'CPU EPS',
    purpose: 'Přivádí napájení k CPU napájecí kaskádě.',
    target: 'eps8-header',
    checkpoint: 'Připoj napájení procesoru.',
    accent: 'from-lime-300 to-green-500',
  },
];

export const PC_SLOTS: PcSlotDefinition[] = [
  { id: 'cpu-socket', label: 'CPU SOCKET', hint: 'Čtvercový socket uprostřed desky', x: 35, y: 24, width: 19, height: 21 },
  { id: 'cpu-cooler', label: 'CPU COOLER', hint: 'Montážní oblast nad CPU', x: 31.5, y: 19.5, width: 26, height: 30 },
  { id: 'dimm-a2', label: 'DIMM A2', hint: 'Druhý dlouhý paměťový slot', x: 64, y: 17, width: 8, height: 40 },
  { id: 'm2-slot', label: 'M.2', hint: 'Úzký M.2 slot pod CPU', x: 35, y: 54, width: 27, height: 7 },
  { id: 'pcie-x16', label: 'PCIe x16', hint: 'Nejdelší rozšiřující slot', x: 27, y: 68, width: 47, height: 8 },
  { id: 'psu-bay', label: 'PSU BAY', hint: 'Spodní komora skříně', x: 8, y: 80, width: 28, height: 13 },
  { id: 'atx24-header', label: '24PIN', hint: 'Velký napájecí konektor na pravém okraji', x: 79, y: 35, width: 8, height: 20 },
  { id: 'eps8-header', label: 'CPU 8PIN', hint: 'Napájení CPU v horním rohu', x: 19, y: 9, width: 18, height: 8 },
];

export function componentById(id: PcComponentId): PcComponentDefinition {
  const component = PC_COMPONENTS.find((item) => item.id === id);
  if (!component) throw new Error(`Unknown PC component: ${id}`);
  return component;
}

export function slotById(id: PcSlotId): PcSlotDefinition {
  const slot = PC_SLOTS.find((item) => item.id === id);
  if (!slot) throw new Error(`Unknown PC slot: ${id}`);
  return slot;
}

export function isPlacementValid(componentId: PcComponentId, slotId: PcSlotId): boolean {
  return componentById(componentId).target === slotId;
}

export function nextRequiredComponent(installed: ReadonlySet<PcComponentId>): PcComponentDefinition | null {
  return PC_COMPONENTS.find((component) => !installed.has(component.id)) ?? null;
}

export function buildProgress(installedCount: number): number {
  return Math.round((installedCount / PC_COMPONENTS.length) * 100);
}

export function isBuildReady(installed: ReadonlySet<PcComponentId>): boolean {
  return PC_COMPONENTS.every((component) => installed.has(component.id));
}
