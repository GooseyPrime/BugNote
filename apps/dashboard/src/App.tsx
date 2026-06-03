import { Routes, Route } from "react-router-dom";
import { UserButton } from "@clerk/clerk-react";
import Inbox from "./pages/Inbox";
import ReportDetail from "./pages/ReportDetail";
import AppSidebar from "./components/AppSidebar";

export default function App() {
  return (
    <div className="flex h-screen bg-neutral-50 text-neutral-900">
      <AppSidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b px-4">
          <span className="font-medium">BugNote</span>
          <UserButton />
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
