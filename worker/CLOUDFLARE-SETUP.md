# Cloudflare: despliegue (www → apex y formulario de contacto)

## Contacto: `POST /api/contact` (Resend) — arregla el error **405** en el formulario

Si al enviar el formulario ves `405` en `https://carlosmakes.com/api/contact`, el worker de contacto **no** está enlazado a esa ruta. El `wrangler.toml` en `worker/` ya incluye la ruta; falta desplegar este worker (es **otro** distinto de `www-redirect`).

En la terminal:

```bash
cd ~/developer/Carlos-site-main/worker
npx wrangler@latest secret put RESEND_API_KEY
```

(Pega la API key de Resend cuando lo pida; no se mostrará al escribir.)

```bash
npx wrangler@latest deploy
```

Ajusta `TO_EMAIL` en `wrangler.toml` si quieres otra bandeja; luego vuelve a `deploy` si la cambias.

Prueba:

```bash
curl -X POST "https://carlosmakes.com/api/contact" \
  -H "Content-Type: application/json" \
  -H "Origin: https://carlosmakes.com" \
  -d '{"name":"Test","email":"a@b.com","topic":"otro","message":"Esto supera veinte caracteres.","_gotcha":""}'
```

Debería responder `{"ok":true}` o un error JSON de Resend/validación (pero no 405).

---

# Redirect: `www` → apex

Desde este entorno no puedo usar tu sesión de Cloudflare. Tienes dos formas de desplegar.

## Opción A — Un solo comando en tu Mac (rápido)

```bash
cd worker/www-redirect
npx wrangler@latest login
npx wrangler@latest deploy
```

`login` abre el navegador una vez. El `wrangler.toml` ya incluye la ruta `www.carlosmakes.com/*` en la zona `carlosmakes.com`.

Comprueba:

```bash
curl -sI "https://www.carlosmakes.com/" | head -3
```

Deberías ver `301` y `location: https://carlosmakes.com/`.

## Opción B — GitHub Actions (sin instalar Wrangler local)

1. En Cloudflare → **My Profile** → **API Tokens** → **Create token** → plantilla **Edit Cloudflare Workers** o permisos manuales:
   - **Account** — Workers Scripts — Edit  
   - **Zone** — Workers Routes — Edit (y Zone — Read) para `carlosmakes.com`
2. Copia el token. En Cloudflare → **Workers & Pages** → la barra lateral o **Account details** muestra el **Account ID**.
3. En GitHub → tu repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:
   - `CLOUDFLARE_API_TOKEN` = el token  
   - `CLOUDFLARE_ACCOUNT_ID` = tu Account ID  
4. En **Actions** → workflow **Deploy www redirect worker** → **Run workflow**.

Tras un push a `main` que toque `worker/www-redirect/`, el workflow también se ejecuta solo.

## Si el deploy falla por “zone”

Comprueba que el dominio `carlosmakes.com` esté en la **misma cuenta** de Cloudflare que el token y que el **DNS** de `www` esté en esa zona (proxy naranja habitual).
