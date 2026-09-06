# Oryndel: Crown of Embers

RPG de historia en pixel art. Explora el reino de Oryndel, habla con sus habitantes, entra en bosques y ruinas, y descubre el secreto de la Corona de Brasas.

## Características

- Historia original de fantasía medieval
- Mapa en vista de pájaro + niveles de plataformas
- Combate, enemigos que patrullan y persiguen, power-ups
- Guardado en la nube (Supabase)
- Compatible con PC y móvil (controles táctiles)

## Capítulos actuales

1. **Valle de Bruma** — la aldea de origen
2. **Bosque de los Susurros** — primer nivel de plataformas

## Auth y variables de entorno (Render)

En Render → Environment añade:

```
SUPABASE_URL=https://eqvxurybiaroxkiwtodc.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxdnh1cnliaWFyb3hraXd0b2RjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2ODI4MTIsImV4cCI6MjEwNDI1ODgxMn0.UcTOxpCXKOeZwNTcV--lD7sy_aCa3iSbnz8lWfbqiuA
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui
PORT=10000
```

La **service_role** la encuentras en Supabase → Project Settings → API → `service_role` (secret).

También recomienda en Supabase → Authentication → Providers → Email:
- Desactivar "Confirm email" mientras pruebas (o déjalo y confirma los correos).

## Deploy

Docker en Render (Environment = Docker). El Dockerfile ya está en el repo.

## Controles

**PC:** WASD / flechas · E hablar · Espacio saltar · Z atacar  
**Móvil:** pad virtual + botones en pantalla
