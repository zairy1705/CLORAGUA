# ClorAgua · Gestión y Dosificación de Agua Segura

Calculadora y asistente técnico para dosificación de cloro, cálculo de volumen de tanques y verificación de cloro residual libre en campo.

## Despliegue en Vercel

El proyecto incluye la configuración lista en `vercel.json` y el script de compilación `npm run build`.

### Opción 1: Conectar mediante GitHub (Recomendado)
1. En Google AI Studio, abre el menú superior derecho y selecciona **Export to GitHub** (o descarga el proyecto en formato ZIP).
2. Ve a [Vercel](https://vercel.com/) e inicia sesión.
3. Haz clic en **"Add New..."** > **"Project"**.
4. Selecciona tu repositorio de GitHub recién exportado.
5. Vercel detectará automáticamente `vercel.json` y compilará la carpeta `dist`. Haz clic en **"Deploy"**.

### Opción 2: Despliegue mediante Vercel CLI
Si tienes el código localmente en tu computadora:
```bash
npm install -g vercel
vercel
```

