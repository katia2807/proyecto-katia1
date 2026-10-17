/** Preferencia visual por navegador; no contiene datos de usuarios ni del negocio. */
export const INICIO_SALUDO_STORAGE_KEY = "katia_inicio_saludo_v1";

export const SALUDOS_INICIO = [
  { id: "asi-va", title: "Hola, ¿qué revisamos hoy?", subtitle: "Mira tus pendientes y elige por dónde empezar." },
  { id: "lo-importante", title: "¿Por dónde quieres empezar?", subtitle: "Elige qué revisar primero y continúa a tu ritmo." },
  { id: "organizar", title: "¿Seguimos con tus pendientes?", subtitle: "Revisa qué necesita atención y decide con qué continuar." },
  { id: "por-donde", title: "Hola, vamos paso a paso", subtitle: "Empieza por lo que te resulte más importante." },
  { id: "a-la-vista", title: "¿Qué necesitas hacer ahora?", subtitle: "Elige uno de tus apartados habituales para continuar." },
  { id: "antes-de-seguir", title: "¿Le damos un vistazo al negocio?", subtitle: "Mira el resumen y decide cuál será tu próximo paso." },
  { id: "paso-a-paso", title: "¿Revisamos antes de continuar?", subtitle: "Consulta lo pendiente y sigue con tu jornada." },
  { id: "resumen-hoy", title: "¿Qué quieres atender primero?", subtitle: "Revisa las prioridades y elige con cuál empezar." },
  { id: "siguiente-paso", title: "¿Continuamos con tu jornada?", subtitle: "Tienes el resumen aquí para decidir qué sigue." },
  { id: "que-atendemos", title: "Tú decides por dónde seguimos", subtitle: "Revisa lo importante y abre el detalle cuando lo necesites." },
  { id: "a-mano", title: "Hola, tienes el resumen aquí", subtitle: "Consulta lo que necesites para seguir trabajando." },
  { id: "un-momento", title: "¿Vemos cómo va tu negocio?", subtitle: "Mira tus datos y elige qué quieres revisar." },
  { id: "vistazo-seguimos", title: "¿Qué te toca revisar hoy?", subtitle: "Empieza por tus pendientes o entra al apartado que necesites." },
  { id: "como-vamos", title: "Vamos a organizar tu día", subtitle: "Elige qué revisar primero y avanza paso a paso." },
  { id: "para-decidir", title: "¿Hacemos una revisión rápida?", subtitle: "Mira lo importante antes de continuar con tu trabajo." },
  { id: "por-aqui", title: "¿Buscas algo en particular?", subtitle: "Elige el apartado que necesites y consulta su detalle." },
  { id: "poner-en-orden", title: "¿Damos el siguiente paso?", subtitle: "Revisa lo pendiente y decide con qué seguir." },
  { id: "por-donde-seguimos", title: "Hola, ¿por dónde seguimos?", subtitle: "Consulta el resumen y continúa con lo que necesites." },
  { id: "primero-el-resumen", title: "¿Revisamos lo más importante?", subtitle: "Mira tus prioridades y elige cuál atender primero." },
  { id: "con-calma", title: "Vamos a verlo con calma", subtitle: "Consulta el resumen y entra al detalle cuando te haga falta." },
] as const;

export type InicioSaludoId = typeof SALUDOS_INICIO[number]["id"];
export type InicioSaludoState = {
  version: 1;
  day: string;
  current: InicioSaludoId;
  remaining: InicioSaludoId[];
};
export const INICIO_SALUDO_DEFAULT = SALUDOS_INICIO[0].id;
const ids = SALUDOS_INICIO.map(saludo => saludo.id);
const knownIds = new Set<string>(ids);

function validDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(value + "T12:00:00Z");
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

export function parseInicioSaludoState(raw: string | null): InicioSaludoState | null {
  if (!raw || raw.length > 4096) return null;
  try {
    const state: unknown = JSON.parse(raw);
    if (!state || typeof state !== "object") return null;
    const value = state as Record<string, unknown>;
    if (value.version !== 1 || !validDay(value.day) || typeof value.current !== "string" || !knownIds.has(value.current)) return null;
    if (!Array.isArray(value.remaining) || value.remaining.length >= ids.length) return null;
    if (!value.remaining.every(id => typeof id === "string" && knownIds.has(id) && id !== value.current)) return null;
    if (new Set(value.remaining).size !== value.remaining.length) return null;
    return value as InicioSaludoState;
  } catch {
    return null;
  }
}

/** Una extracción por día visitado. No consume frases por días sin abrir Inicio. */
export function selectInicioSaludo(day: string, previous: InicioSaludoState | null, random = Math.random): InicioSaludoState {
  if (!validDay(day)) throw new Error("Fecha del saludo inválida.");
  // Otra pestaña más antigua no debe hacer retroceder la ronda.
  if (previous && previous.day >= day) return previous;
  let remaining = previous?.remaining.slice() ?? [];
  if (remaining.length === 0) {
    remaining = [...ids];
    for (let index = remaining.length - 1; index > 0; index--) {
      const next = Math.floor(random() * (index + 1));
      [remaining[index], remaining[next]] = [remaining[next], remaining[index]];
    }
    const last = remaining.length - 1;
    if (remaining[last] === previous?.current) {
      [remaining[0], remaining[last]] = [remaining[last], remaining[0]];
    }
  }
  const current = remaining.pop()!;
  return { version: 1, day, current, remaining };
}

type SaludoStorage = Pick<Storage, "getItem" | "setItem">;

/** Si el navegador bloquea el almacenamiento, Inicio mantiene un saludo fijo. */
export function syncInicioSaludo(storage: SaludoStorage, day: string, random = Math.random): InicioSaludoId {
  try {
    const previous = parseInicioSaludoState(storage.getItem(INICIO_SALUDO_STORAGE_KEY));
    const next = selectInicioSaludo(day, previous, random);
    if (next !== previous) storage.setItem(INICIO_SALUDO_STORAGE_KEY, JSON.stringify(next));
    return next.current;
  } catch {
    return INICIO_SALUDO_DEFAULT;
  }
}

export function readInicioSaludoId(raw: string | null, day: string): InicioSaludoId {
  const state = parseInicioSaludoState(raw);
  return state && state.day >= day ? state.current : INICIO_SALUDO_DEFAULT;
}

/** Publica únicamente la elección definitiva después de conectar el navegador. */
export function createInicioSaludoStore(
  day: string,
  getStorage: () => SaludoStorage,
  subscribeStorage: (onChange: () => void) => () => void,
) {
  let snapshot: InicioSaludoId | null = null;
  const listeners = new Set<() => void>();
  let unsubscribe: (() => void) | null = null;
  const sync = () => {
    let next: InicioSaludoId = INICIO_SALUDO_DEFAULT;
    try { next = syncInicioSaludo(getStorage(), day); } catch { /* Respaldo estable si se bloquea Storage. */ }
    if (next === snapshot) return;
    snapshot = next;
    listeners.forEach(listener => listener());
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      if (listeners.size === 1) {
        try { unsubscribe = subscribeStorage(sync); } catch { /* Sin sincronización entre pestañas. */ }
        sync();
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) { unsubscribe?.(); unsubscribe = null; }
      };
    },
  };
}
