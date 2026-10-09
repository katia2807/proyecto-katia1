import { describe, expect, test } from "vitest";
import { buildReportesResumen, normalizeReportesResumen, reportesResumenCsv, reportesResumenError, reportesResumenQuery, type ReportesMovimiento } from "@/lib/reportes-resumen";
import { documentoClienteError, telefonoClienteError } from "@/lib/cotizacion-cliente-validacion";
import { getInventarioEstadoStock } from "@/lib/inventario-alertas";
import { inventarioRegistroFechaHora } from "@/lib/inventario-historial";
import { getInventarioFiltros, setInventarioFiltro } from "@/lib/inventario-filtros";
import { listadoPagina, listadoTamano } from "@/lib/listado-paginacion";
import { buildCajaHref, normalizeCajaFiltros } from "@/lib/caja-filtros";

const base: ReportesMovimiento = {id:"1",fecha:"2026-04-01",categoria:"venta_madera",tipo:"ingreso",monto:10.15,medio:"yape",es_personal:false,descripcion:"Venta ficticia",modulo_origen:"ventas_madera"};
const rows = [base,{...base,id:"2",fecha:"2026-04-30",tipo:"egreso",monto:3.10},{...base,id:"3",es_personal:true,monto:5},{...base,id:"4",tipo:"transferencia",monto:500},{...base,id:"5",categoria:"personal",monto:40},{...base,id:"6",fecha:"2026-05-01",monto:90},{...base,id:"7",deleted_at:"2026-04-01",monto:100},{...base,id:"8",voided_at:"2026-04-01",monto:100}];

describe("Selección de Reportes",()=>{
  test("fechas inclusivas, categoría y ámbito se combinan sin mezclar personal ni transferencias",()=>{
    const filtros=normalizeReportesResumen({desde:"2026-04-01",hasta:"2026-04-30",categoria:"venta_madera",ambito:"empresa"});
    const resumen=buildReportesResumen(rows,filtros);
    expect(resumen.movimientos.map(r=>r.id).sort()).toEqual(["1","2","4"]);
    expect(resumen).toMatchObject({ingresos:10.15,gastos:3.10,resultado:7.05,transferencias:1});
    expect(resumen.categorias).toHaveLength(1);
    expect(resumen.categorias[0]).toMatchObject({movimientos:3,esPersonal:false,resultado:7.05});
  });
  test("todo el historial distingue categorías de empresa y personal",()=>{
    const resumen=buildReportesResumen(rows,normalizeReportesResumen());
    expect(resumen.categorias.filter(r=>r.categoria==="venta_madera")).toHaveLength(2);
    expect(resumen.movimientos).toHaveLength(6);
  });
  test("categoría inexistente produce selección vacía, nunca una exportación masiva",()=>{
    expect(buildReportesResumen(rows,normalizeReportesResumen({categoria:"inexistente"})).movimientos).toHaveLength(0);
  });
  test.each([{desde:"2026-02-30"},{desde:"2026-05-01",hasta:"2026-04-01"}])("rechaza fechas inválidas antes de producir archivos",params=>{
    const filtros=normalizeReportesResumen(params);
    expect(reportesResumenError(filtros)).toBeTruthy();
    expect(()=>buildReportesResumen(rows,filtros)).toThrow();
  });
  test("CSV conserva todas las coincidencias, protege fórmulas y escapa comillas",()=>{
    const registros=Array.from({length:1201},(_,i)=>({...base,id:String(i),descripcion:i===0?'=SUM(1,2)':i===1?'Texto "con comillas"':"Seguro"}));
    const csv=reportesResumenCsv(buildReportesResumen(registros,normalizeReportesResumen()));
    expect(csv.split("\r\n")).toHaveLength(1202);
    expect(csv).toContain("'=SUM(1,2)");
    expect(csv).toContain('Texto ""con comillas""');
  });
  test("los enlaces codifican la selección y no dependen de la página del detalle",()=>{
    const filtros=normalizeReportesResumen({categoria:"Compra & madera",ambito:"personal"});
    expect(new URLSearchParams(reportesResumenQuery(filtros)).get("categoria")).toBe("Compra & madera");
  });
});

describe("Cliente y presentación de Inventario",()=>{
  test("documentos vacíos siguen permitidos para el alta rápida, pero un documento informado debe ser válido",()=>{
    expect(documentoClienteError("natural","",false)).toBeNull();
    expect(documentoClienteError("natural","12345678")).toBeNull();
    expect(documentoClienteError("empresa","20123456789")).toBeNull();
    expect(documentoClienteError("natural","123456789")).toBeTruthy();
    expect(documentoClienteError("empresa","2012345678x")).toBeTruthy();
  });
  test("conserva teléfonos locales e internacionales y rechaza letras o números incompletos",()=>{
    for(const value of ["","999 999 999","+51 999 999 999","(01) 234-5678"]) expect(telefonoClienteError(value)).toBeNull();
    for(const value of ["abc999999999","123","9".repeat(16)]) expect(telefonoClienteError(value)).toBeTruthy();
  });
  test("stock agotado, bajo y disponible se distinguen incluso con mínimo cero",()=>{
    expect(getInventarioEstadoStock(0,0).nivel).toBe("agotado");
    expect(getInventarioEstadoStock(-1,5).nivel).toBe("agotado");
    expect(getInventarioEstadoStock(5,5).nivel).toBe("bajo");
    expect(getInventarioEstadoStock(6,5).nivel).toBe("normal");
  });
  test("registro muestra día y hora de Perú, sin inventar la hora de movimientos antiguos",()=>{
    expect(inventarioRegistroFechaHora("2026-10-09T01:02:03Z")).toContain("08/10/2026");
    expect(inventarioRegistroFechaHora("2026-10-09T01:02:03Z")).toContain("20:02:03");
    for(const value of [null,"","2026-10-08","invalida"]) expect(inventarioRegistroFechaHora(value)).toBe("Sin hora registrada");
  });
  test("cambiar filtro o tamaño del Kardex reinicia su página, conservando el producto y la pestaña",()=>{
    const params=new URLSearchParams("tab=kardex&kardex_producto=p1&kardex_pagina=9");
    const next=setInventarioFiltro(params,"kardex_filas","50");
    expect(next.get("kardex_pagina")).toBeNull();
    expect(next.get("kardex_producto")).toBe("p1");
    expect(getInventarioFiltros(next).kardexFilas).toBe(50);
    expect(listadoPagina(999,51,50)).toBe(2);
    expect(listadoTamano(50000)).toBe(50);
  });
  test("Caja conserva el tamaño elegido al navegar, junto con los filtros",()=>{
    const filtros=normalizeCajaFiltros({por_pagina:"20",buscar:"Madera"});
    const url=new URL(buildCajaHref("empresa",filtros,2),"http://local");
    expect(url.searchParams.get("por_pagina")).toBe("20");
    expect(url.searchParams.get("buscar")).toBe("Madera");
  });
});
