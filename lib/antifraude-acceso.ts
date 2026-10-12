import { createHmac, timingSafeEqual } from 'node:crypto';

export const ANTIFRAUDE_COOKIE = 'antifraud_access';
export const ANTIFRAUDE_DURACION = 4 * 60 * 60;
type Identidad = { userId: string; organizationId: string };
const firma = (contenido: string, secreto: string) => createHmac('sha256', secreto).update(contenido).digest('base64url');

/** El código existente firma una autorización breve y vinculada a la cuenta y empresa actuales. */
export function crearAccesoAntifraude(contexto: Identidad, secreto = process.env.ANTIFRAUD_ACCESS_CODE?.trim(), ahora = Date.now()) {
  if (!secreto) throw new Error('El acceso con código todavía no está configurado.');
  const contenido = Buffer.from(JSON.stringify({ version: 1, usuario: contexto.userId, empresa: contexto.organizationId,
    vence: Math.floor(ahora / 1000) + ANTIFRAUDE_DURACION })).toString('base64url');
  return `${contenido}.${firma(contenido, secreto)}`;
}

export function verificarAccesoAntifraude(token: string | undefined, contexto: Identidad,
  secreto = process.env.ANTIFRAUD_ACCESS_CODE?.trim(), ahora = Date.now()): boolean {
  if (!secreto || !token || token.length > 2048) return false;
  try {
    const partes = token.split('.');
    if (partes.length !== 2) return false;
    const [contenido, recibido] = partes;
    const esperado = Buffer.from(firma(contenido, secreto)), actual = Buffer.from(recibido);
    if (actual.length !== esperado.length || !timingSafeEqual(actual, esperado)) return false;
    const datos = JSON.parse(Buffer.from(contenido, 'base64url').toString('utf8'));
    const tiempo = Math.floor(ahora / 1000);
    return datos.version === 1 && datos.usuario === contexto.userId && datos.empresa === contexto.organizationId
      && Number.isSafeInteger(datos.vence) && datos.vence > tiempo && datos.vence <= tiempo + ANTIFRAUDE_DURACION;
  } catch { return false; }
}
