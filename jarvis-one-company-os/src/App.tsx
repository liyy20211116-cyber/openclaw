import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import './App.css'
import { ShellLayout } from './components/ShellLayout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AgentsPage } from './pages/AgentsPage'
import { ApprovalsPage } from './pages/ApprovalsPage'
import { AuditPage } from './pages/AuditPage'
import { CeoChatPage } from './pages/CeoChatPage'
import { CEOActionBoundaryPage } from './pages/CEOActionBoundaryPage'
import { CommercializationPage } from './pages/CommercializationPage'
import { DashboardPage } from './pages/DashboardPage'
import { DailyCompanyRunPage } from './pages/DailyCompanyRunPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { PlaybookPage } from './pages/PlaybookPage'
import { ProfitabilityPage } from './pages/ProfitabilityPage'
import { OfficePage } from './pages/OfficePage'
import { MagicOfficePage } from './pages/MagicOfficePage'
import { OpportunitiesPage } from './pages/OpportunitiesPage'
import { OpportunityIntakePage } from './pages/OpportunityIntakePage'
import { OffersPage } from './pages/OffersPage'
import { RevenuesPage } from './pages/RevenuesPage'
import { RevenueConfirmationPage } from './pages/RevenueConfirmationPage'
import { RuntimePage } from './pages/RuntimePage'
import { SalesPipelinePage } from './pages/SalesPipelinePage'
import { StorePage } from './pages/StorePage'
import { TasksPage } from './pages/TasksPage'
import { TreasuryPage } from './pages/TreasuryPage'
import { SettingsPage } from './pages/SettingsPage'
import { WorkflowsPage } from './pages/WorkflowsPage'
import { loadAppConfig } from './services/configService'

function Guarded({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>
}

function App() {
  useEffect(() => { loadAppConfig() }, [])
  return (
    <Routes>
      <Route path="/" element={<ShellLayout />}>
        <Route index element={<Guarded><DashboardPage /></Guarded>} />
        <Route path="runtime" element={<Guarded><RuntimePage /></Guarded>} />
        <Route path="daily-run" element={<Guarded><DailyCompanyRunPage /></Guarded>} />
        <Route path="office" element={<Guarded><OfficePage /></Guarded>} />
        <Route path="magic-office" element={<Guarded><MagicOfficePage /></Guarded>} />
        <Route path="opportunities" element={<Guarded><OpportunitiesPage /></Guarded>} />
        <Route path="opportunity-intake" element={<Guarded><OpportunityIntakePage /></Guarded>} />
        <Route path="offers" element={<Guarded><OffersPage /></Guarded>} />
        <Route path="sales" element={<Guarded><SalesPipelinePage /></Guarded>} />
        <Route path="workflows" element={<Guarded><WorkflowsPage /></Guarded>} />
        <Route path="agents" element={<Guarded><AgentsPage /></Guarded>} />
        <Route path="tasks" element={<Guarded><TasksPage /></Guarded>} />
        <Route path="approvals" element={<Guarded><ApprovalsPage /></Guarded>} />
        <Route path="action-boundary" element={<Guarded><CEOActionBoundaryPage /></Guarded>} />
        <Route path="onboarding" element={<Guarded><OnboardingPage /></Guarded>} />
        <Route path="commercialization" element={<Guarded><CommercializationPage /></Guarded>} />
        <Route path="treasury" element={<Guarded><TreasuryPage /></Guarded>} />
        <Route path="store" element={<Guarded><StorePage /></Guarded>} />
        <Route path="revenues" element={<Guarded><RevenuesPage /></Guarded>} />
        <Route path="revenue-confirmation" element={<Guarded><RevenueConfirmationPage /></Guarded>} />
        <Route path="audit" element={<Guarded><AuditPage /></Guarded>} />
        <Route path="ceo-chat" element={<Guarded><CeoChatPage /></Guarded>} />
        <Route path="profitability" element={<Guarded><ProfitabilityPage /></Guarded>} />
        <Route path="playbook" element={<Guarded><PlaybookPage /></Guarded>} />
        <Route path="settings" element={<Guarded><SettingsPage /></Guarded>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App
