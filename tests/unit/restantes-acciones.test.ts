import {beforeEach,describe,expect,test,vi} from "vitest";
import {createClient} from "@supabase/supabase-js";
const mocks=vi.hoisted(()=>({auth:vi.fn(),authClient:vi.fn(),updateAccount:vi.fn(),client:vi.fn(),revalidate:vi.fn()}));
vi.mock("server-only",()=>({}));vi.mock("@/lib/auth",()=>({requireAuthContext:mocks.auth,getSupabaseAuthServerClient:mocks.authClient}));
vi.mock("@/lib/runtime",()=>({hasSupabaseEnv:()=>true}));vi.mock("@/lib/supabase/server",()=>({getSupabaseServerClient:mocks.client}));
vi.mock("next/cache",()=>({revalidatePath:mocks.revalidate}));
import {updateOrganizationUser,setOrganizationUserActive,createOrganizationUser} from "@/app/(dashboard)/admin/usuarios/actions";
import {updateEmpresaConfig,clearEmpresaLogo} from "@/app/(dashboard)/admin/empresa/actions";
import {getEmpresaConfig} from "@/lib/company-config";
import {updateAccountSettings} from "@/app/(dashboard)/cuenta/actions";
import {updateMargenGananciaPredeterminado,updateServicioEspecialTarifa,submitMargenGananciaPredeterminado,submitServicioEspecialTarifa} from "@/app/actions";
const org="00000000-0000-0000-0000-000000000001",other="00000000-0000-0000-0000-000000000002",user="10000000-0000-4000-8000-000000000058";
let requests:{url:URL;method:string;body:Record<string,unknown>}[],profile:Record<string,unknown>,mode:string;
const fixtureFetch:typeof fetch=async(input,init)=>{
 const url=new URL(String(input)),method=init?.method??"GET",body=typeof init?.body==="string"?JSON.parse(init.body):{};requests.push({url,method,body});
 const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json"}});
 if(url.pathname.includes('/auth/v1/admin/users/')){if(mode==='concurrent-ui'){profile.ui_role='readonly';return json({message:'fallo aislado'},400);}return mode==='auth-fail'?json({message:'fallo aislado'},400):json({user:{id:user}});}
 if(url.pathname.endsWith('/perfiles')){
  if(url.searchParams.get('organization_id')!==`eq.${profile.organization_id}`)return json(null);
  if(method==='GET')return json(url.searchParams.has('user_id')?profile:[profile]);
  if(method==='PATCH'){if(mode==='zero-update')return json(null);for(const key of ['role','ui_role','full_name']){const predicate=url.searchParams.get(key);if(predicate?.startsWith('eq.')&&String(profile[key])!==predicate.slice(3))return json(null);if(predicate==='is.null'&&profile[key]!=null)return json(null);}profile={...profile,...body};return json({id:profile.id});}
 }
 if(url.pathname.endsWith('/configuracion_empresa')){
  if(method==='GET')return mode==='company-read-fail'?json({message:'fallo aislado'},400):json({logo_url:'https://fixture.supabase.co/storage/v1/object/public/empresa-logos/'+org+'/old.png',margen_ganancia_default_pct:45});
  if(method==='POST')return json({organization_id:org},201);
  if(method==='PATCH')return mode==='company-write-fail'?json({message:'fallo aislado'},400):json(mode==='zero-update'?null:{organization_id:org});
 }
 if(url.pathname.endsWith('/servicios_especiales_tarifa')&&method==='PATCH')return json(mode==='zero-update'?null:{id:user});
 if(url.pathname.includes('/storage/'))return json([]);
 throw Error('Petición inesperada '+url.pathname+' '+method);
};
beforeEach(()=>{requests=[];mode='normal';profile={id:'perfil',user_id:user,organization_id:org,full_name:'Original',role:'ventas',ui_role:'operaciones',deactivated_at:null};mocks.auth.mockResolvedValue({organizationId:org,userId:'owner',role:'owner_admin',uiRole:'owner_admin',fullName:'Dueña'});mocks.client.mockReturnValue(createClient('https://fixture.supabase.co','test',{auth:{persistSession:false},global:{fetch:fixtureFetch}}));});
describe('Usuarios aislados',()=>{
 test('usuario ajeno no llega a Auth ni recibe cambios',async()=>{profile.organization_id=other;expect((await updateOrganizationUser({userId:user,fullName:'Cambio',role:'conservar'})).ok).toBe(false);expect(requests.every(r=>r.method==='GET')).toBe(true);});
 test('editar nombre mantiene rol histórico y UI',async()=>{expect((await updateOrganizationUser({userId:user,fullName:'Cambio',role:'conservar'})).ok).toBe(true);expect(profile).toMatchObject({full_name:'Cambio',role:'ventas',ui_role:'operaciones'});});
 test('fallo de Auth restaura permisos y nombre',async()=>{mode='auth-fail';const result=await updateOrganizationUser({userId:user,fullName:'Cambio',role:'vendedor'});expect(result.ok).toBe(false);expect(profile).toMatchObject({full_name:'Original',role:'ventas',ui_role:'operaciones'});});
 test('un fallo de Auth no revierte un permiso cambiado simultáneamente en otra sesión',async()=>{mode='concurrent-ui';const result=await updateOrganizationUser({userId:user,fullName:'Cambio',role:'conservar'});expect(result).toMatchObject({ok:false,error:expect.stringContaining('Revisa el usuario')});expect(profile.ui_role).toBe('readonly');});
 test('perfil inexistente en actualización no cambia acceso global',async()=>{mode='zero-update';expect((await setOrganizationUserActive({userId:user,active:false})).ok).toBe(false);expect(requests.some(r=>r.url.pathname.includes('/auth/'))).toBe(false);});
 test('fallo de bloqueo recupera estado activo',async()=>{mode='auth-fail';expect((await setOrganizationUserActive({userId:user,active:false})).ok).toBe(false);expect(profile.deactivated_at).toBeNull();});
 test('rol inválido no envía una invitación',async()=>{expect((await createOrganizationUser({email:'test@example.com',fullName:'Prueba',role:'invalido' as 'vendedor'})).ok).toBe(false);expect(requests).toHaveLength(0);});
});
describe('Empresa aislada',()=>{
 test('fallo de lectura no devuelve empresa de muestra',async()=>{mode='company-read-fail';await expect(getEmpresaConfig(org)).rejects.toThrow();});
 test('fallo previo no sobrescribe logo ni margen',async()=>{mode='company-read-fail';const fd=new FormData();Object.entries({nombre:'Empresa',ruc:'12345678901',telefono:'999999999',direccion:'Dirección',firmante:'Prueba',firmante_cargo:'Gerente'}).forEach(([k,v])=>fd.set(k,v));expect((await updateEmpresaConfig({},fd)).error).toBeTruthy();expect(requests.every(r=>r.method==='GET')).toBe(true);});
 test('editar datos generales no reenvía logo ni margen de una lectura anterior',async()=>{const fd=new FormData();Object.entries({nombre:'Empresa',ruc:'12345678901',telefono:'999999999',direccion:'Dirección',firmante:'Prueba',firmante_cargo:'Gerente'}).forEach(([k,v])=>fd.set(k,v));expect((await updateEmpresaConfig({},fd)).success).toBeTruthy();const body=requests.find(r=>r.method==='POST')!.body;expect(body.logo_url).toBeUndefined();expect(body.margen_ganancia_default_pct).toBeUndefined();});
 test('fallo de persistencia conserva el archivo del logo',async()=>{mode='company-write-fail';expect((await clearEmpresaLogo()).error).toBeTruthy();expect(requests.some(r=>r.url.pathname.includes('/storage/'))).toBe(false);});
 test('margen cambia solo su campo dentro de la empresa actual',async()=>{expect(await updateMargenGananciaPredeterminado(32)).toMatchObject({ok:true,margenGananciaDefaultPct:32});expect(requests).toHaveLength(1);expect(requests[0].method).toBe('PATCH');expect(requests[0].url.searchParams.get('organization_id')).toBe(`eq.${org}`);expect(Object.keys(requests[0].body).sort()).toEqual(['margen_ganancia_default_pct','updated_at']);});
 test('empresa inexistente no recibe confirmación falsa de margen',async()=>{mode='zero-update';await expect(updateMargenGananciaPredeterminado(32)).rejects.toThrow('No se pudo guardar');});
 test('tarifa ajena o inexistente no recibe confirmación falsa',async()=>{mode='zero-update';await expect(updateServicioEspecialTarifa(user,'Servicio',4)).rejects.toThrow('No se pudo confirmar');expect(requests[0].url.searchParams.get('organization_id')).toBe(`eq.${org}`);});
 test('errores de tarifas y margen llegan al navegador como mensajes legibles',async()=>{mode='zero-update';expect(await submitServicioEspecialTarifa(user,'Servicio',4)).toMatchObject({ok:false,error:expect.stringContaining('No se pudo confirmar')});expect(await submitMargenGananciaPredeterminado(32)).toMatchObject({ok:false,error:expect.stringContaining('No se pudo guardar')});});
});
describe('Cuenta aislada',()=>{
 const form=()=>{const fd=new FormData();Object.entries({email:'nuevo@example.com',fullName:'Nombre nuevo',currentPassword:'clave-ficticia-anterior',newPassword:'clave-ficticia-nueva',confirmPassword:'clave-ficticia-nueva'}).forEach(([k,v])=>fd.set(k,v));return fd;};
 beforeEach(()=>{mocks.updateAccount.mockReset().mockResolvedValue({error:null});mocks.authClient.mockResolvedValue({auth:{getUser:vi.fn().mockResolvedValue({data:{user:{email:'anterior@example.com'}},error:null}),signInWithPassword:vi.fn().mockResolvedValue({error:null}),updateUser:mocks.updateAccount}});});
 test('cambia nombre, correo y contraseña en una sola operación Auth',async()=>{expect((await updateAccountSettings({},form())).success).toBeTruthy();expect(mocks.updateAccount).toHaveBeenCalledTimes(1);expect(mocks.updateAccount).toHaveBeenCalledWith({email:'nuevo@example.com',password:'clave-ficticia-nueva',data:{full_name:'Nombre nuevo'}});expect(requests.every(r=>r.url.searchParams.get('organization_id')===`eq.${org}`)).toBe(true);});
 test('fallo Auth conserva el perfil; nunca lo anuncia como éxito',async()=>{mocks.updateAccount.mockResolvedValue({error:{message:'fallo aislado'}});expect((await updateAccountSettings({},form())).error).toContain('no se modificó');expect(requests).toHaveLength(0);});
 test('perfil fallido informa expresamente el cambio parcial de acceso',async()=>{mode='zero-update';expect((await updateAccountSettings({},form())).error).toContain('cuenta de acceso se actualizó');expect(mocks.updateAccount).toHaveBeenCalledTimes(1);});
 test('contraseña corta se rechaza antes de actualizar',async()=>{const fd=form();fd.set('newPassword','1234567');fd.set('confirmPassword','1234567');expect((await updateAccountSettings({},fd)).error).toContain('8');expect(mocks.updateAccount).not.toHaveBeenCalled();});
});
