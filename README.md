# Carlos Site

Sitio personal estático (HTML/CSS/JS en `index.html`), desplegado en GitHub Pages
(dominio `carlosmakes.com` vía `CNAME`).

## Contacto

El contacto es directo, sin backend:

- Email: **hola@carlosmakes.com** (enlaces `mailto:` en el header y en la sección de contacto).
- Redes: X e Instagram.

> Antes había un formulario que enviaba a un Cloudflare Worker (`/api/contact`, vía Resend).
> Se retiró para eliminar esa superficie de ataque. Si el Worker sigue desplegado en
> Cloudflare, conviene borrarlo: `cd worker` (en una copia anterior) y `npx wrangler delete`,
> o eliminarlo desde el panel de Cloudflare.

## Worker de redirección (se mantiene)

`worker/www-redirect/` es un Worker mínimo que hace 301 de `https://www.carlosmakes.com/*`
al ápex `https://carlosmakes.com` (mismo path y query), para que el host canónico sea el ápex.

```bash
npm run deploy:www-redirect
```
