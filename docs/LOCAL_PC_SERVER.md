# Fight AI Web — servidor local en Windows

## Arquitectura activa

La beta web usa el PC Windows del propietario como runtime principal:

```text
Telefono / navegador
        -> Cloudflare Tunnel HTTPS (beta externa) o LAN
        -> Fight AI Web en el PC
        -> FFmpeg local (preparacion 0:00-3:00)
        -> Fight AI Hybrid Boxing Knowledge Engine
        -> Gemini API (clip preparado)
        -> reporte + evidencias JPEG locales
```

AWS queda como infraestructura historica/opcional. Los workflows AWS son manuales y no forman parte del arranque local.

## Inicio rapido

La primera vez, ejecuta `INSTALAR_Y_INICIAR_FIGHT_AI.cmd`.

Para uso normal existen dos rutas:

- `INICIAR_FIGHT_AI_LOCAL.cmd`: inicia solo el servidor local/LAN.
- `TODO_FIGHT_AI.bat`: actualiza `web/mvp`, construye, inicia Fight AI, valida health, crea el enlace Cloudflare externo y abre la beta en el navegador.

## Acceso directo de un clic en el Escritorio

Ejecuta una sola vez:

```text
CREAR_ACCESO_DIRECTO_FIGHT_AI.cmd
```

El script crea en el Escritorio un acceso directo llamado **Fight AI Beta**. También genera localmente `FightAI-Beta.ico`, un icono propio de Fight AI, y lo asigna al acceso directo.

Desde entonces, un doble clic en **Fight AI Beta** ejecuta `TODO_FIGHT_AI.bat` y realiza el flujo completo:

1. detiene de forma segura el túnel externo anterior;
2. detiene solo una instancia local verificada de Fight AI;
3. actualiza `web/mvp` mediante `git pull --ff-only` sin reset destructivo;
4. instala/valida dependencias y ejecuta `npm run build`;
5. inicia Fight AI y valida `/api/health`;
6. crea un túnel HTTPS temporal nuevo;
7. comprueba el acceso protegido;
8. abre la beta externa en el navegador.

El enlace `trycloudflare.com` es temporal y normalmente cambia al reiniciar el túnel.

## Seleccion de puerto local

El launcher busca el primer puerto disponible, en este orden:

```text
8787, 8788, 8790, 8899, 3002, 3003
```

No anuncia **Fight AI listo** solo porque un puerto parezca libre. Primero inicia Next.js y consulta `GET http://127.0.0.1:<PUERTO>/api/health`. La validacion exige simultaneamente:

- `service == "fight-ai-web"`
- `localMode == true`
- `analysisReady == true`

Si el puerto esta ocupado, Next no logra tomarlo o responde otra aplicacion, prueba el siguiente. Solo despues de validar guarda `.fight-ai-port` y `.fight-ai-pid` y muestra las URLs reales.

Con 8787 libre, abre:

- PC: `http://localhost:8787`
- telefono en LAN: `http://IP_LAN_DEL_PC:8787`

## Configuracion y actualizaciones seguras

Variables esperadas en `.env.local`:

```env
FIGHT_AI_RUNTIME=local
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.6-flash
FIGHT_AI_API_URL=
FIGHT_AI_REMOTE_USER=...
FIGHT_AI_REMOTE_PASSWORD=...
```

El instalador crea `.env.local` solo si no existe. Nunca reemplaza una `GEMINI_API_KEY` existente. `.env.local` esta ignorado por Git.

El flujo automatico conserva cambios locales rastreados y se niega a hacer una actualizacion destructiva. Si el unico cambio rastreado es `package-lock.json` generado por npm, puede restaurarlo antes del `pull`; cualquier otro cambio local obliga a resolverlo manualmente. No usa `git reset --hard`.

## Detener sin afectar otras aplicaciones

Ejecuta `DETENER_FIGHT_AI_LOCAL.cmd`. La parada:

1. lee `.fight-ai-port`;
2. vuelve a validar el health exacto de Fight AI;
3. exige que `.fight-ai-pid` sea el proceso Node.js que escucha ese puerto;
4. detiene solo ese PID.

Si cualquiera de esas comprobaciones falla, se niega a matar procesos. Esto protege otras aplicaciones locales aunque usen puertos cercanos.

Para cerrar solo el acceso externo usa `DETENER_ENLACE_EXTERNO.cmd`; Fight AI local sigue funcionando.

## Acceso desde el telefono y Firewall

Si funciona en el PC pero no desde el telefono en la misma red:

- configura la red de Windows como **Privada**;
- permite Node.js en Windows Firewall solo para redes privadas;
- confirma que ambos dispositivos esten en la misma LAN y que la Wi-Fi no aisle clientes;
- usa exactamente la URL LAN impresa por el launcher.

No abras ni redirijas los puertos de Fight AI en el router. Para beta externa usa Cloudflare Tunnel.

## Compartir fuera de la red

`COMPARTIR_FIGHT_AI.cmd` crea un enlace HTTPS temporal `*.trycloudflare.com` sin abrir puertos del router. El middleware exige `FIGHT_AI_REMOTE_USER` y `FIGHT_AI_REMOTE_PASSWORD` para cualquier hostname externo; si falta la contrasena, falla cerrado.

`VER_ACCESO_EXTERNO.cmd` muestra localmente el enlace y credenciales, sin exponer la clave Gemini. El enlace y la contrasena deben compartirse por canales separados cuando sea posible.

La beta externa sigue siendo una beta privada/supervisada. Un enlace temporal con usuario compartido no sustituye cuentas individuales, cuotas por usuario ni controles de produccion.

## Privacidad y flujo del video

En modo local el navegador envia el video al PC. Para videos grandes/remotos se transfiere en bloques y se conserva temporalmente una copia staged en el PC para:

- seleccionar al peleador con un JPEG compatible;
- ejecutar el analisis local asincrono;
- generar las capturas reales de evidencia del reporte sin volver a subir todo el video por Cloudflare.

FFmpeg prepara como maximo los primeros tres minutos. Solo el clip preparado de analisis se envia a Gemini. La copia staged se elimina cuando el usuario cambia/elimina el video o se limpia explicitamente la sesion; los clips intermedios se eliminan al finalizar o fallar.

Por eso la descripcion correcta de privacidad es: **el original se procesa y almacena temporalmente en el PC; el clip preparado para IA se envia a Gemini**.

## Analisis remoto sin timeout largo

La beta externa no mantiene una unica peticion abierta durante varios minutos. El navegador inicia un job local asincrono y consulta su estado periodicamente hasta recibir `complete` o `failed`. Esto evita depender de una conexion Cloudflare abierta durante todo el analisis.

## Health y trazabilidad

`GET /api/health` expone, entre otros campos:

- modo local;
- disponibilidad de Gemini;
- `analysisReady`;
- build SHA cuando esta disponible;
- version y numero de fuentes verificadas del Hybrid Boxing Knowledge Engine;
- politica `video-evidence-first`.
