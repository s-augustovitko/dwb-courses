import { Route, Router } from "@solidjs/router";
import { type Component, lazy } from "solid-js";
import { ErrorLoadingWrapper, Toast } from "~/components/layout";
import NotFound from "~/routes/404View";
import PublicLayout from "~/routes/PublicLayout";
import {
  PublicAboutView,
  PublicFormsView,
  PublicFormView,
  PublicHomeView,
} from "~/routes/public";
import { NotificationProvider } from "~/stores";

// Lazy so visitors only download the admin app, the payment scripts or the QR encoder when they need them.
const PublicCartView = lazy(() => import("~/routes/public/CartView"));
const PublicQrView = lazy(() => import("~/routes/public/QrView"));
const AdminLayout = lazy(() => import("~/routes/AdminLayout"));
const AdminHomeView = lazy(() => import("~/routes/admin/HomeView"));
const AdminFormsView = lazy(() => import("~/routes/admin/forms/FormsView"));
const AdminFormsEditView = lazy(
  () => import("~/routes/admin/forms/FormsEditView"),
);
const AdminRegistrationsView = lazy(
  () => import("~/routes/admin/RegistrationsView"),
);
const AdminNewRegistrationView = lazy(
  () => import("~/routes/admin/NewRegistrationView"),
);
const AdminRegistrationView = lazy(
  () => import("~/routes/admin/RegistrationView"),
);
const AdminCurrenciesView = lazy(() => import("~/routes/admin/CurrenciesView"));
const AdminIdTypesView = lazy(() => import("~/routes/admin/IdTypesView"));
const AdminUsersView = lazy(() => import("~/routes/admin/UsersView"));

const idFilter = {
  id: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
};

const App: Component = () => (
  <NotificationProvider>
    <Router
      root={(props) => (
        <>
          <Toast />
          <ErrorLoadingWrapper>{props.children}</ErrorLoadingWrapper>
        </>
      )}
    >
      <Route path="/" component={PublicLayout}>
        <Route path="/" component={PublicHomeView} />
        <Route path="/about" component={PublicAboutView} />
        <Route path="/forms">
          <Route path="/" component={PublicFormsView} />
          <Route
            path="/:id"
            component={PublicFormView}
            matchFilters={idFilter}
          />
        </Route>
        <Route path="/registrations/:token" component={PublicCartView} />
        <Route path="/registrations/:token/qr" component={PublicQrView} />
        <Route path="*404" component={NotFound} />
      </Route>

      <Route path="/admin" component={AdminLayout}>
        <Route path="/" component={AdminHomeView} />
        <Route path="/forms">
          <Route path="/" component={AdminFormsView} />
          <Route
            path="/:id"
            component={AdminFormsEditView}
            matchFilters={idFilter}
          />
        </Route>
        <Route path="/registrations">
          <Route path="/" component={AdminRegistrationsView} />
          <Route path="/new" component={AdminNewRegistrationView} />
          <Route
            path="/:id"
            component={AdminRegistrationView}
            matchFilters={idFilter}
          />
        </Route>
        <Route path="/currencies" component={AdminCurrenciesView} />
        <Route path="/id-types" component={AdminIdTypesView} />
        <Route path="/users" component={AdminUsersView} />
        <Route path="*404" component={NotFound} />
      </Route>
    </Router>
  </NotificationProvider>
);

export default App;
