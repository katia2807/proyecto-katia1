# Guía para el socio — Proyecto Katia

Documento breve para alinear expectativas de negocio. No requiere conocimientos de programación.

---

## 1. Qué es este proyecto

**Qué problema resuelve para el cliente**  
Un taller de madera suele llevar la plata, el stock, las ventas y los papeles en cuadernos, Excel sueltos o en la cabeza de una sola persona. Eso genera errores, olvidos y discusiones. Este sistema junta lo importante en un solo lugar en la web: caja, inventario, ventas, cotizaciones y registros, para que el dueño vea el negocio con orden y menos estrés.

**A quién va dirigido**  
Está pensado para un **taller de madera pequeño**, con **una a tres personas** trabajando (dueño más uno o dos de confianza). No es un sistema para una fábrica enorme ni para diez sucursales.

**Cómo genera dinero para nosotros**  
Se vende como **producto terminado** (la versión que acordamos con el cliente), con un **precio de licencia o entrega única** acordado por escrito. Los módulos extra que el cliente quiera después se cobran **aparte**, como ampliaciones del mismo producto.

---

## 2. Qué incluye la versión que entregamos (V1)

En la práctica, el cliente recibe acceso web a lo siguiente. Cada ítem es una parte del sistema que ya está activa en esta primera entrega:

| Módulo | En pocas palabras |
|--------|-------------------|
| **Inicio** | Resumen del día a día del negocio al entrar. |
| **Caja** | Anotar entradas y salidas de dinero. |
| **Inventario** | Productos, stock y movimientos. |
| **Ventas** | Flujos de venta (madera cortada, aserradero, muebles terminados, etc.). |
| **Muebles personalizados** | Pedidos a medida (versión simplificada). |
| **Cotización unificada** | Presupuestos formales en un solo flujo. |
| **Registro** | Hechos y anotaciones del negocio (versión simplificada). |
| **Alquiler mixer** | Contratos de alquiler del equipo (versión simplificada). |
| **Reportes** | Resúmenes y exportaciones básicas. |
| **Cuenta** | Perfil y contraseña del usuario. |
| **Empresa** | Datos del negocio, logo y ajustes de documentos. |
| **Respaldo** | Descargar copia de seguridad de la información. |
| **Usuarios** | Dueño y empleado de confianza con acceso controlado. |

**Precio de venta sugerido al cliente final:** **S/ 1,200** — **un solo pago** por la licencia de esta versión (sujeto al acuerdo comercial que firmen ustedes con el cliente).

**Forma de cobro recomendada:** **50% al firmar** el acuerdo o al iniciar la puesta en marcha, y **50% al entregar** la versión lista, capacitación hecha y el cliente usando el sistema en condiciones normales.

---

## 3. Qué no incluye y cuánto vale

Estas funciones **ya están programadas** dentro del mismo proyecto, pero en la V1 van **apagadas** en el menú. Si el cliente las quiere, se **activan** y se cobra un extra razonable, aparte del paquete base:

| Extra | Precio orientativo (activación) |
|-------|----------------------------------|
| Personal y nómina completa | S/ 200 |
| Control de socios y antifraude | S/ 200 |
| Seguridad avanzada | S/ 150 |
| Importación masiva de datos | S/ 150 |
| Cierre de mes | S/ 200 |

**Nota:** no es “volver a programar desde cero”: es **encender** lo que ya existe y, si hace falta, afinar detalles con el cliente.

---

## 4. Cómo actualizamos el programa

- **Tú** (quien programa) haces los cambios y los **subes** al lugar donde vive el proyecto (por ejemplo GitHub).
- **El socio** en su computadora solo corre, en orden: **`git pull`** (baja lo último) y luego **`npm run dev`** (abre el sistema en modo prueba en su máquina).
- Los cambios **no se pierden ni se borran** si se trabaja con disciplina: cada subida queda registrada y se puede volver a una versión anterior si hiciera falta.

---

## 5. Lecciones aprendidas (para no repetir errores)

1. **Definir el alcance con el cliente antes de empezar** — qué entra y qué no, por escrito. Evita “ya pero también quiero esto otro” a mitad de camino sin presupuesto.
2. **Documentar desde el día uno** qué módulos van en la entrega y cuáles son extra — mismo criterio para el socio y para el cliente final.
3. **Usar modo demo** — datos de prueba para enseñar y probar sin tocar la base de datos real del cliente hasta que esté todo validado.
4. **Subir cambios al repositorio con frecuencia** — así no se pierde trabajo si se rompe una computadora o hay un malentendido.
5. **Probar en la PC del socio (o del cliente piloto) antes de la reunión grande** — lo que funciona en una máquina a vecs falla por un detalle de instalación; mejor descubrirlo antes del “día de la verdad”.

---

## 6. Próximos pasos antes de entregar

1. **Conectar la base de datos real** (servicio tipo Supabase u otro acordado) cuando dejemos de usar solo demo.
2. **Pruebas con el cliente** — recorrer caja, una venta, una cotización e inventario con datos reales o muy parecidos a los reales.
3. **Firmar el acuerdo de alcance** — el documento **ALCANCE_V1.md** (o el contrato que reemplace) para que quede claro qué se pagó y qué no.
4. **Capacitar al dueño del taller y a su empleado** — pocos usuarios, en lenguaje simple, sin apuro.

---

## 7. Glosario empresarial

Términos que aparecen en el sistema o en las conversaciones con el cliente:

- **Cotización unificada** — Un solo presupuesto que puede incluir muebles, madera y alquiler de equipo, en un mismo documento profesional.
- **Correlativo** — Número único y automático que identifica un documento (por ejemplo **N° 0029**). Sirve para buscarlo después y para que el cliente lo cite en pagos o reclamos.
- **Kardex** — Historial de movimientos de inventario (entradas, salidas, ajustes) ligados a cada producto.
- **Cubicaje** — Cálculo del volumen de madera, en **pies tablares** o en **metros cúbicos**, según cómo trabaje el taller.
- **Aserradero** — Servicio de corte o trabajo industrial sobre la madera (cepillado, corte a medida, etc.), registrado como venta o servicio en el sistema.
- **Modo demo / datos de prueba** — Información ficticia o de ejemplo que imita la base real para enseñar el sistema y probar botones sin riesgo de borrar ventas verdaderas.

---

*Documento interno. Precios y condiciones finales quedan sujetos al contrato o cotización que firmen con cada cliente.*
