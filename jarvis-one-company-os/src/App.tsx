import { Navigate, Route, Routes } from 'react-router'
import './App.css'
import { ShellLayout } from './components/ShellLayout'
import { AgentsPage } from './pages/AgentsPage'
import { ApprovalsPage } from './pages/ApprovalsPage'
import { AuditPage } from './pages/AuditPage'
import { CeoChatPage } from './pages/CeoChatPage'
import { DashboardPage } from './pages/DashboardPage'
import { PlaybookPage } from './pages/PlaybookPage'
import { RevenuesPage } from './pages/RevenuesPage'
import { StorePage } from './pages/StorePage'
import { TasksPage } from './pages/TasksPage'
import { TreasuryPage } from './pages/TreasuryPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<ShellLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="agents" element={<AgentsPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="approvals" element={<ApprovalsPage />} />
        <Route path="treasury" element={<TreasuryPage />} />
        <Route path="store" element={<StorePage />} />
        <Route path="revenues" element={<RevenuesPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="ceo-chat" element={<CeoChatPage />} />
        <Route path="playbook" element={<PlaybookPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App
