import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';

// Customer Layout & Pages
import { CustomerLayout } from './components/layout/CustomerLayout';
import { HomePage } from './pages/customer/HomePage';
import { AllProductsPage } from './pages/customer/AllProductsPage';
import { CategoryPage } from './pages/customer/CategoryPage';
import { ProductDetailsPage } from './pages/customer/ProductDetailsPage';
import { CartPage } from './pages/customer/CartPage';
import { WishlistPage } from './pages/customer/WishlistPage';
import { CheckoutPage } from './pages/customer/CheckoutPage';
import { OrderConfirmationPage } from './pages/customer/OrderConfirmationPage';
import { LoginPage } from './pages/customer/LoginPage';
import { RegisterPage } from './pages/customer/RegisterPage';
import { ForgotPasswordPage } from './pages/customer/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/customer/ResetPasswordPage';
import { DashboardPage } from './pages/customer/DashboardPage';
import { ProfilePage } from './pages/customer/ProfilePage';
import { OrdersPage } from './pages/customer/OrdersPage';
import { RewardsPage } from './pages/customer/RewardsPage';
import { AddressesPage } from './pages/customer/AddressesPage';
import { InvoicePage } from './pages/customer/InvoicePage';
import { NotFoundPage } from './pages/NotFoundPage';

// Admin Layout & Pages
import { AdminLayout } from './components/layout/AdminLayout';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminOverviewPage } from './pages/admin/AdminOverviewPage';
import { AdminProductsPage } from './pages/admin/AdminProductsPage';
import { AdminCategoriesPage } from './pages/admin/AdminCategoriesPage';
import { AdminInventoryPage } from './pages/admin/AdminInventoryPage';
import { AdminOrdersPage } from './pages/admin/AdminOrdersPage';
import { AdminRefundsPage } from './pages/admin/AdminRefundsPage';
import { AdminCustomersPage } from './pages/admin/AdminCustomersPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';
import { AdminRewardsPage } from './pages/admin/AdminRewardsPage';
import { AdminDeliveryPage } from './pages/admin/AdminDeliveryPage';
import { AdminAdvertisementsPage } from './pages/admin/AdminAdvertisementsPage';

// Error Boundary
import { ErrorBoundary } from './components/common/ErrorBoundary';

// Route Guards
import { ProtectedRoute } from './routes/ProtectedRoute';
import { AdminRoute } from './routes/AdminRoute';

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <WishlistProvider>
              <CartProvider>
                <Routes>
                {/* Customer Facing Routes */}
                <Route path="/" element={<CustomerLayout />}>
                  <Route index element={<HomePage />} />
                  <Route path="products" element={<AllProductsPage />} />
                  <Route path="category/:slug" element={<CategoryPage />} />
                  <Route path="product/:id" element={<ProductDetailsPage />} />
                  <Route path="cart" element={<CartPage />} />
                  <Route path="wishlist" element={<WishlistPage />} />
                <Route
                  path="checkout"
                  element={
                    <ProtectedRoute>
                      <CheckoutPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="order-confirmation/:orderNumber" element={<OrderConfirmationPage />} />
                
                {/* Auth Routes */}
                <Route path="login" element={<LoginPage />} />
                <Route path="register" element={<RegisterPage />} />
                <Route path="forgot-password" element={<ForgotPasswordPage />} />
                <Route path="reset-password" element={<ResetPasswordPage />} />

                {/* Protected Customer Routes */}
                <Route
                  path="dashboard"
                  element={
                    <ProtectedRoute>
                      <DashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="profile"
                  element={
                    <ProtectedRoute>
                      <ProfilePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="orders"
                  element={
                    <ProtectedRoute>
                      <OrdersPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="orders/:orderIdOrNumber/invoice"
                  element={
                    <ProtectedRoute>
                      <InvoicePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="rewards"
                  element={
                    <ProtectedRoute>
                      <RewardsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="addresses"
                  element={
                    <ProtectedRoute>
                      <AddressesPage />
                    </ProtectedRoute>
                  }
                />

                {/* 404 Catch All */}
                <Route path="*" element={<NotFoundPage />} />
              </Route>

              {/* Admin Public Authentication Entry */}
              <Route path="/admin/login" element={<AdminLoginPage />} />

              {/* Protected Admin Console Routes */}
              <Route
                path="/admin"
                element={
                  <AdminRoute>
                    <AdminLayout />
                  </AdminRoute>
                }
              >
                <Route index element={<AdminOverviewPage />} />
                <Route path="dashboard" element={<AdminOverviewPage />} />
                <Route path="advertisements" element={<AdminAdvertisementsPage />} />
                <Route path="products" element={<AdminProductsPage />} />
                <Route path="categories" element={<AdminCategoriesPage />} />
                <Route path="inventory" element={<AdminInventoryPage />} />
                <Route path="orders" element={<AdminOrdersPage />} />
                <Route path="delivery" element={<AdminDeliveryPage />} />
                <Route path="rewards" element={<AdminRewardsPage />} />
                <Route path="refunds" element={<AdminRefundsPage />} />
                <Route path="customers" element={<AdminCustomersPage />} />
                <Route path="settings" element={<AdminSettingsPage />} />
              </Route>

              {/* Standalone Admin Invoice Print & Download View */}
              <Route
                path="/admin/orders/:orderIdOrNumber/invoice"
                element={
                  <AdminRoute>
                    <InvoicePage />
                  </AdminRoute>
                }
              />

              {/* Catch-all fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
              </CartProvider>
            </WishlistProvider>
          </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </ErrorBoundary>
);
};

export default App;
