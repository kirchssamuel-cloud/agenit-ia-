import { redirect } from "next/navigation";

// La home redirige selon l'auth :
// - Pas connecté → /landing (page publique de marketing)
// - Connecté → /dashboard
// Le middleware gère la redirection vers /login si pas auth ET tentative d'accès admin.
// Pour faire simple ici on envoie tout le monde sur /dashboard ; le middleware redirige
// les non-authentifiés vers /login.
export default function Home() {
  redirect("/dashboard");
}
