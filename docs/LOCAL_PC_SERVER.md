# Fight AI Web — servidor local en Windows

## Objetivo

La beta web usa el PC del propietario como servidor principal para reducir el costo de infraestructura.

Ruta principal:

```text
Telefono / navegador
        |
        | Wi-Fi / LAN
        v
Fight AI Web (PC Windows, puerto 3000)
        |
        +--> FFmpeg local: recorte 0:00-3:00
        |
        +--> Fight AI Boxing Knowledge Engine
        |
        +--> Gemini API (solo clip preparado para analisis)
        |
        v
Reporte de coaching
```

AWS queda como infraestructura historica/opcional. El modo local no requiere S3, DynamoDB, ECS, ALB ni CloudFront.

## Privacidad del video

En modo local:

1. el navegador envia el video al PC;
2. Next.js lo guarda solo en un archivo temporal del sistema;
3. FFmpeg crea el clip de analisis de hasta tres minutos;
4. clips grandes se compactan localmente antes de Gemini;
5. el original temporal y el clip temporal se eliminan al terminar, tanto en exito como en error.

Gemini sigue recibiendo el clip necesario para el analisis. No afirmar que el video nunca sale del PC.

## Requisitos

- Windows 10/11
- Node.js 20 o superior
- npm
- FFmpeg disponible en PATH
- conexion a Internet para Gemini
- `GEMINI_API_KEY`

## Primera ejecucion

1. Ejecuta `INICIAR_FIGHT_AI_LOCAL.cmd`.
2. Si no existe, el script crea `.env.local` desde `.env.local.example`.
3. Abre `.env.local`.
4. Reemplaza `REEMPLAZA_CON_TU_API_KEY` por la API key real.
5. Ejecuta de nuevo `INICIAR_FIGHT_AI_LOCAL.cmd`.
6. El script instala dependencias si faltan, hace build y levanta Next.js en `0.0.0.0:3000`.

El terminal mostrara dos direcciones cuando sea posible:

- PC: `http://localhost:3000`
- telefono/LAN: `http://IP_DEL_PC:3000`

El telefono debe estar en la misma red local.

## Detener

Ejecuta `DETENER_FIGHT_AI_LOCAL.cmd` o usa Ctrl+C en la terminal del servidor.

## Variables

```env
FIGHT_AI_RUNTIME=local
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.6-flash
FIGHT_AI_API_URL=
```

En modo `local`, `FIGHT_AI_API_URL` se ignora para evitar delegar por accidente a un backend cloud antiguo.

## Flujo de analisis local

La web usa `POST /api/analyze` directamente en modo local. El servidor:

- recibe el archivo desde la LAN;
- crea una copia temporal;
- hace stream-copy de los primeros tres minutos;
- si el clip supera 45 MB, hace un unico fallback H.264 540p;
- sube ese clip a Gemini Files;
- recupera fundamentos relevantes desde la base Fight AI;
- pide a Gemini validar/descartar esos fundamentos usando el video;
- construye el reporte;
- elimina los temporales.

## Acceso externo

No abrir el puerto 3000 directamente en el router. Para pruebas fuera de la casa/oficina se debe agregar un tunel HTTPS autenticado (por ejemplo Cloudflare Tunnel) como etapa separada.
