import Link from "next/link";
import {
  eliminarDatoIndividual,
  eliminarDatosPorCategoria,
  eliminarDatosSistema,
  restaurarRespaldoJSON,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Field, SelectField } from "@/components/ui/field";

export default function RespaldoPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Respaldo del sistema</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Descarga el estado completo del taller en un único archivo JSON o restaura un respaldo
            previo.
          </p>
        </div>
        <Link href="/" className="text-sm font-semibold underline">
          ← Volver al inicio
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Descargar respaldo</CardTitle>
          <CardDescription>
            Genera un JSON con todas las tablas del store local: caja, clientes, proveedores,
            cotizaciones, ventas, alquileres, órdenes, sueldos y más. Guárdalo en un disco externo o
            en Drive.
          </CardDescription>
          <div className="mt-3">
            <a href="/api/respaldo/export">
              <Button>Descargar katia-respaldo.json</Button>
            </a>
          </div>
        </Card>

        <Card className="border-[var(--color-danger)]">
          <CardTitle className="text-[var(--color-danger)]">Restaurar respaldo</CardTitle>
          <CardDescription>
            ⚠ Reemplaza <strong>todas las tablas actuales</strong> con el contenido del archivo. Solo
            owner_admin y gerencia. Escribe <code>RESTAURAR</code> para confirmar.
          </CardDescription>
          <form action={restaurarRespaldoJSON} className="mt-3 space-y-3">
            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                Archivo JSON
              </span>
              <input
                type="file"
                name="archivo"
                accept="application/json,.json"
                required
                className="block w-full text-sm text-[var(--color-text-primary)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--color-accent)] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[var(--color-on-accent)]"
              />
            </label>
            <Field
              name="confirmacion"
              label='Confirmación (escribe: RESTAURAR)'
              placeholder="RESTAURAR"
              required
            />
            <Button>Restaurar respaldo</Button>
          </form>
        </Card>
      </div>

      <Card className="border-[var(--color-danger)]">
        <CardTitle className="text-[var(--color-danger)]">Zona peligrosa: eliminar datos</CardTitle>
        <CardDescription>
          ⚠ Esta acción elimina los datos operativos y reinicia el sistema local al estado base. Solo
          owner_admin y gerencia. Para evitar errores, escribe <code>ELIMINAR TODO</code> y luego confirma.
        </CardDescription>
        <form action={eliminarDatosSistema} className="mt-3 space-y-3">
          <Field
            name="confirmacion"
            label='Confirmación (escribe: ELIMINAR TODO)'
            placeholder="ELIMINAR TODO"
            required
          />
          <Field
            name="confirmacion_final"
            label='Confirmación final (vuelve a escribir: ELIMINAR TODO)'
            placeholder="ELIMINAR TODO"
            required
          />
          <Button variant="danger">Eliminar datos del sistema</Button>
        </form>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-[var(--color-danger)]">
          <CardTitle className="text-[var(--color-danger)]">Eliminar por categoría</CardTitle>
          <CardDescription>
            Borra todos los registros de una categoría puntual. Usa esta opción para limpiar un módulo
            completo sin tocar el resto.
          </CardDescription>
          <form action={eliminarDatosPorCategoria} className="mt-3 space-y-3">
            <SelectField name="categoria" label="Categoría" defaultValue="cotizacionesUnificadas" required>
              <option value="caja">Caja</option>
              <option value="clientes">Clientes</option>
              <option value="proveedores">Proveedores</option>
              <option value="ventas">Ventas</option>
              <option value="cotizaciones">Cotizaciones</option>
              <option value="cotizacionesUnificadas">Cotizaciones unificadas</option>
              <option value="comprasMadera">Compras de madera</option>
              <option value="inventarioProductos">Inventario productos</option>
              <option value="inventarioMovimientos">Inventario movimientos</option>
              <option value="alquileres">Alquileres</option>
              <option value="empleados">Empleados</option>
              <option value="adelantos">Adelantos</option>
              <option value="sueldos">Sueldos</option>
              <option value="ordenesProduccion">Órdenes de producción</option>
              <option value="mueblesCatalogo">Catálogo de muebles</option>
              <option value="ventasMuebleTerminado">Ventas de muebles terminados</option>
              <option value="serviciosAserradero">Servicios de aserradero</option>
              <option value="registrosGenerales">Registros generales</option>
              <option value="zonasEntrega">Zonas de entrega</option>
            </SelectField>
            <Field
              name="confirmacion_categoria"
              label='Confirmación (escribe: ELIMINAR CATEGORIA)'
              placeholder="ELIMINAR CATEGORIA"
              required
            />
            <Button variant="danger">Eliminar categoría completa</Button>
          </form>
        </Card>

        <Card className="border-[var(--color-danger)]">
          <CardTitle className="text-[var(--color-danger)]">Eliminar registro individual</CardTitle>
          <CardDescription>
            Elimina un solo registro por su ID exacto dentro de una categoría.
          </CardDescription>
          <form action={eliminarDatoIndividual} className="mt-3 space-y-3">
            <SelectField name="categoria" label="Categoría" defaultValue="cotizacionesUnificadas" required>
              <option value="caja">Caja</option>
              <option value="clientes">Clientes</option>
              <option value="proveedores">Proveedores</option>
              <option value="ventas">Ventas</option>
              <option value="cotizaciones">Cotizaciones</option>
              <option value="cotizacionesUnificadas">Cotizaciones unificadas</option>
              <option value="comprasMadera">Compras de madera</option>
              <option value="inventarioProductos">Inventario productos</option>
              <option value="inventarioMovimientos">Inventario movimientos</option>
              <option value="alquileres">Alquileres</option>
              <option value="empleados">Empleados</option>
              <option value="adelantos">Adelantos</option>
              <option value="sueldos">Sueldos</option>
              <option value="ordenesProduccion">Órdenes de producción</option>
              <option value="mueblesCatalogo">Catálogo de muebles</option>
              <option value="ventasMuebleTerminado">Ventas de muebles terminados</option>
              <option value="serviciosAserradero">Servicios de aserradero</option>
              <option value="registrosGenerales">Registros generales</option>
              <option value="zonasEntrega">Zonas de entrega</option>
            </SelectField>
            <Field
              name="id_registro"
              label="ID del registro a eliminar"
              placeholder="Pega el UUID o ID exacto"
              required
            />
            <Field
              name="confirmacion_item"
              label='Confirmación (escribe: ELIMINAR REGISTRO)'
              placeholder="ELIMINAR REGISTRO"
              required
            />
            <Button variant="danger">Eliminar solo este registro</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
