# Carlos Site

Sitio personal estatico (HTML/CSS/JS en index.html), desplegado en Vercel (proyecto carlosmakes, deploy automatico con cada push a main). DNS y dominio (carlosmakes.com) gestionados en Cloudflare; el email (hola@carlosmakes.com) es Google Workspace.

## Contacto

El contacto es directo, sin backend. Email: hola@carlosmakes.com (enlaces mailto en el header y en la seccion de contacto). Redes: X e Instagram.

Nota: antes habia un formulario que enviaba a un Cloudflare Worker (/api/contact, via Resend). Se retiro para eliminar esa superficie de ataque, y el Worker (carlosmakes-contact) se ha eliminado de Cloudflare.

## Redireccion www a apex

https://www.carlosmakes.com redirige (301) a https://carlosmakes.com mediante la configuracion de dominios del proyecto en Vercel. Ya no depende de un Worker propio (el antiguo worker/www-redirect/ se ha retirado de Cloudflare).
