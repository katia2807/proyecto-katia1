import { beforeEach, describe, expect, test, vi } from "vitest";
import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(()=>({auth:vi.fn(),data:vi.fn()}));
vi.mock("@/lib/api-auth",()=>({requireApiAuth:mocks.auth}));
vi.mock("@/lib/reportes-data",()=>({getReportesData:mocks.data}));
import { GET } from "@/app/api/export/reportes-resumen/route";

const rows=[
  {id:"1",fecha:"2026-04-01",categoria:"venta_madera",tipo:"ingreso",monto:15,medio:"efectivo",es_personal:false,descripcion:"Venta ficticia",modulo_origen:"caja"},
  {id:"2",fecha:"2026-04-30",categoria:"venta_madera",tipo:"egreso",monto:5,medio:"yape",es_personal:false,descripcion:"Gasto ficticio",modulo_origen:"caja"},
  {id:"3",fecha:"2026-05-01",categoria:"venta_madera",tipo:"ingreso",monto:100,medio:"efectivo",es_personal:false,descripcion:"Fuera de fecha",modulo_origen:"caja"},
  {id:"4",fecha:"2026-04-01",categoria:"venta_madera",tipo:"ingreso",monto:200,medio:"efectivo",es_personal:true,descripcion:"Personal",modulo_origen:"caja"},
];
const url="http://local/api/export/reportes-resumen?desde=2026-04-01&hasta=2026-04-30&categoria=venta_madera&ambito=empresa";

describe("Archivos del resumen de Caja",()=>{
  beforeEach(()=>{
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({context:{organizationId:"org-ficticia",role:"owner_admin"},response:null});
    mocks.data.mockResolvedValue({caja:rows});
  });
  test("Excel contiene la misma selección y los totales por categoría",async()=>{
    const response=await GET(new Request(`${url}&formato=excel`));
    expect(response.status).toBe(200);
    expect(mocks.auth).toHaveBeenCalledWith(["owner_admin","gerencia"]);
    expect(mocks.data).toHaveBeenCalledWith("org-ficticia");
    const wb=new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await response.arrayBuffer()) as unknown as Parameters<typeof wb.xlsx.load>[0]);
    expect(wb.worksheets).toHaveLength(2);
    const resumen=wb.getWorksheet("Resumen por categoría")!;
    expect([resumen.getCell("B3").value,resumen.getCell("D3").value,resumen.getCell("F3").value]).toEqual([15,5,10]);
    const detail=wb.getWorksheet("Movimientos seleccionados")!;
    expect(detail.rowCount).toBe(3);
    expect(detail.getColumn(8).values).not.toContain("Personal");
    expect(detail.getColumn(8).values).not.toContain("Fuera de fecha");
  });
  test("CSV conserva únicamente las coincidencias de las mismas fechas",async()=>{
    const response=await GET(new Request(`${url}&formato=csv`));
    expect(response.status).toBe(200);
    const csv=await response.text();
    expect(csv).toContain("Venta ficticia");
    expect(csv).not.toContain("Fuera de fecha");
    expect(csv).not.toContain('"Personal"');
    expect(csv.split("\r\n")).toHaveLength(3);
  });
  test("exportación sin permiso se rechaza antes de consultar datos",async()=>{
    mocks.auth.mockResolvedValue({context:null,response:NextResponse.json({error:"Sin permiso"},{status:403})});
    expect((await GET(new Request(url))).status).toBe(403);
    expect(mocks.data).not.toHaveBeenCalled();
  });
  test("fechas inválidas y formato desconocido no consultan ni descargan todo el historial",async()=>{
    expect((await GET(new Request("http://local/api/export/reportes-resumen?desde=2026-02-30"))).status).toBe(400);
    expect((await GET(new Request(`${url}&formato=pdf`))).status).toBe(400);
    expect(mocks.data).not.toHaveBeenCalled();
  });
  test("un fallo de lectura devuelve error en vez de un archivo parcial",async()=>{
    mocks.data.mockRejectedValue(new Error("Fallo ficticio"));
    const response=await GET(new Request(url));
    expect(response.status).toBe(503);
    expect(response.headers.get("Content-Disposition")).toBeNull();
  });
});
