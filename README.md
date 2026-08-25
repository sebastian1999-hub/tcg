# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

# TradingCardGueb

Demo de biblioteca de Magic: The Gathering y mercado de intercambios. Incluye registro, inicio de sesion, perfiles, cartas de biblioteca y publicaciones de trade mediante Supabase.

## Desarrollo local

```bash
npm install
npm run dev
```

La configuracion local de Supabase se lee desde `.env.local`. Solo debe contener la URL del proyecto y la clave publicable; el archivo no se sube al repositorio.

## Activar Supabase

La migracion de la demo esta en `supabase/migrations/20260825_create_tradingcard_demo.sql`. Crea perfiles, bibliotecas, cartas deseadas y politicas RLS.

1. Instala o ejecuta la CLI: `npx supabase login`.
2. Enlaza el proyecto: `npx supabase link --project-ref ilotxnislcnqjhfquzyw`.
3. Cuando la CLI pida la contrasena de base de datos, escribela directamente en la terminal.
4. Aplica el esquema: `npx supabase db push`.
5. En Supabase Dashboard, revisa Authentication > Providers y habilita Email. Para una prueba rapida con un grupo cerrado, desactiva temporalmente la confirmacion de email o confirma cada registro desde el correo recibido.

Tras iniciar sesion, las cartas importadas y las publicadas para trade se guardan en `collection_cards`. Las cartas publicadas son legibles por otros usuarios autenticados, mientras que las demas filas quedan protegidas por RLS.

## Seguridad

No incluyas nunca una clave `secret`, `service_role`, token personal ni cadena de conexion de Postgres en archivos `VITE_*`, en el frontend o en el repositorio. Si alguna credencial privilegiada se ha compartido fuera de un gestor de secretos, revocala y genera una nueva desde Supabase Dashboard.
