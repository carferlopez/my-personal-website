# Carlos Site + Resend (secure setup)

## 1) Configure environment variables

Copy `.env.example` to `.env` and replace the API key placeholder:

```bash
cp .env.example .env
```

Replace `re_xxxxxxxxx` with your real key in `.env`.

## 2) Run the server

```bash
npm run dev
```

This serves your site and exposes the same path as production:

- `POST /api/contact` (alias: `POST /api/send-email`)

## 3) Test the Resend endpoint

```bash
curl -X POST http://localhost:3000/api/contact \
  -H "Content-Type: application/json" \
  -d '{"name":"Carlos","email":"hola@carlosmakes.com","topic":"consulta","message":"Hola Carlos, me gustaría hablar de un proyecto en detalle.","_gotcha":""}'
```

## Notes

- Keep `.env` private; it is ignored via `.gitignore`.
- Email sending must happen server-side, not in browser JavaScript.
- The live site uses the Cloudflare Worker at `https://carlosmakes.com/api/contact`. The form posts to that URL even when the page is served from `www`, because the static layer on `www` often does not run the Worker and returns 405 for `POST` to `/api/contact`.
- Local `npm run dev` uses `http://localhost:PORT/api/contact`.
- `resend-example.js` is kept as a standalone script if you want to run a direct test with Node.
- Anti-spam protections included: IP rate limit, cooldown, honeypot field, minimum form fill time, server-side validation.
