import { buildLineasResumen } from "@/lib/cotizacion-unificada-lineas";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { productMoney, roundLegacyMoney, roundMoney, sumMoney } from "@/lib/money";
import { calcularGananciaPorMargen, calcularContratoCotizacion, calcularCotizacionParaGuardar, crearInstantaneaCalculoCotizacion, resolverCalculoDocumentoCotizacion } from "@/lib/cotizacion-calculos";
import { defaultCotizacionDetalleV1 } from "@/lib/cotizacion-unificada-payload";
import { calculateMaderaCortadaRealPtPricing } from "@/lib/madera-cortada-pricing";
import { buildAserraderoPrintModel } from "@/lib/aserradero-print-model";
let db:PGlite;
beforeAll(async()=>{db=new PGlite();await db.waitReady;});
afterAll(async()=>{await db.close();});
function detalle(costo=20.15) {
 const d=defaultCotizacionDetalleV1();d.rubros.aserradero=true;d.aserradero={modo:"total",precioHora:0,horas:0,montoTotalFijo:costo,descripcion:"Servicio"};return d;
}
describe("precisión monetaria y compatibilidad",()=>{
 test.each([[10.075,10.08],[1.005,1.01],[1.255,1.26],[10.074,10.07],[10.076,10.08],[-10.075,-10.08],[-0.004,0],[0,0]])("redondea %s al centavo más cercano: %s",(value,expected)=>expect(roundMoney(value)).toBe(expected));
 test("suma y multiplica sin perder céntimos antes de redondear",()=>{
   expect(sumMoney([0.1,0.2])).toBe(0.3);expect(productMoney([20.15,50],100)).toBe(10.08);
   expect(calcularGananciaPorMargen(20.15,50)).toBe(10.08);
   expect(calcularContratoCotizacion(detalle(),50)).toMatchObject({subtotalBase:20.15,margenMonto:10.08,totalFinal:30.23});
 });
 test("los empates monetarios coinciden con numeric de PostgreSQL, incluidos negativos",async()=>{
  const values=["10.075","-10.075","1.005","1.255","2.185","-0.005","9999999999.995","0.0000005"];
  for(const value of values) {
   const r=await db.query<{amount:string}>("select round($1::numeric,2)::text amount",[value]);
   expect(roundMoney(Number(value))).toBe(Number(r.rows[0].amount));
  }
 });
 test("todos los importes guardados al centavo de la muestra conservan su valor",()=>{
  for(let cents=-100000;cents<=100000;cents+=17) expect(roundMoney(cents/100)).toBe(roundLegacyMoney(cents/100));
  for(const amount of [9999999999.99,999999999999.99,0.29,74_677.29])expect(roundMoney(amount)).toBe(roundLegacyMoney(amount));
 });
 test("el cubicaje multiplica entradas decimales y redondea al final",async()=>{
  const input={cantidad:3,espesor:0.1,ancho:10,largo:2,precioPorPt:4.37};
  const sql=await db.query<{total:string}>("select round(3::numeric*0.1*10*2/12*4.37,2)::text total");
  expect(calculateMaderaCortadaRealPtPricing(input).subtotalComercial).toBe(Number(sql.rows[0].total));
 });
 test("una cotización antigua y su precio acordado no se recalculan al consultar",()=>{
   const old=detalle();old.resumenCalculo={subtotalBase:20.15,margenPctAplicado:50,margenMonto:10.07,totalFinal:30.22};
   expect(resolverCalculoDocumentoCotizacion(old,30.22)).toMatchObject({totalFinal:30.22,margenMonto:10.07,usaInstantanea:true});
   const edit=structuredClone(old);edit.notas_generales="Nueva nota";
   expect(calcularCotizacionParaGuardar(edit,50,{detalle:old,total:30.22})).toMatchObject({totalFinal:30.22,margenMonto:10.07});
   expect(old.resumenCalculo.precisionVersion).toBeUndefined();
 });
 test("una nueva instantánea reconoce la precisión corregida sin alterar la antigua",()=>{
   const d=detalle(),calculo=calcularContratoCotizacion(d,50);d.resumenCalculo=crearInstantaneaCalculoCotizacion(calculo);
   expect(d.resumenCalculo.precisionVersion).toBe(2);
   expect(resolverCalculoDocumentoCotizacion(d,30.23)).toMatchObject({totalFinal:30.23,margenMonto:10.08,usaInstantanea:true});
 });
 test("editar la base económica aplica el cálculo nuevo que el usuario ve antes de guardar",()=>{
   const old=detalle();old.resumenCalculo={subtotalBase:20.15,margenPctAplicado:50,margenMonto:10.07,totalFinal:30.22};
   expect(calcularCotizacionParaGuardar(detalle(20.16),50,{detalle:old,total:30.22})).toMatchObject({subtotalBase:20.16,margenMonto:10.08,totalFinal:30.24});
 });
 test("las instantáneas enviadas por el cliente no reemplazan el importe anterior",()=>{
   const old=detalle();old.resumenCalculo={subtotalBase:20.15,margenPctAplicado:50,margenMonto:10.07,totalFinal:30.22};
   const modified=structuredClone(old);modified.resumenCalculo={subtotalBase:20.15,margenPctAplicado:0,margenMonto:0,totalFinal:0,precisionVersion:2};
   expect(calcularCotizacionParaGuardar(modified,50,{detalle:old,total:30.22}).totalFinal).toBe(30.22);
 });
 test("el comprobante anterior conserva importe y PT comercial hacia abajo",()=>{
   const service={id:"previa",fecha:"2026-10-15",lineas_json:[{tipo:"bloque_cubicaje",cantidad:2,espesor:1,ancho:10,largo:10}],costo_cubicaje:10.07,precio_cobrado:20.15,adelanto:5};
   const model=buildAserraderoPrintModel({service,customer:null,tipoComprobante:"boleta"});
   expect(model.totals.totalCobrado).toBe(20.15);expect(model.totals.subtotalCorte).toBe(10.07);
   expect(model.payment.saldo).toBe(15.15);expect(model.blocks[0].ptUnitarioComercial).toBe(8);expect(model.blocks[0].ptTotalComercial).toBe(16);
 });
 test("no convierte importes no finitos en dinero válido",()=>{expect(roundMoney(NaN)).toBeNaN();expect(roundMoney(Infinity)).toBe(Infinity);});

 test("reimprimir un documento antiguo conserva también los importes de sus líneas",()=>{
   const d=detalle(10);d.rubros.muebles=true;
   d.muebles_lineas=[{id:"l",inventario_producto_id:null,especie_label:"Madera",precioPorPt:20.15,piezas:[{id:"p",cantidad:1,espesor:1,ancho:1,largo:12,descripcion:"Pieza"}]}];
   d.resumenCalculo={subtotalBase:30.15,margenPctAplicado:50,margenMonto:15.07,totalFinal:45.22};
   const oldLines=buildLineasResumen(d,50,45.22,1);
   expect(oldLines.map(line=>line.precioTotal)).toEqual([30.22,15]);
   const current=calcularContratoCotizacion(d,50);
   expect(current.totalFinal).toBe(45.23);
   expect(buildLineasResumen(d,50,current.totalFinal,2).map(line=>line.precioTotal)).toEqual([30.23,15]);
 });
});
