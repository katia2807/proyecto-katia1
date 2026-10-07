import {beforeEach,describe,expect,test,vi} from "vitest";
import {createClient} from "@supabase/supabase-js";
import ExcelJS from "exceljs";
const mocks=vi.hoisted(()=>({context:vi.fn(),client:vi.fn()}));
vi.mock("server-only",()=>({}));vi.mock("@/lib/auth",()=>({getAuthContext:mocks.context}));
vi.mock("@/lib/runtime",()=>({hasSupabaseEnv:()=>true}));vi.mock("@/lib/supabase/server",()=>({getSupabaseServerClient:mocks.client}));vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import {GET as reportsExcel} from "@/app/api/export/reportes-excel/route";
import {GET as backupExcel} from "@/app/(dashboard)/admin/respaldo/export/route";
import {POST as importExcel} from "@/app/(dashboard)/admin/respaldo/import/route";
import {readCompleteTable} from "@/lib/complete-data";
import {canAccessPath} from "@/lib/permissions";
const org="00000000-0000-0000-0000-000000000058";
let requests:{url:URL;method:string;body:Record<string,unknown>}[],tables:Record<string,Record<string,unknown>[]>,mode:string;
const fixtureFetch:typeof fetch=async(input,init)=>{
 const url=new URL(String(input)),method=init?.method??"GET",body=typeof init?.body==="string"?JSON.parse(init.body):{};requests.push({url,method,body});
 const table=url.pathname.split('/').at(-1)!;const offset=Number(url.searchParams.get('offset')??0),limit=Number(url.searchParams.get('limit')??1000);
 const json=(data:unknown,status=200,headers:Record<string,string>={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json',...headers}});
 if(mode==='fail-existing'&&table==='clientes')return json({message:'fallo aislado'},400);
 if(mode==='fail-page'&&table==='movimientos_caja'&&offset>0)return json({message:'fallo aislado'},400);
 if(table==='configuracion_empresa')return json(null);
 if(url.pathname.includes('/rpc/importar_producto_inventario'))return json('updated');
 if(method!=='GET')throw Error('Escritura inesperada '+url.pathname);
 let rows=[...(tables[table]??[])];for(const [key,value]of url.searchParams){if(value.startsWith('eq.'))rows=rows.filter(row=>String(row[key])===value.slice(3));if(value==='is.null')rows=rows.filter(row=>row[key]==null);}
 rows.sort((a,b)=>String(a.id).localeCompare(String(b.id)));return json(rows.slice(offset,offset+limit),200,{'content-range':`${offset}-${Math.min(offset+limit,rows.length)-1}/${rows.length}`});
};
beforeEach(()=>{tables={};requests=[];mode='normal';mocks.context.mockResolvedValue({userId:'usuario',organizationId:org,role:'owner_admin',uiRole:null});mocks.client.mockReturnValue(createClient('https://fixture.supabase.co','test',{auth:{persistSession:false},global:{fetch:fixtureFetch}}));});
const fileRequest=async(headers:string[],row:unknown[])=>{const wb=new ExcelJS.Workbook();wb.addWorksheet('Inventario').addRows([headers,row]);const fd=new FormData();fd.set('archivo',new File([await wb.xlsx.writeBuffer() as ArrayBuffer],'aislado.xlsx'));return new Request('http://localhost/admin/respaldo/import',{method:'POST',body:fd});};
describe('Permisos antes de consultar/escribir',()=>{
 test.each([reportsExcel,()=>backupExcel()])('sin sesión devuelve 401 sin consultas',async run=>{mocks.context.mockResolvedValue(null);expect((await run()).status).toBe(401);expect(requests).toHaveLength(0);});
 test.each(['readonly',null])('rol de lectura %s no importa aunque el rol antiguo sea propietario',async uiRole=>{mocks.context.mockResolvedValue({organizationId:org,userId:'usuario',role:uiRole?'owner_admin':'vendedor',uiRole});expect((await importExcel(await fileRequest(['Producto','Stock'],['Tabla',4]))).status).toBe(403);expect(requests).toHaveLength(0);});
 test('UI Operaciones conserva el permiso para exportar',async()=>{mocks.context.mockResolvedValue({organizationId:org,userId:'usuario',role:'ventas',uiRole:'operaciones'});expect((await reportsExcel()).status).toBe(200);expect(requests.every(r=>r.url.searchParams.get('organization_id')===`eq.${org}`)).toBe(true);});
 test('prototipos ocultos bloqueados incluso para dueña',()=>{expect(canAccessPath('owner_admin',null,'/seguridad')).toBe(false);expect(canAccessPath('owner_admin',null,'/admin/importar')).toBe(false);expect(canAccessPath('owner_admin',null,'/ventas/zonas-entrega')).toBe(false);});
});
describe('Lectura/exportación completas',()=>{
 test('Excel tiene 1201 movimientos y más de 100 registros generales',async()=>{
  tables.movimientos_caja=Array.from({length:1201},(_,i)=>({id:String(i).padStart(5,'0'),organization_id:org,fecha:'2026-10-06',tipo:'ingreso',monto:1,es_personal:false,medio:'efectivo'}));
  tables.registros_generales=Array.from({length:120},(_,i)=>({id:String(i),organization_id:org}));expect(await readCompleteTable('registros_generales',org)).toHaveLength(120);
  const response=await reportsExcel();expect(response.status).toBe(200);const wb=new ExcelJS.Workbook();await wb.xlsx.load(await response.arrayBuffer());expect(wb.getWorksheet('Caja')!.rowCount).toBe(1202);
 });
 test('página fallida devuelve error, nunca Excel parcial',async()=>{tables.movimientos_caja=Array.from({length:601},(_,i)=>({id:String(i).padStart(5,'0'),organization_id:org}));mode='fail-page';const response=await reportsExcel();expect(response.status).toBe(503);expect(response.headers.get('content-type')).toContain('application/json');});
 test('reimportar el Excel mantiene costo registrado separado del promedio de compras',async()=>{
  tables.inventario_productos=[{id:'producto',organization_id:org,codigo:'TAB-01',nombre:'Tabla',categoria:'Madera',unidad:'unidad',stock_actual:4,stock_minimo:1,costo_unitario:5,activo:true}];
  tables.inventario_movimientos=[{id:'entrada',organization_id:org,producto_id:'producto',tipo:'entrada_compra',cantidad:4,costo_unitario:7,fecha:'2026-10-06'}];
  const response=await backupExcel();expect(response.status).toBe(200);const wb=new ExcelJS.Workbook();await wb.xlsx.load(await response.arrayBuffer());const ws=wb.worksheets.find(sheet=>sheet.name.includes('Inventario'))!;
  const headers=Array.from({length:ws.columnCount},(_,i)=>String(ws.getRow(4).getCell(i+1).value));const values=Array.from({length:ws.columnCount},(_,i)=>ws.getRow(5).getCell(i+1).value);
  expect(values[headers.indexOf('Costo registrado')]).toBe(5);expect(values[headers.indexOf('Valor según compras')]).toBe(28);
  expect((await importExcel(await fileRequest(headers,values))).status).toBe(200);const rpc=requests.find(r=>r.url.pathname.includes('/rpc/'))!;expect(rpc.body.p_producto).toMatchObject({codigo:'TAB-01',stock_actual:4,costo_unitario:5});
 });
});
describe('Importación XLSX aislada',()=>{
 test('Precio no sustituye costo; nombre sin código se identifica correctamente',async()=>{
  const response=await importExcel(await fileRequest(['Producto','Stock','Precio'],['Tabla',4,999]));expect(response.status).toBe(200);
  const rpc=requests.find(r=>r.url.pathname.includes('/rpc/'))!;expect(rpc.body).toMatchObject({p_organization_id:org,p_por_nombre:true,p_producto:{stock_actual:4,costo_unitario:null}});
  expect(await response.json()).toMatchObject({results:[{inserted:0,updated:1}]});
 });
 test('fallo de lectura de existentes cancela antes de importar',async()=>{mode='fail-existing';expect((await importExcel(await fileRequest(['Producto','Stock'],['Tabla',4]))).status).toBe(503);expect(requests.every(r=>r.method==='GET')).toBe(true);});
 test('archivo sin encabezados no adivina valores ni escribe',async()=>{const response=await importExcel(await fileRequest(['Tabla','40','999'],['Otra tabla',20,600]));expect(requests.every(r=>r.method==='GET')).toBe(true);expect(await response.json()).toMatchObject({results:[{inserted:0,errors:[expect.any(String)]}]});});
});
