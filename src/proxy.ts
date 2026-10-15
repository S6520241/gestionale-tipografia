// =============================================================================
// proxy.ts — il "portinaio" del sito
// =============================================================================
// In Next.js 16 il "proxy" (prima si chiamava "middleware") gira prima di ogni
// pagina. Qui usa auth() di src/auth.ts, che chiama il controllo authorized():
// senza login si finisce su /login, con una password temporanea su /profilo.

export { auth as proxy } from "@/auth";

export const config = {
  // Su quali indirizzi gira: tutti tranne le API di Auth.js, i file statici
  // di Next.js e le icone (che devono caricarsi anche nella pagina di login).
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
