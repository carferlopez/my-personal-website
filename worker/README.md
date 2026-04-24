# Contacto — Cloudflare Worker + Resend

Endpoint `POST /api/contact`: valida JSON, honeypot, tope 3 envíos/hora por IP (KV) y envía el correo vía [Resend](https://resend.com) con `fetch` (sin dependencias en el worker).

## Requisitos previos

- Cuenta en [Cloudflare](https://dash.cloudflare.com) y **dominio `carlosmakes.com` con DNS en Cloudflare** (para asociar la ruta `/api/contact` al worker). Si el DNS está fuera, tendrás que delegar o usar otra ruta; el worker puede desplegarse en `*.workers.dev` mientras pruebas.
- Cuenta en [Resend](https://resend.com), **dominio verificado** (p. ej. `carlosmakes.com`) y **API key** (no la subas nunca a git).
- Buzón de destino para recibir: edita `TO_EMAIL` en `wrangler.toml` o en Variables del worker.

## 1) Crear el KV (rate limit)

En la carpeta `worker/`:

```bash
cd worker
npx wrangler@latest login
npx wrangler@latest kv namespace create RATE_LIMIT
npx wrangler@latest kv namespace create RATE_LIMIT --preview
```

Copia los `id` y sustituye en `wrangler.toml` los valores `REEMPLAZA_CON_EL_ID_PRODUCCION` y `REEMPLAZA_CON_EL_ID_PREVIEW`.

## 2) Variables y secret

1. En `wrangler.toml`, ajusta:

   - `TO_EMAIL` → email donde quieres recibir (no hace falta que sea el mismo que `FROM_EMAIL`).
   - `FROM_EMAIL` → debe ser de un dominio **verificado en Resend** (p. ej. `contacto@carlosmakes.com`).

2. API key (solo vía wrangler, nunca en el archivo):

   ```bash
   npx wrangler@latest secret put RESEND_API_KEY
   ```

   Pega el valor cuando lo pida (no se verá al escribir).

3. (Opcional) Orígenes CORS extra en `[vars]`: `CORS_EXTRA = "https://otro-origen.com"`.

4. (Opcional) Probar en local: crea `worker/.dev.vars`:

   ```bash
   RESEND_API_KEY=re_xxxx
   ```

   y ejecuta:

   ```bash
   npx wrangler@latest dev
   ```

   El site estático abre con Live Server, por ejemplo en `http://127.0.0.1:5500` (ya permitido en CORS). El formulario en la web usa el mismo `origin` + `/api/contact` si sirves el HTML desde un servidor local; o prueba contra `https://carlosmakes.com/api/contact` fijando `window.__CONTACT_FORM_URL__` en consola si hace falta.

## 3) Desplegar el worker

```bash
cd worker
npx wrangler@latest deploy
```

## 4) Ruta pública: `carlosmakes.com/api/contact`

En **Cloudflare Dashboard** → **Workers & Pages** → tu worker **carlosmakes-com-contact** (o el nombre del proyecto) → **Triggers** → **Routes** → *Add route*:

- **Route** (según el panel): p. ej. `carlosmakes.com/api/contact*` o el patrón que use tu cuenta para path + zona.
- **Zone**: `carlosmakes.com`

Si usas el **mismo** dominio que ya tiene proxy naranja, el tráfico a `/api/contact` lo atiende el worker.

> Si prefieres no tocar el apex: puedes poner en `wrangler` un *workers.dev* (`*.workers.dev`) y en el `fetch` del front apuntar a esa URL; para producción lo normal es ruta bajo el dominio propio.

## Comprobación rápida

```bash
curl -X POST https://carlosmakes.com/api/contact \
  -H "Content-Type: application/json" \
  -H "Origin: https://carlosmakes.com" \
  -d '{"name":"Test","email":"a@b.com","topic":"otro","message":"Esto es un mensaje de al menos 20 letras","_gotcha":""}'
```

Debería responder `{"ok":true}` (si Resend acepta el `from` y la API key) o un error de Resend/validación con cuerpo JSON.

## Archivos

| Archivo         | Uso |
|----------------|-----|
| `src/index.js` | Lógica del worker |
| `wrangler.toml` | Nombre, KV, `FROM`/`TO` (sin `RESEND_API_KEY`) |
| `.dev.vars`     | **Local** secretos: gitignored |

## Dominio y Cloudflare

No puedo comprobar desde aquí si `carlosmakes.com` ya usa Cloudflare. Si el DNS aún no está allí, el paso 4 requiere **cambiar los nameservers** a Cloudflare o usar una alternativa (subdominio solo para API) documentada en su dashboard.
