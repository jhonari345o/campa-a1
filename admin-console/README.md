# Consola local de usuarios

Herramienta interna para crear usuarios de Supabase Auth y asignarlos a una
empresa del proyecto. El servidor escucha exclusivamente en `127.0.0.1`; no es
una ruta de Next.js y AWS Amplify no la publica.

## Configuracion

```powershell
Copy-Item admin-console/.env.example admin-console/.env.local
npm run admin:dev
```

Completar `admin-console/.env.local` con la URL de Supabase, la `service_role` y
una frase local de al menos 16 caracteres. Abrir despues:

```text
http://127.0.0.1:4177
```

La `service_role` permanece en el proceso Node local y nunca se entrega al
navegador. No compartir ese archivo ni subirlo a Git.
