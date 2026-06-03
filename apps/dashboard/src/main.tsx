import React from "react";
import ReactDOM from "react-dom/client";
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider, useAuthCredential } from "./auth-context";
import "./index.css";

const clientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string;

function Root() {
  const { credential, setCredential } = useAuthCredential();

  if (!credential) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <GoogleLogin
          onSuccess={(res) => {
            if (res.credential) setCredential(res.credential);
          }}
        />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={clientId}>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>,
);
