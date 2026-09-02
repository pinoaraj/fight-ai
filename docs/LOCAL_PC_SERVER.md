# Fight AI Web — servidor local en Windows

## Arquitectura activa

La beta web usa el PC Windows del propietario como runtime principal:

```text
Telefono / navegador en la misma LAN
        -> Fight AI Web en el PC
        -> FFmpeg local (preparacion 0:00-3:00)
        -> Fight AI Boxing Knowledge Engine
        -> Gemini API (clip preparado)
        -> reporte
```

AWS queda como infraestructura historica/opcional. Los workflows AWS son manuales y no forman parte del arranque local.

## Inicio rapido

La primera vez, ejecuta `INSTALAR_Y_INICIAR_FIGHT_AI.cmd`. Para ejecuciones posteriores usa `INICIAR_FIGHT_AI_LOCAL.cmd`.

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
- telefono: `http://IP_LAN_DEL_PC:8787`

El launcher imprime la IP LAN detectada. El PC y el telefono deben estar en la misma Wi-Fi/LAN.

## Configuracion y actualizaciones seguras

Variables esperadas en `.env.local`:

```env
FIGHT_AI_RUNTIME=local
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.6-flash
FIGHT_AI_API_URL=
```

El instalador crea `.env.local` solo si no existe. Nunca reemplaza una `GEMINI_API_KEY` existente. `.env.local` esta ignorado por Git.

Cuando encuentra un repo existente, verifica que `origin` sea `pinoaraj/fight-ai`. Si hay cambios locales rastreados, los conserva y omite la actualizacion automatica. Si un archivo generado no rastreado choca con el remoto, solo lo reemplaza cuando ambos contenidos tienen el mismo hash; si difieren, cancela sin tocarlo. Con un arbol limpio usa `fetch`, cambia a `web/mvp` y aplica solamente `pull --ff-only`; nunca ejecuta `reset` ni descarta cambios.

## Detener sin afectar otras aplicaciones

Ejecuta `DETENER_FIGHT_AI_LOCAL.cmd`. La parada:

1. no usa un puerto por defecto;
2. lee `.fight-ai-port`;
3. vuelve a validar el health exacto de Fight AI;
4. exige que `.fight-ai-pid` sea el proceso Node.js que escucha ese puerto;
5. detiene solo ese PID.

Si cualquiera de esas comprobaciones falla, se niega a matar procesos. Esto protege aplicaciones como Medical Platform o Medical SaaS aunque usen otros puertos locales.

## Acceso desde el telefono y Firewall

Si funciona en el PC pero no desde el telefono:

- configura la red de Windows como **Privada**;
- permite Node.js en Windows Firewall solo para redes privadas;
- confirma que ambos dispositivos esten en la misma LAN y que la Wi-Fi no aisle clientes;
- usa exactamente la URL LAN impresa por el launcher.

No abras ni redirijas 8787 (ni ningun puerto de la lista) en el router. El servidor local no debe exponerse directamente a Internet.

## Compartir fuera de la red

Para una prueba externa ejecuta `COMPARTIR_FIGHT_AI.cmd`. Requiere `cloudflared` y crea un enlace HTTPS temporal `*.trycloudflare.com` sin abrir puertos del router. El middleware exige `FIGHT_AI_REMOTE_USER` y `FIGHT_AI_REMOTE_PASSWORD` para cualquier hostname externo; si falta la contrasena, falla cerrado con HTTP 503.

Envia el enlace y las credenciales por canales separados. `DETENER_ENLACE_EXTERNO.cmd` detiene solamente el PID de `cloudflared`; el servidor LAN sigue activo. El enlace cambia al reiniciar y es solo para pruebas. El proxy gratuito limita cada solicitud a 100 MB, por lo que videos mayores requieren un futuro flujo local por partes o un servicio permanente adecuado.

## Privacidad y flujo del video

En modo local el navegador envia el video al PC. Next.js lo guarda temporalmente, FFmpeg prepara hasta los primeros tres minutos y usa stream-copy como ruta rapida; si el clip sigue siendo grande aplica el fallback H.264 540p. Solo el clip preparado se envia a Gemini. El original y el clip temporales se eliminan al terminar o fallar. Por eso no se debe afirmar que todo el video permanece siempre dentro del PC.

La web llama `POST /api/analyze` directamente; `FIGHT_AI_API_URL` se ignora en modo local para no delegar accidentalmente al backend cloud historico.
