import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import DashboardLayout from "./components/DashboardLayout";
import EngineConfig from "./pages/EngineConfig";
import AccessControl from "./pages/AccessControl";
import Scheduler from "./pages/Scheduler";
import AutoDelete from "./pages/AutoDelete";
import LiveFeed from "./pages/LiveFeed";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<EngineConfig />} />
            <Route path="/access" element={<AccessControl />} />
            <Route path="/scheduler" element={<Scheduler />} />
            <Route path="/auto-delete" element={<AutoDelete />} />
            <Route path="/live-feed" element={<LiveFeed />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
