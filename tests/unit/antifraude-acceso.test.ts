import { beforeEach, expect, test, vi } from 'vitest';
import { ANTIFRAUDE_COOKIE, crearAccesoAntifraude, verificarAccesoAntifraude } from '@/lib/antifraude-acceso';
const mocks=vi.hoisted(()=>({auth:vi.fn(),set:vi.fn(),del:vi.fn()}));
vi.mock('@/lib/auth',()=>({requireAuthContext:mocks.auth}));
vi.mock('next/headers',()=>({cookies:async()=>({set:mocks.set,delete:mocks.del})}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
import { requestAntifraudeAccess, revokeAntifraudeAccess } from '@/app/(dashboard)/reportes/antifraude/actions';
const contexto={userId:'usuario-ficticio',organizationId:'empresa-ficticia'},secreto='solo-pruebas-locales',ahora=1791748800000;
beforeEach(()=>{vi.clearAllMocks();vi.unstubAllEnvs();mocks.auth.mockResolvedValue(contexto);});
test('rechaza el marcador antiguo escrito directamente desde el navegador',()=>{
 expect(verificarAccesoAntifraude('granted',contexto,secreto,ahora)).toBe(false);
});
test('el acceso válido pertenece a una cuenta y empresa y dura cuatro horas',()=>{
 const token=crearAccesoAntifraude(contexto,secreto,ahora);
 expect(verificarAccesoAntifraude(token,contexto,secreto,ahora)).toBe(true);
 expect(verificarAccesoAntifraude(token,{...contexto,userId:'otro'},secreto,ahora)).toBe(false);
 expect(verificarAccesoAntifraude(token,{...contexto,organizationId:'otra'},secreto,ahora)).toBe(false);
 expect(verificarAccesoAntifraude(token,contexto,secreto,ahora+4*60*60*1000)).toBe(false);
});
test('alterar el vencimiento, la firma o el código de acceso invalida la autorización',()=>{
 const token=crearAccesoAntifraude(contexto,secreto,ahora),[contenido,firma]=token.split('.');
 const datos=JSON.parse(Buffer.from(contenido,'base64url').toString());datos.vence+=3600;
 expect(verificarAccesoAntifraude(Buffer.from(JSON.stringify(datos)).toString('base64url')+'.'+firma,contexto,secreto,ahora)).toBe(false);
 expect(verificarAccesoAntifraude(token+'x',contexto,secreto,ahora)).toBe(false);
 expect(verificarAccesoAntifraude(token,contexto,'otro-codigo',ahora)).toBe(false);
 expect(verificarAccesoAntifraude(token,contexto,'',ahora)).toBe(false);
});
test('solo el código correcto crea la cookie firmada; revocar la elimina',async()=>{
 vi.stubEnv('ANTIFRAUD_ACCESS_CODE',secreto);const f=new FormData();f.set('access_code',secreto);
 await requestAntifraudeAccess(f);
 const [nombre,valor,opciones]=mocks.set.mock.calls[0];expect(nombre).toBe(ANTIFRAUDE_COOKIE);
 expect(verificarAccesoAntifraude(valor,contexto)).toBe(true);expect(opciones).toMatchObject({httpOnly:true,maxAge:14400});
 await revokeAntifraudeAccess();expect(mocks.del).toHaveBeenCalledWith(ANTIFRAUDE_COOKIE);
});
test('código inválido, ausente o permiso rechazado nunca concede acceso',async()=>{
 vi.stubEnv('ANTIFRAUD_ACCESS_CODE',secreto);const f=new FormData();f.set('access_code','incorrecto');
 await expect(requestAntifraudeAccess(f)).rejects.toThrow('inválido');expect(mocks.set).not.toHaveBeenCalled();
 vi.stubEnv('ANTIFRAUD_ACCESS_CODE','');await expect(requestAntifraudeAccess(f)).rejects.toThrow('configurado');
 mocks.auth.mockRejectedValue(new Error('Acceso denegado'));await expect(requestAntifraudeAccess(f)).rejects.toThrow('denegado');
 expect(mocks.set).not.toHaveBeenCalled();
});
