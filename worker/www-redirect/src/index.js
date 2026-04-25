/**
 * 301: www.carlosmakes.com → https://carlosmakes.com (misma ruta y query).
 * Despliega con su propia ruta; no sustituye al worker de /api/contact.
 */
export default {
  async fetch(request) {
    const u = new URL(request.url);
    u.protocol = "https:";
    u.hostname = "carlosmakes.com";
    u.port = "";
    return Response.redirect(u.toString(), 301);
  },
};
