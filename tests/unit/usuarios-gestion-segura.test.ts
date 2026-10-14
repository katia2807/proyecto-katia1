import { describe, expect, test, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
vi.mock("server-only", () => ({}));
import { manageOrganizationUser } from "@/lib/organization-user-management";

const org="00000000-0000-0000-0000-000000000001", actor="10000000-0000-4000-8000-000000000001", user="10000000-0000-4000-8000-000000000002";
const snapshot={full_name:"Anterior",role:"vendedor",ui_role:null,deactivated_at:null};

function fixture(mode: "missing" | "lost-finish" | "unknown-auth") {
  const requests: {path:string; method:string}[]=[];
  let metadata="Anterior", status="pendiente", finishes=0;
  const response=(body:unknown,code=200)=>new Response(JSON.stringify(body),{status:code,headers:{"content-type":"application/json"}});
  const fetcher:typeof fetch=async(input,init)=>{
    const path=new URL(String(input)).pathname,method=init?.method??"GET";requests.push({path,method});
    if(path.endsWith('/rpc/iniciar_gestion_usuario_segura')) {
      if(mode==='missing')return response({code:'PGRST202',message:'Falta la función'},404);
      return response({id:'ticket',estado:status,error:null,anterior:snapshot,actual:{...snapshot,full_name:'Nuevo'}});
    }
    if(path.endsWith('/auth/v1/admin/users/'+user)) {
      if(method==='GET')return mode==='unknown-auth'&&metadata==='Nuevo'
        ? response({message:'Lectura no disponible'},400)
        : response({user:{id:user,user_metadata:{full_name:metadata},banned_until:null}});
      if(method==='PUT') {metadata='Nuevo';return mode==='unknown-auth'?response({message:'Respuesta perdida'},400):response({user:{id:user,user_metadata:{full_name:metadata}}});}
    }
    if(path.endsWith('/rpc/finalizar_gestion_usuario_segura')) {
      finishes++;status='confirmada';
      if(finishes===1&&mode==='lost-finish')return response({message:'Respuesta perdida'},503);
      return response({id:'ticket',estado:status,error:null});
    }
    throw Error('Petición inesperada en la prueba: '+method+' '+path);
  };
  return {requests,client:createClient('https://fixture.supabase.co','fake',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:fetcher}}),state:()=>({metadata,status,finishes})};
}

describe('Gestión segura de Usuarios ante fallos de comunicación',()=>{
  test('sin migración no modifica Auth ni usa el guardado antiguo',async()=>{
    const f=fixture('missing');
    const r=await manageOrganizationUser(f.client,{organizationId:org,userId:actor},{type:'perfil',userId:user,data:{full_name:'Nuevo',role:'conservar'}});
    expect(r).toMatchObject({ok:false,error:expect.stringContaining('No se hicieron cambios')});
    expect(f.requests.some(r=>r.path.includes('/auth/')||r.path.endsWith('/perfiles'))).toBe(false);
  });
  test('respuesta de confirmación perdida no repite la actualización de Auth',async()=>{
    const f=fixture('lost-finish');
    expect(await manageOrganizationUser(f.client,{organizationId:org,userId:actor},{type:'perfil',userId:user,data:{full_name:'Nuevo',role:'conservar'}})).toEqual({ok:true});
    expect(f.requests.filter(r=>r.path.includes('/auth/')&&r.method==='PUT')).toHaveLength(1);
    expect(f.state()).toMatchObject({metadata:'Nuevo',status:'confirmada'});
  });
  test('resultado Auth imposible de comprobar conserva la reserva y nunca borra una cuenta',async()=>{
    const f=fixture('unknown-auth');
    expect(await manageOrganizationUser(f.client,{organizationId:org,userId:actor},{type:'perfil',userId:user,data:{full_name:'Nuevo',role:'conservar'}})).toMatchObject({ok:false,error:expect.stringContaining('pendiente de revisión')});
    expect(f.state().status).toBe('pendiente');
    expect(f.requests.some(r=>r.method==='DELETE'||r.path.endsWith('/rpc/finalizar_gestion_usuario_segura'))).toBe(false);
  });
});
