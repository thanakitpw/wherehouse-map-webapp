// ผัง Zone A จากไฟล์ "location warehouse.xlsx" ของลูกค้า
export const ZONE = "A";
export const RACKS = ["AA", "AB", "AC", "AD", "AE", "AF"] as const;
export const BAYS = 15;
export const PALLETS = 2;
export const LEVELS = 6;

export const pad = (n: number) => String(n).padStart(2, "0");

export function codeOf(rack: string, bay: number, pallet: number, level: number) {
  return `${rack}-${pad(bay)}-${pad(pallet)}${pad(level)}`;
}

export function describeLocation(l: { rack: string; bay: number; pallet: number; level: number }) {
  return `Zone ${ZONE} · แร็ค ${l.rack} · Bay ${pad(l.bay)} · พาเลท ${pad(l.pallet)} · ชั้น ${pad(l.level)}`;
}

export function allLocations() {
  const list: { code: string; zone: string; rack: string; bay: number; pallet: number; level: number }[] = [];
  for (const rack of RACKS)
    for (let bay = 1; bay <= BAYS; bay++)
      for (let pallet = 1; pallet <= PALLETS; pallet++)
        for (let level = 1; level <= LEVELS; level++)
          list.push({ code: codeOf(rack, bay, pallet, level), zone: ZONE, rack, bay, pallet, level });
  return list;
}
