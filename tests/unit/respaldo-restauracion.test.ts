import {beforeEach,describe,expect,test,vi} from "vitest";
const mocks=vi.hoisted(()=>({write:vi.fn(),read:vi.fn(()=>null)}));
vi.mock("@/lib/store-persistence",()=>({readStoreFromDisk:mocks.read,writeStoreToDisk:mocks.write}));
vi.mock("@/lib/demo-mode",()=>({isDemoDatabaseMode:()=>true}));
import {demoExportStore,demoImportStore,demoCreateSueldo} from "@/lib/demo-store";
import {monthlyCashRows} from "@/lib/reportes-model";
demoImportStore(JSON.stringify(demoExportStore()));
const baseline=demoExportStore();
describe("Restauración aislada",()=>{
 beforeEach(()=>{mocks.write.mockReset();demoImportStore(JSON.stringify(baseline));mocks.write.mockClear();});
 test.each(["{}","[]","null",JSON.stringify({inventarioProductos:baseline.inventarioProductos})])("rechaza %s sin cambiar memoria ni disco",raw=>{
  const before=demoExportStore();expect(()=>demoImportStore(raw)).toThrow();expect(demoExportStore()).toEqual(before);expect(mocks.write).not.toHaveBeenCalled();
 });
 test("exportar/restaurar conserva todos los datos y cuenta todas las tablas",()=>{
  const result=demoImportStore(JSON.stringify(baseline));expect(demoExportStore()).toEqual(baseline);
  expect(result.creados).toBe(Object.values(baseline).filter(Array.isArray).reduce((sum,rows)=>sum+rows.length,0));expect(mocks.write).toHaveBeenCalledWith(baseline,{strict:true});
 });
 test("inventario solo en un respaldo completo no añade datos de muestra",()=>{
  const inventory=Object.fromEntries(Object.entries(baseline).map(([key,value])=>[key,key==="inventarioProductos"?value:Array.isArray(value)?[]:{}]));
  expect(demoImportStore(JSON.stringify(inventory)).creados).toBe(baseline.inventarioProductos.length);expect(demoExportStore().clientes).toEqual([]);
 });
 test.each(["nombre","organization_id","id"])("fila inválida por %s no sustituye registros",field=>{
  const bad=structuredClone(baseline);Object.assign(bad.clientes[0],{[field]:null});expect(()=>demoImportStore(JSON.stringify(bad))).toThrow();expect(demoExportStore()).toEqual(baseline);expect(mocks.write).not.toHaveBeenCalled();
 });
 test("disco no escribible conserva el estado anterior",()=>{const changed=structuredClone(baseline);changed.clientes[0].nombre="Cliente aislado";mocks.write.mockImplementation(()=>{throw Error("disco no escribible");});expect(()=>demoImportStore(JSON.stringify(changed))).toThrow();expect(demoExportStore()).toEqual(baseline);});
 test("campos ajenos al formato no se asignan al almacén",()=>{const raw=JSON.stringify(baseline).replace(/}$/,',"__proto__":{"alterado":true}}');expect(()=>demoImportStore(raw)).toThrow();expect(demoExportStore()).toEqual(baseline);expect(mocks.write).not.toHaveBeenCalled();});
 test("reintento de sueldo conserva uno; un envío distinto del mismo período es válido",()=>{
  const data={organization_id:baseline.empleados[0].organization_id,empleado_id:baseline.empleados[0].id,periodo:"2026-10",monto_bruto:100,descuentos:20,monto_neto:80};
  const id="10000000-0000-4000-8000-000000000058";const first=demoCreateSueldo(data,id);expect(demoCreateSueldo(data,id)).toEqual(first);
  expect(demoExportStore().sueldos.filter(row=>row.id===id)).toHaveLength(1);
  expect(()=>demoCreateSueldo({...data,monto_bruto:200},id)).toThrow();demoCreateSueldo(data,"10000000-0000-4000-8000-000000000059");
  expect(demoExportStore().sueldos).toHaveLength(baseline.sueldos.length+2);
 });
});
test("Resultado de Caja excluye personales, anulados y borrados; sueldo es informativo",()=>{
 const base={organization_id:"empresa",fecha:"2026-10-06",es_personal:false};
 const rows=monthlyCashRows([{...base,tipo:"ingreso",monto:500},{...base,tipo:"egreso",monto:80},{...base,tipo:"egreso",monto:900,es_personal:true},{...base,tipo:"ingreso",monto:999,deleted_at:"2026-10-06"},{...base,tipo:"ingreso",monto:999,voided_at:"2026-10-06"}], [{organization_id:"empresa",periodo:"2026-10",monto_neto:80}]);
 expect(rows).toMatchObject([{ingresos:500,egresos:80,sueldos:80,utilidad_neta:420}]);
});
