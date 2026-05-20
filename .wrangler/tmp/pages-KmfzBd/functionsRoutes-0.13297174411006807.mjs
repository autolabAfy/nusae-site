import { onRequestPost as __api_admin_payment_status_js_onRequestPost } from "/Users/nurlasyraffie/Downloads/Autolabclick Workspace/nusae-site/functions/api/admin/payment-status.js"
import { onRequestPost as __api_admin_recovery_link_js_onRequestPost } from "/Users/nurlasyraffie/Downloads/Autolabclick Workspace/nusae-site/functions/api/admin/recovery-link.js"
import { onRequestPost as __api_checkout_js_onRequestPost } from "/Users/nurlasyraffie/Downloads/Autolabclick Workspace/nusae-site/functions/api/checkout.js"
import { onRequestPost as __api_hitpay_webhook_js_onRequestPost } from "/Users/nurlasyraffie/Downloads/Autolabclick Workspace/nusae-site/functions/api/hitpay-webhook.js"

export const routes = [
    {
      routePath: "/api/admin/payment-status",
      mountPath: "/api/admin",
      method: "POST",
      middlewares: [],
      modules: [__api_admin_payment_status_js_onRequestPost],
    },
  {
      routePath: "/api/admin/recovery-link",
      mountPath: "/api/admin",
      method: "POST",
      middlewares: [],
      modules: [__api_admin_recovery_link_js_onRequestPost],
    },
  {
      routePath: "/api/checkout",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_checkout_js_onRequestPost],
    },
  {
      routePath: "/api/hitpay-webhook",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_hitpay_webhook_js_onRequestPost],
    },
  ]