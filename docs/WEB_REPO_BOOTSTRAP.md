# Fight AI Web — Repository Bootstrap

Documento de handoff para el repositorio separado de la versión web.

## Nombre recomendado

`fight-ai-web`

Owner esperado: `pinoaraj`

## Objetivo

Crear una beta web mobile-first que permita:

1. autenticación/perfil;
2. subida de videos de sparring;
3. selección/identificación del peleador objetivo;
4. procesamiento asíncrono;
5. análisis CV + Pose + Gemini;
6. reporte de coach con timestamps;
7. análisis del rival y estrategia;
8. Visual Coach;
9. reporte PDF descargable;
10. estado claro de fuentes/IA;
11. historial privado de sesiones.

## Arquitectura AWS inicial

- Frontend: Next.js
- Hosting: AWS Amplify o S3 + CloudFront
- API: FastAPI/NestJS detrás de HTTPS
- Storage: S3 privado con URLs prefirmadas
- Queue: SQS
- Metadata: PostgreSQL/RDS o Supabase durante beta
- Worker: ECS/Fargate/EC2 según costo y necesidades de CV
- Secrets: AWS SSM Parameter Store / Secrets Manager
- Logs: CloudWatch
- Auth: Cognito o proveedor existente
- PDF: generación backend o servicio del worker
- Gemini: key solo del lado servidor, nunca enviada al navegador

## Seguridad

- videos privados por defecto;
- objetos S3 no públicos;
- URLs prefirmadas con expiración;
- secretos fuera del repositorio;
- sin exposición directa del PC Windows;
- worker saliente/cola en vez de abrir puertos locales;
- borrar medios temporales según política de retención.

## Contrato de análisis

Mantener el mismo contrato que Android:

`evidence -> identity/re-id -> pose/CV -> combat rules -> patterns -> optional Gemini reasoning -> verification -> report`

Nunca inventar estadísticas de golpes cuando no existe evidencia suficiente.

## UI

Mobile-first, misma jerarquía del producto Android:

- takeaway corto;
- máximo 3 correcciones prioritarias;
- timestamps tocables;
- ajuste + drill + demo;
- rival / openings / plan de pelea;
- fortalezas;
- evidencia técnica expandible;
- PDF visual;
- banner de fuente exacto.

## Visual Coach / PDF

La versión web debe reutilizar las mejoras Android y evolucionarlas:

- flechas de trayectoria;
- línea de entrada/salida;
- pivote y ángulo;
- posición inicial/final;
- guard recovery;
- golpe rival -> reacción sugerida;
- secuencias 1 -> 2 -> 3;
- láminas exportables dentro del PDF.

## Orden de trabajo

1. Cerrar Android QA.
2. Crear repositorio separado `pinoaraj/fight-ai-web`.
3. Inicializar Next.js/TypeScript.
4. Definir schemas compartidos.
5. Infra AWS mínima.
6. Upload S3 + jobs.
7. Worker de análisis.
8. Render de reporte.
9. PDF.
10. E2E + agentes virtuales.
