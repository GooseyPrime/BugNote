import { Routes, Route } from "react-router-dom";
import { useAuthCredential } from "./auth-context";
import Inbox from "./pages/Inbox";
import ReportDetail from "./pages/ReportDetail";
import AppSidebar from "./components/AppSidebar";

export default function App() {
  const { clearCredential } = useAuthCredential();

  return (
    <div className="flex h-screen bg-neutral-50 text-neutral-900">
      <AppSidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b px-4">
          <span className="font-medium">BugNote</span>
          <button
            type="button"
            className="text-sm text-neutral-600 hover:text-neutral-900"
            onClick={() => clearCredential()}
          >
            Sign out
          </button>
        </header>
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Inbox />} />
            <Route path="/app/:appId" element={<Inbox />} />
            <Route path="/report/:id" element={<ReportDetail />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
