import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn } from "@clerk/clerk-react";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

const pk = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={pk}>
      <SignedIn>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </ClerkProvider>
  </React.StrictMode>,
);
