import http from "k6/http";
import { sleep, check } from "k6";

export const options = {
  vus: 70, // 70 utilisateurs virtuels
  duration: "70s", // durée du test de 30 secondes
};

export default function () {
  const res = http.get("http://localhost:3000"); // Remplacez par l'URL de votre application
  check(res, {
    "status is 200": (r) => r.status === 200,
    'page contains "Chat Privé"': (r) => r.body.includes("Chat Privé"), // Adaptez au contenu de votre page d'accueil
  });
  sleep(1);
}
