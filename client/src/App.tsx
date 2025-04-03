import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";
import { WebSocketProvider } from "./context/WebSocketContext";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";

// Pages
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import JoinSession from "@/pages/JoinSession";
import SessionRoom from "@/pages/SessionRoom";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/join/:sessionId?" component={JoinSession} />
      <Route path="/session/:sessionId" component={SessionRoom} />
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <WebSocketProvider>
            <Router />
            <Toaster />
          </WebSocketProvider>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
