# Diagnóstico de los apartados pendientes

Fecha: 06/10/2026. Base revisada: código y servidor local 1.1.56. Registro documental preparado: 1.1.57. Última producción comprobada en la revisión anterior: 1.1.56; no se visitó ni publicó producción en este diagnóstico.

**Continuación, 1.1.58:** el usuario autorizó implementar estas correcciones. Se encuentran preparadas y comprobadas en local; el [informe de correcciones](REVISION_CORRECCIONES_RESTANTES_2026-10-06.md) registra cambios, pruebas y requisitos de publicación. El diagnóstico que sigue se conserva como evidencia del punto de partida, no como estado actual de las correcciones. Producción y la migración de Supabase siguen pendientes.

## Alcance y criterio

El usuario pidió revisar lo que falta del programa. Esta entrega identifica problemas y el orden de corrección; no implementa cambios funcionales, incorpora funciones ni cambia la forma habitual de trabajo. Inicio, Ventas, Caja, Inventario, Cotizaciones, Clientes y Centro de Mando conservan el alcance de sus revisiones anteriores. Las incidencias nuevas de funciones compartidas se registran aparte.

Se leyó el código de las áreas visibles restantes, sus acciones, lectores y exportaciones, y se inventariaron rutas auxiliares y opciones desactivadas. En el navegador local con sesión demo se revisaron Reportes, Registro, Equipo, Respaldo, Configuración y Ayuda. En Reportes se vio el formulario de acceso a auditoría, sin introducir un código; no se cerró un mes. Se abrieron formularios sin guardarlos. Usuarios y algunas rutas auxiliares regresaron a Inicio en los intentos locales: no se estableció la causa y no se considera comprobada su interfaz.

Las etiquetas **código**, **local** y **memoria** indican cómo se obtuvo la evidencia. Código no equivale a una prueba contra la base desplegada. Memoria utiliza funciones originales con persistencia sustituida por un objeto aislado; no escribe los almacenes del programa. La prioridad alta corresponde a permisos, pérdida de datos o cifras que pueden orientar mal una decisión; media, a validación, alcance, información o diseño; baja, a rutas auxiliares y prototipos ocultos.

## Orden recomendado

1. PER1–PER2: asegurar las operaciones y lecturas en el servidor con rol efectivo y organización de la sesión.
2. RES1–RES4: validar restauración, revisar limpieza y aclarar qué permite recuperar cada exportación.
3. REP1–REP4 y COMP-R1: corregir cifras, alcance y mensajes de Reportes antes de retocar su apariencia.
4. EQU1–EQU2, REG1–REG2: cerrar validaciones y errores de diseño sin cambiar pasos de trabajo.
5. USU1–USU2, CON1–CON2: asegurar guardados de usuarios, empresa y cuenta.
6. AYU1 y elementos compartidos: ajustar instrucciones, avisos y búsqueda. Revisar auxiliares cuando corresponda a su uso real.

No es necesario rehacer todo para corregir cada punto. Las comprobaciones deben cubrir el cambio y los recorridos que comparten sus datos.

## Permisos y acceso compartido

| ID / prioridad | Evidencia y problema | Corrección propuesta |
| --- | --- | --- |
| PER1 / Alta | **Código:** `admin/respaldo/import/route.ts` POST y `export/route.ts` GET requieren sesión, pero no roles autorizados. La importación obtiene el cliente administrativo y escribe en `DEFAULT_ORG_ID`. Ocultar el menú no impide llamar a estas rutas con una sesión. `lib/supabase/server.ts` usa credenciales administrativas, por lo que no debe delegarse la autorización a las políticas de filas. | Rechazar antes de leer archivos/consultar/escribir si el rol no está autorizado; usar la organización del contexto y respuestas coherentes de acceso denegado. Comprobar con sesiones aisladas, sin importaciones reales. |
| PER2 / Alta | **Código:** el layout exige autenticación, mientras `AppShellAccessGuard` redirige según permisos después de cargar la página en el navegador. Reportes, Registro, Personal y Respaldo consultan datos sin una restricción de área equivalente antes de leer en servidor. Además, algunas acciones evalúan el rol original y otras el `ui_role` efectivo. | Aplicar el mismo criterio de permiso efectivo antes de consultar datos o ejecutar acciones. Comprobar la matriz por rol. No ampliar permisos para resolver diferencias. Configuración y Usuarios ya tienen controles explícitos: conservarlos. |

No se probaron solicitudes de escritura con roles ajenos ni se evaluaron todas las políticas reales de Supabase. PER1 está identificado en la ruta, no en un intento de modificar datos del negocio.

## Respaldo e importación

| ID / prioridad | Evidencia y problema | Corrección propuesta |
| --- | --- | --- |
| RES1 / Alta | **Memoria y código:** `demoImportStore` migra campos faltantes a datos iniciales y reemplaza el almacén antes de que `restaurarRespaldoJSON` compruebe el resultado. `{}` fue aceptado con 36 registros predeterminados y eliminó un empleado ficticio. Un JSON válido con solo inventario y el resto de tablas vacías devolvió cero después de persistir: el llamador lo mostraría como inválido pese al reemplazo. El contador omite varias tablas. | Validar estructura, tablas y relaciones antes de aplicar; distinguir vacío, parcial y completo. Un rechazo no debe cambiar nada. Probar ida/vuelta y fallos en una copia descartable. |
| RES2 / Alta | **Código:** `resetDatabaseAction` borra tablas una por una sin transacción; ante un error, lo ya borrado queda aplicado. Incluye `audit_logs` y después intenta registrar la limpieza; un fallo del registro solo se imprime. El control de dueña y la frase de confirmación sí existen. | Revisar atomicidad/recuperación y conservación de evidencia. Antes de una prueba destructiva, disponer de una recuperación comprobada en un entorno aislado. No se ejecutó esta función. |
| RES3 / Alta | **Código:** el archivo llamado «Respaldo completo.xlsx» exporta determinadas hojas, sin cubrir Caja, cotizaciones, alquileres, movimientos de inventario y nómina completos. Usa lectores recientes con límites. La importación reconoce solo Compradores, Choferes, Proveedores e Inventario; ese Excel no reconstruye todo el programa. La restauración JSON pertenece al modo local, y la pantalla remite el respaldo de producción a Supabase. | Identificar claramente exportación y respaldo restaurable, especificar alcance y comprobar recuperación. No afirmar que existen respaldos automáticos de Supabase sin verificar su configuración. |
| RES4 / Media | **Código:** el selector acepta `.xls`, pero el lector usa `wb.xlsx.load`, que espera XLSX. La importación suma actualizaciones de productos como registros nuevos y actualiza stock directamente, sin el movimiento habitual de Kardex. Los alias de encabezado pueden confundir costo y precio. | Alinear formato admitido y mensaje del resultado; revisar unidades/costos y coherencia del stock importado con su historial. No reinterpretar ni reparar registros existentes automáticamente. |

Fuentes: `app/(dashboard)/admin/respaldo/`, `lib/demo-store.ts`, `lib/respaldo-supabase-resumen.ts` y la acción JSON de `app/actions.ts`. El resumen de Supabase cuenta tablas sin acotar organización: incluirlo en PER1. No se importaron Excel, restauraron archivos o ejecutaron limpiezas contra ningún almacén del programa.

## Reportes

| ID / prioridad | Evidencia y problema | Corrección propuesta |
| --- | --- | --- |
| REP1 / Alta | **Código:** Caja se limita a 50 filas; ventas se combinan y recortan a 50; sueldos y adelantos a 30; utilidad/cierres a 24. Fallos de consulta pueden presentarse como listas vacías. El Excel de Reportes usa estos lectores pese a textos de totalidad. Algunos alquileres sustituyen importe desconocido por tarifa. | Usar lectores apropiados al alcance del reporte/exportación, comunicar fallos y límites reales, y mantener separado un monto desconocido. Preservar los lectores completos ya corregidos de Caja y Mando. |
| REP2 / Alta | **Código y texto local:** `getCobrosVencidos` contempla muebles sin entregar y alquileres abiertos, omite madera y no descuenta todos los pagos vinculados. Entrega y pago no son equivalentes. Cero produce «Todo al día», aunque la consulta no cubra todo el crédito. La fecha inicial usa UTC. | Compartir el criterio fiable de pagos/fechas de Perú o explicar el alcance exacto, sin afirmar que no existe deuda a partir de un conteo parcial. |
| REP3 / Alta | **Código:** la auditoría integrada consulta `snapshot.ingresos` y `.egresos`, mientras el modelo entrega `ingresosMesActual` y `egresosMesActual`: los valores caen a cero. «Sin inconsistencias detectadas» es texto fijo, no resultado de una comparación. «Acceso registrado» no corresponde a una escritura de auditoría en la acción, que establece una cookie. La ruta antigua usa muestras recortadas. | Corregir campos y evidencias, distinguir ausencia/fallo de datos y eliminar confirmaciones no respaldadas. Revisar ambas presentaciones sin abrir permisos nuevos. La auditoría autenticada no se activó en este diagnóstico. |
| REP4 / Media | **Local y código:** a 360 px, dos tablas miden 500 px en contenedores de 274 px con `overflow:hidden`; se pierden columnas. `ReporteFila` depende de clic en una fila sin control de teclado equivalente. Algunos UUID de usuario se muestran como «Sistema/no registrado» y enlaces llevan al módulo general. | Permitir desplazamiento accesible y abrir detalles con controles adecuados; resolver el actor o indicar honestamente que no se identificó. Conservar el contenido y las rutas existentes. |

Fuentes: `app/(dashboard)/reportes/`, `app/api/export/reportes-excel/route.ts`, `components/reportes/`, `lib/data.ts`. No se descargó ni verificó el contenido del Excel real de Reportes en esta etapa.

## Equipo y Registro

| ID / prioridad | Evidencia y problema | Corrección propuesta |
| --- | --- | --- |
| EQU1 / Alta | **Memoria y código:** el esquema acepta período «octubre», sueldo bruto 100 y descuentos 150, nombres/cargos de espacios y fecha inválida. Dos llamadas idénticas a `demoCreateSueldo` crean dos filas. El SQL inicial no impone una protección equivalente sobre sueldos. | Validar período/fecha, recortar y rechazar vacíos, impedir neto negativo y repetir el mismo envío por accidente. No imponer una sola nómina mensual sin aclarar si existen pagos parciales; no cambiar el tratamiento de adelantos por suposición. |
| EQU2 / Media | **Local y código:** a 360 px la página tiene 546 px de ancho desplazable; las tablas ensanchan la cuadrícula. El lector muestra solo 30 sueldos/adelantos y omite errores. Se exponen estados como `descontado_nomina`. | Corregir contención/desplazamiento, etiquetas y aviso de alcance/fallo. Mantener registro de empleados, sueldos y adelantos en sus pasos habituales. |
| REG1 / Media | **Memoria y código:** el esquema acepta títulos de espacios y una cadena que no representa fecha. | Validar contenido y fecha antes de guardar, conservando lo escrito cuando corresponda informar un error. |
| REG2 / Media | **Local y código:** la tabla mide 504 px en un contenedor de 274 px que oculta columnas. El lector se corta a 100 registros, sin explicar ese límite; el fallo puede parecer ausencia de historial y falta un estado vacío explícito. | Corregir acceso a columnas y mensajes de historial/fallo. La selección de categoría y el formulario se revisaron sin guardar. |

Fuentes: páginas/componentes de `personal` y `registro`, esquemas en `app/actions.ts`, lectores en `lib/data.ts` y `lib/demo-store.ts`. No se creó un empleado, sueldo, adelanto o registro en el archivo de datos local ni en producción.

## Usuarios y Configuración

| ID / prioridad | Evidencia y problema | Corrección propuesta |
| --- | --- | --- |
| USU1 / Alta | **Código:** `updateOrganizationUser` actualiza el perfil con organización fija sin comprobar filas afectadas, después modifica el usuario global de Auth sin confirmar primero pertenencia. Ignora el error de Auth. Puede informar éxito con una actualización incompleta. | Verificar pertenencia a la organización de la sesión y resultado de cada paso antes de actualizar Auth o informar éxito. Conservar las protecciones existentes de la dueña. |
| USU2 / Media | **Código:** el listado no lee `ui_role`; las equivalencias de roles antiguos pueden cambiar el permiso al guardar otros datos y se borra `ui_role`. Activar/desactivar escribe primero perfil y luego Auth: un fallo deja estados divergentes. Sí hay protección de autodesactivación y de la última dueña activa. | Mostrar/conservar el rol efectivo; manejar fallos parciales de forma coherente. Probar con cuentas descartables. No se enviaron invitaciones ni cambiaron roles. |
| CON1 / Alta | **Código:** `getEmpresaConfig` ignora el fallo y puede mostrar datos predeterminados como si fueran reales. Guardar empresa ignora el fallo de lectura previa de logo/margen y puede sobrescribirlos con valores por defecto. Cambiar logo elimina el anterior antes de confirmar su nueva URL en base de datos. | Separar fallo de falta de configuración; preservar valores existentes y eliminar el logo anterior solo después de confirmar el reemplazo. No se cambió logo o información del emisor. |
| CON2 / Media | **Código:** Cuenta actualiza nombre, contraseña y correo en pasos separados; un fallo tardío deja cambios previos aplicados. Recuperación acepta una longitud mínima de contraseña diferente a la del cambio desde Cuenta. | Informar resultados parciales y alinear validaciones. La prueba requiere cuentas aisladas y entrada de credenciales por el usuario. No se modificó ninguna contraseña ni se inició recuperación. |

Fuentes: acciones de `admin/usuarios`, `admin/empresa`, `cuenta`, `lib/company-config.ts` y formularios de acceso/recuperación. Las cuatro pestañas locales de Configuración se abrieron; Tarifas a 360 px no ensanchó la página. Eso no comprueba sus guardados contra Supabase. La interfaz de Usuarios sigue pendiente de una navegación concluyente.

## Ayuda e incidencias compartidas

| ID / prioridad | Evidencia y problema | Corrección propuesta |
| --- | --- | --- |
| AYU1 / Media | **Local y código:** el manual de Vendedor indica altas de ventas/clientes/caja que su permiso efectivo restringe a lectura. Preguntas sobre exportar todo no explican los límites observados. | Corregir instrucciones según las capacidades reales, sin ampliar acceso ni prometer exportaciones completas. Ayuda a 320 px no ensanchó la página. |
| COMP-R1 / Alta | **Código:** la vista SQL `utilidad_mensual` del repositorio no excluye Caja personal/borrada lógicamente y resta sueldos además del egreso de Caja. Si la nómina ya se pagó desde Caja, puede descontarse dos veces. Es un resultado de caja presentado como utilidad neta. Amplía COMP-M1, antes observado solo en demo. | Revisar la definición desplegada y el significado de cada cifra antes de corregir. No se inspeccionó la vista real ni se afirma que todo período tenga duplicación. |
| COMP-R2 / Media | **Código:** la campana recibe una lista vacía por defecto y el layout no le pasa notificaciones; los textos prometen alertas automáticas. | Ajustar mensajes o acordar el uso de alertas existentes. No convertir este diagnóstico en una nueva función de notificaciones. |
| COMP-R3 / Media | **Código:** el contador del menú combina stock y el lector antiguo de vencimientos; no representa las prioridades del Mando nuevo. | Unificar el alcance o aclarar qué cuenta. No se volvió a medir producción en esta revisión. |
| COMP-R4 / Media | **Código:** la búsqueda global recibe muestras limitadas de clientes/productos/cotizaciones, sin filtrar sus destinos según el rol antes de ofrecer enlaces. | Alinear permisos y comunicar el alcance; revisar conjuntamente con PER2. No se comprobó la exposición con cada rol real. |

Fuentes: Ayuda, `components/app-shell.tsx`, búsqueda/campana, layout, permisos, lectores y migración `20260430183000_init_erp_katia.sql`. Estas observaciones no cambian automáticamente el estado de una revisión anterior; agregan incidencias concretas a la continuidad.

## Rutas auxiliares y opciones ocultas

- **AUX1 / Media, código:** el comparador de proveedores toma mínimos entre especies/proveedores sin asegurar igual unidad, con compras recortadas. El resumen antiguo `/ventas/dashboard` utiliza calendario del servidor y mezcla operaciones/borradores o tarifas con ingresos. No equivale al historial de Ventas ya revisado. La interfaz de estas rutas no se pudo comprobar en esta etapa.
- **AUX2 / Baja, código:** el prototipo `/admin/importar` lee PDF/Excel/Word como texto, toma el primer número como monto, limita filas y su botón final no tiene operación conectada. Es distinto de la importación activa de Respaldo. Seguridad muestra controles/periodicidad de respaldos declarados manualmente, sin monitorización comprobada. Ambas opciones están desactivadas; no activarlas como parte de las correcciones.
- **AUX3 / Baja, código:** se conservan los accesos históricos de Cuenta/Empresa y las redirecciones de Alquiler/Muebles. Algunas banderas desactivadas no gobiernan opciones equivalentes visibles en Reportes. Revisar coherencia de visibilidad cuando se trabaje cada ruta. No retirar enlaces ni documentación por parecer duplicados.

Los textos legales se leyeron solo para coherencia con capacidades; no se evaluó cumplimiento legal. Esta revisión no solicita actualizar dependencias, habilitar prototipos ni renovar la paleta. La propuesta visual general sigue reservada para el cierre acordado.

## Comprobaciones y límites

- Navegador local: lectura de áreas indicadas y medidas de tablas a 360 px; Ayuda a 320 px. Sin errores/advertencias de consola capturados. El formulario de acceso a auditoría se vio sin desbloquearlo. Usuarios y auxiliares no quedaron verificados visualmente.
- Funciones/esquemas originales ejecutados en memoria: JSON vacío, JSON solo de inventario, repetición de sueldo y cuatro validaciones inválidas. El script sustituye persistencia y no importa el cliente de Supabase. Resultado: `temp/resto-2026-10-06-reproducciones.json`; script reproducible `temp/revision-restante-2026-10-06.cjs`.
- Medidas y límites del navegador: `temp/resto-2026-10-06-navegador.json`; captura de recorte: `temp/resto-2026-10-06-reportes-mobile.png`. Son evidencias locales ignoradas por Git, no dependencias del programa.
- `data/store.json` conservó SHA-256 `19FA05D7758DB65EF8854D7DC143F26A55BBD2F8100EA9105B398CC5B2472CC9`; la copia habitual conservó `AF94DF15EC2DFC6A0CC3BBBD4802404168A1FC9C22B4ACF76C850A42E8FB336E`. El registro de errores del servidor local no añadió contenido.
- No se ejecutaron migraciones, importaciones/restauraciones reales, limpiezas, nóminas, cierres, guardados de configuración, invitaciones, cambios de roles o credenciales. No se visitó producción. Faltan la matriz completa de roles, políticas/triggers, fallos y recuperación conectados a Supabase en un entorno aislado.
- Solo se modifica documentación y el aviso obligatorio de versión; no se recompila ni publica. No corresponde repetir la suite completa para este diagnóstico. Las pruebas y publicación de 1.1.56 permanecen como evidencia anterior, no como pruebas nuevas de estos apartados.
- Comprobación de la entrega documental: nota 1.1.57 de 205 caracteres idéntica en aviso e historial, ESLint de `lib/app-version.ts` aprobado y diferencias sin errores de formato. Se conservan las notas y evidencias anteriores.

La revisión general pendiente tiene una base documentada, pero estos apartados aún requieren correcciones y comprobaciones proporcionales antes de declararlos terminados.
