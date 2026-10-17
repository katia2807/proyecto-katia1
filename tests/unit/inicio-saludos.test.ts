import { describe, expect, test } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InicioSaludo } from "@/components/inicio/inicio-saludo";
import { createInicioSaludoStore, INICIO_SALUDO_DEFAULT, INICIO_SALUDO_STORAGE_KEY, parseInicioSaludoState, readInicioSaludoId, SALUDOS_INICIO, selectInicioSaludo, syncInicioSaludo, type InicioSaludoState } from "@/lib/inicio-saludos";

const day = (index: number) => new Date(Date.UTC(2026, 9, 17 + index)).toISOString().slice(0, 10);
function fakeStorage(initial: string | null = null) {
  let raw = initial;
  let writes = 0;
  return {
    getItem: () => raw,
    setItem: (key: string, value: string) => { expect(key).toBe(INICIO_SALUDO_STORAGE_KEY); raw = value; writes++; },
    get writes() { return writes; },
  };
}

describe("Saludo diario de Inicio por navegador", () => {
  test("las veinte parejas tienen títulos e identificadores distintos", () => {
    expect(SALUDOS_INICIO).toHaveLength(20);
    expect(new Set(SALUDOS_INICIO.map(item => item.id)).size).toBe(20);
    expect(new Set(SALUDOS_INICIO.map(item => item.title)).size).toBe(20);
  });
  test("cada ronda muestra todas las frases una vez y evita repetición entre rondas", () => {
    let state: InicioSaludoState | null = null;
    const seen: string[] = [];
    // Cubre también el caso extremo en que el barajado siempre toma el mismo índice.
    for (let index = 0; index < 80; index++) {
      state = selectInicioSaludo(day(index), state, () => 0);
      seen.push(state.current);
      if (index > 0) expect(seen[index]).not.toBe(seen[index - 1]);
    }
    for (let index = 0; index < seen.length; index += 20) {
      expect(new Set(seen.slice(index, index + 20))).toEqual(new Set(SALUDOS_INICIO.map(item => item.id)));
    }
  });
  test("al comenzar otra ronda evita elegir de nuevo la última frase, incluso si sale en el sorteo", () => {
    const previous: InicioSaludoState = {version:1,day:day(0),current:SALUDOS_INICIO[0].id,remaining:[]};
    const next = selectInicioSaludo(day(1), previous, () => 0);
    expect(next.current).not.toBe(previous.current);
    expect(new Set([next.current,...next.remaining]).size).toBe(20);
  });
  test("volver o recargar el mismo día no cambia ni consume otra frase", () => {
    const initial = selectInicioSaludo(day(0), null, () => 0.5);
    const same = selectInicioSaludo(day(0), initial, () => { throw new Error("No debe volver a sortear."); });
    expect(same).toBe(initial);
    expect(readInicioSaludoId(JSON.stringify(initial), day(0))).toBe(initial.current);
  });
  test("una pestaña con fecha anterior no hace retroceder la ronda", () => {
    const newer = selectInicioSaludo(day(1), null, () => 0);
    expect(selectInicioSaludo(day(0), newer)).toBe(newer);
    expect(readInicioSaludoId(JSON.stringify(newer), day(0))).toBe(newer.current);
  });
  test("los días sin visitas no consumen frases", () => {
    const initial = selectInicioSaludo(day(0), null, () => 0);
    const next = selectInicioSaludo(day(90), initial);
    expect(next.remaining).toHaveLength(18);
    expect(next.current).not.toBe(initial.current);
  });
  test("navegadores separados conservan sus propias rondas", () => {
    const first = fakeStorage(), second = fakeStorage();
    syncInicioSaludo(first, day(0), () => 0);
    syncInicioSaludo(second, day(0), () => 0.99);
    expect(first.getItem()).not.toBe(second.getItem());
    const previous = second.getItem();
    syncInicioSaludo(first, day(1));
    expect(second.getItem()).toBe(previous);
  });
  test("persiste una sola vez por día visitado y se recupera tras volver", () => {
    const storage = fakeStorage();
    const first = syncInicioSaludo(storage, day(0), () => 0);
    expect(syncInicioSaludo(storage, day(0))).toBe(first);
    expect(storage.writes).toBe(1);
    expect(readInicioSaludoId(storage.getItem(), day(0))).toBe(first);
    expect(syncInicioSaludo(storage, day(1))).not.toBe(first);
    expect(storage.writes).toBe(2);
  });
  test.each([null, "", "{roto", JSON.stringify({version:2}), "x".repeat(4097)])("recupera una preferencia ausente, dañada o incompatible: %s", raw => {
    expect(parseInicioSaludoState(raw)).toBeNull();
    const storage = fakeStorage(raw);
    const id = syncInicioSaludo(storage, day(0), () => 0);
    expect(SALUDOS_INICIO.some(item => item.id === id)).toBe(true);
    expect(parseInicioSaludoState(storage.getItem())).not.toBeNull();
  });
  test("rechaza fechas imposibles, identificadores desconocidos y bolsas con duplicados", () => {
    const state = selectInicioSaludo(day(0), null, () => 0);
    const invalid = [
      {...state,day:"2026-02-31"},
      {...state,current:"desconocido"},
      {...state,remaining:[state.current]},
      {...state,remaining:["desconocido"]},
      {...state,remaining:[state.remaining[0],state.remaining[0]]},
    ];
    for (const item of invalid) expect(parseInicioSaludoState(JSON.stringify(item))).toBeNull();
    expect(() => selectInicioSaludo("2026-02-31", null)).toThrow("Fecha del saludo inválida");
  });
  test("almacenamiento bloqueado o lleno mantiene un saludo legible sin lanzar errores", () => {
    const blocked = {getItem:()=>{throw new Error("Bloqueado");},setItem:()=>{}};
    const full = {getItem:()=>null,setItem:()=>{throw new Error("Lleno");}};
    expect(syncInicioSaludo(blocked, day(0))).toBe(INICIO_SALUDO_DEFAULT);
    expect(syncInicioSaludo(full, day(0))).toBe(INICIO_SALUDO_DEFAULT);
  });
  test("la fecha siguiente usa un saludo seguro mientras se actualiza la preferencia", () => {
    const previous = selectInicioSaludo(day(0), null, () => 0);
    expect(readInicioSaludoId(JSON.stringify(previous), day(1))).toBe(INICIO_SALUDO_DEFAULT);
  });

  test("el saludo no expone una frase provisional antes de recuperar la preferencia", () => {
    const storage = fakeStorage(JSON.stringify(selectInicioSaludo(day(0), null, () => 0.99)));
    const store = createInicioSaludoStore(day(0), () => storage, () => () => {});
    const snapshots: Array<string | null> = [];
    expect(store.getSnapshot()).toBeNull();
    const stop = store.subscribe(() => snapshots.push(store.getSnapshot()));
    expect(snapshots).toEqual([parseInicioSaludoState(storage.getItem())!.current]);
    expect(storage.writes).toBe(0);
    stop();
  });
  test("si el propio acceso a Storage falla, publica una sola vez el respaldo estable", () => {
    const store = createInicioSaludoStore(day(0), () => { throw new Error("Acceso bloqueado"); }, () => () => {});
    const snapshots: Array<string | null> = [];
    const stop = store.subscribe(() => snapshots.push(store.getSnapshot()));
    expect(snapshots).toEqual([INICIO_SALUDO_DEFAULT]);
    stop();
  });
  test("la actualización entre pestañas no vuelve a mostrar el estado de carga", () => {
    const storage = fakeStorage();
    let notify = () => {};
    let removed = false;
    const store = createInicioSaludoStore(day(0), () => storage, listener => { notify = listener; return () => { removed = true; }; });
    const stop = store.subscribe(() => {});
    const previous = store.getSnapshot();
    notify();
    expect(store.getSnapshot()).toBe(previous);
    const next = selectInicioSaludo(day(1), parseInicioSaludoState(storage.getItem()));
    storage.setItem(INICIO_SALUDO_STORAGE_KEY, JSON.stringify(next));
    notify();
    expect(store.getSnapshot()).toBe(next.current);
    expect(store.getSnapshot()).not.toBeNull();
    stop();
    expect(removed).toBe(true);
  });

  test("el servidor reserva el saludo y muestra la fecha sin una frase provisional", () => {
    const html = renderToStaticMarkup(createElement(InicioSaludo,{today:day(0)}));
    expect(html).toContain('aria-busy="true"');
    for (const saludo of SALUDOS_INICIO) expect(html).not.toContain(saludo.title);
    expect(html).toContain("17/10/2026");
  });
});
