# Calculadora de electricidad · Monte Carlo

Página: https://mariarodme.github.io/CALCULADORA-ELECTRICIDAD-/

La calculadora permite crear una factura con vista previa, editarla en el historial, buscar por cliente o unidad, filtrar por mes y estado, registrar la fecha de pago, descargar un reporte mensual en Excel y cambiar entre español e inglés.

## Guardado

Sin iniciar sesión, las facturas se guardan solo en este navegador. Para verlas en varios dispositivos se utiliza el mismo proyecto Firebase que la página de feriados, pero una ruta privada independiente: `electricity/<uid>`. Los enlaces compartidos de feriados no conceden acceso a esta ruta.

Para habilitar el guardado en línea:

1. Abrir [Firebase Console](https://console.firebase.google.com/project/control-de-feriados/database/control-de-feriados-default-rtdb/rules).
2. En **Realtime Database → Reglas**, reemplazar las reglas actuales por el contenido **completo** de [database.rules.json](database.rules.json) y publicarlas. Este archivo conserva las reglas de feriados y agrega la ruta privada de electricidad.
3. Abrir la calculadora, pulsar **Entrar con Google** y usar la misma cuenta en los demás dispositivos.
4. Si hay facturas previas guardadas en el navegador, revisar el botón **Subir facturas de este dispositivo**. La importación conserva las facturas que ya están en línea.

El archivo de reglas en GitHub no modifica automáticamente las reglas activas en Firebase. Si aparece un error de permisos, revisar el paso 2. Los datos locales no se borran durante la importación.

## Archivos

- `index.html`: calculadora e interfaz bilingüe.
- `electricity-features.js` / `.css`: historial, vista previa, estados y reportes.
- `electricity-cloud.js`: sincronización privada con Google.
- `electricity-config.js`: configuración pública de Firebase; no contiene contraseñas.
- `electricity-xlsx.js`: creación de archivos Excel.
- `database.rules.json`: reglas que se deben publicar en Firebase.
- `sw.js`, `manifest.json`, `electricity-icon.svg`: instalación y uso sin conexión de los archivos de la página.
