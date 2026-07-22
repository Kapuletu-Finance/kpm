import { redirect } from "next/navigation";

export default function Home() {
  // Redirect root to the workspace (middleware will handle bouncing unauthenticated users to /login)
  redirect("/workspace");
}
