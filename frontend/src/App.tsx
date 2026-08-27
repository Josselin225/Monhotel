import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import { trackingApi } from './api/tracking'

const DashboardPage     = lazy(() => import('./pages/DashboardPage'))
const RoomsPage         = lazy(() => import('./pages/RoomsPage'))
const BookingsPage      = lazy(() => import('./pages/BookingsPage'))
const ClientsPage       = lazy(() => import('./pages/ClientsPage'))
const BillingPage       = lazy(() => import('./pages/BillingPage'))
const PlanningPage      = lazy(() => import('./pages/PlanningPage'))
const ContentPage       = lazy(() => import('./pages/ContentPage'))
const UsersPage         = lazy(() => import('./pages/UsersPage'))
const CRMPage           = lazy(() => import('./pages/CRMPage'))
const ProfilePage       = lazy(() => import('./pages/ProfilePage'))
const HousekeepingPage  = lazy(() => import('./pages/HousekeepingPage'))
const AnalyticsPage     = lazy(() => import('./pages/AnalyticsPage'))
const PricingRulesPage  = lazy(() => import('./pages/PricingRulesPage'))
const SurveysPage       = lazy(() => import('./pages/SurveysPage'))
const SurveyFormPage    = lazy(() => import('./pages/SurveyFormPage'))
const AccountingPage    = lazy(() => import('./pages/AccountingPage'))
const MaintenancePage   = lazy(() => import('./pages/MaintenancePage'))
const AuditLogPage      = lazy(() => import('./pages/AuditLogPage'))
const SettingsPage      = lazy(() => import('./pages/SettingsPage'))
const MonthlyReportPage  = lazy(() => import('./pages/MonthlyReportPage'))
const FullReportPage     = lazy(() => import('./pages/FullReportPage'))
const DailyReportPage    = lazy(() => import('./pages/DailyReportPage'))
const RoomMapPage        = lazy(() => import('./pages/RoomMapPage'))
const BusinessCardPage   = lazy(() => import('./pages/BusinessCardPage'))
const InventoryPage      = lazy(() => import('./pages/InventoryPage'))
const StaffSchedulePage  = lazy(() => import('./pages/StaffSchedulePage'))
const PublicBookingPage  = lazy(() => import('./pages/PublicBookingPage'))
const MyBookingPage      = lazy(() => import('./pages/MyBookingPage'))
const GroupDashboardPage = lazy(() => import('./pages/GroupDashboardPage'))
const NotFoundPage       = lazy(() => import('./pages/NotFoundPage'))

function VisitTracker() {
  const location = useLocation()
  useEffect(() => {
    if (!location.pathname.startsWith('/app') && location.pathname !== '/login') {
      trackingApi.track(location.pathname, document.referrer)
    }
  }, [location.pathname])
  return null
}

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-hotel-gold border-t-transparent" />
    </div>
  )
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  return user ? <>{children}</> : <Navigate to="/login" replace />
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  return user?.role === 'admin' ? <>{children}</> : <Navigate to="/app" replace />
}

function ManagerRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  return (user?.role === 'admin' || user?.role === 'manager') ? <>{children}</> : <Navigate to="/app" replace />
}

function SuperuserRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  return user?.is_superuser ? <>{children}</> : <Navigate to="/app" replace />
}

function AppRoutes() {
  return (
    <>
    <VisitTracker />
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/app" element={
        <PrivateRoute>
          <Suspense fallback={<Spinner />}>
            <Layout />
          </Suspense>
        </PrivateRoute>
      }>
        <Route index element={<DashboardPage />} />
        <Route path="rooms" element={<RoomsPage />} />
        <Route path="bookings" element={<BookingsPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="planning" element={<PlanningPage />} />
        <Route path="content" element={<ContentPage />} />
        <Route path="crm" element={<CRMPage />} />
        <Route path="housekeeping" element={<HousekeepingPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="pricing" element={<AdminRoute><PricingRulesPage /></AdminRoute>} />
        <Route path="surveys" element={<SurveysPage />} />
        <Route path="accounting" element={<ManagerRoute><AccountingPage /></ManagerRoute>} />
        <Route path="maintenance" element={<MaintenancePage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="schedule" element={<StaffSchedulePage />} />
        <Route path="audit-log" element={<AdminRoute><AuditLogPage /></AdminRoute>} />
        <Route path="reports" element={<ManagerRoute><MonthlyReportPage /></ManagerRoute>} />
        <Route path="reports/full" element={<ManagerRoute><FullReportPage /></ManagerRoute>} />
        <Route path="daily-report" element={<DailyReportPage />} />
        <Route path="room-map" element={<RoomMapPage />} />
        <Route path="users" element={<AdminRoute><UsersPage /></AdminRoute>} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="carte-visite" element={<BusinessCardPage />} />
        <Route path="group-dashboard" element={<SuperuserRoute><GroupDashboardPage /></SuperuserRoute>} />
      </Route>
      <Route path="/booking" element={<Suspense fallback={<Spinner />}><PublicBookingPage /></Suspense>} />
      <Route path="/my-booking" element={<Suspense fallback={<Spinner />}><MyBookingPage /></Suspense>} />
      <Route path="/survey/:token" element={<Suspense fallback={<Spinner />}><SurveyFormPage /></Suspense>} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-right" richColors closeButton duration={4000} />
      </AuthProvider>
    </BrowserRouter>
  )
}
