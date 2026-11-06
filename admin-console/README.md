# Consola local de usuarios y credenciales

Herramienta interna para crear usuarios de Supabase Auth, asignarlos a una
empresa y rotar las credenciales externas de AWS Amplify. El servidor escucha
exclusivamente en `127.0.0.1`; no es una ruta de Next.js y AWS Amplify no la
publica.

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

La `service_role` y las credenciales AWS permanecen en el proceso Node local y
nunca se entregan al navegador. No compartir ese archivo ni subirlo a Git.

## Permisos AWS mínimos

Usa un perfil o usuario IAM exclusivo para esta consola. Necesita únicamente:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "amplify:GetApp",
      "amplify:UpdateApp",
      "amplify:GetBranch",
      "amplify:UpdateBranch",
      "amplify:StartJob"
    ],
    "Resource": "arn:aws:amplify:us-east-1:TU_CUENTA:apps/djk125z43ran7*"
  }]
}
```

La pestaña **Credenciales** permite rotar OpenRouter, dLocal Go, Meta y Google
Maps. Nunca muestra el valor existente: solo indica si está configurado. Cada
cambio conserva las demás variables de Amplify, registra localmente qué nombres
se cambiaron (sin valores) y lanza un despliegue de la rama de producción.

### Asistente de conexión Meta

El bloque **Meta Ads y línea de crédito** trabaja en cuatro pasos:

1. recibe temporalmente un token de sistema o de larga duración;
2. consulta Meta en modo de solo lectura para descubrir cuentas publicitarias,
   páginas, Instagram profesional y permisos concedidos;
3. permite seleccionar los activos y exige confirmar que la cuenta publicitaria
   tiene la línea de crédito o método de pago de la empresa correcta;
4. vuelve a validar los activos, guarda las variables en Amplify y despliega.

La línea de crédito no se mueve ni se crea mediante la API. Meta factura a la
cuenta publicitaria seleccionada según la configuración de Business Manager. El
asistente no devuelve el token, datos de facturación ni secretos existentes.

Guardar una credencial no habilita `COMMERCIAL_PAYMENTS_ENABLED`,
`META_PAUSED_DRAFTS_ENABLED` ni `META_REAL_SPEND_ENABLED`. Esos interruptores se
mantienen separados para impedir cobros o gasto accidental.
