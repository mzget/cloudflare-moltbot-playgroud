import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      app: {
        title: "Oaktree Agent",
        subtitle: "Investment Intelligence",
        exchanging_token: "Exchanging Google token...",
        verifying_session: "Verifying session...",
      },
      login: {
        description: "Access premium market cycle analysis, risk assessments, and news synthesis inspired by the investment philosophy of Howard Marks.",
        access_denied: "Access Denied",
        sign_in: "Sign in with Google",
        authorized_only: "Authorized email addresses only.",
      },
      header: {
        intelligence_active: "Intelligence Active",
        notifications: "Notifications",
        mark_all_read: "Mark all as read",
        no_notifications: "No notifications yet",
        just_now: "Just now",
        mins_ago: "{{count}}m ago",
        hours_ago: "{{count}}h ago",
        days_ago: "{{count}}d ago",
        light_mode: "Light Mode",
        dark_mode: "Dark Mode",
        settings: "Settings",
        sign_out: "Sign Out",
        operator: "Operator",
        pro_account: "Pro Account",
        menu: "Menu",
        expand_sidebar: "Expand Sidebar",
        collapse_sidebar: "Collapse Sidebar",
      },
      sidebar: {
        command_center: "Command Center",
        dashboard: "Dashboard",
        market_intelligence: "Market Intelligence",
        watchlist: "Watchlist",
        news_sources: "News Sources",
        agent_chat: "Agent Chat",
        db_agent: "Database Agent",
        about_oaktree: "About Oaktree",
        oaktree_command: "Oaktree Command",
      },
      about: {
        title: "About Oaktree Agent",
        description: "Inspired by the investment philosophy of Howard Marks (Oaktree Capital), this agent goes beyond raw data. It synthesizes news into cohesive narratives, focusing on market cycles, risk assessment, and long-term value.",
        footer: "Powered by Cloudflare Workers, AI (Llama 3), and Browser Rendering.",
      }
    }
  },
  es: {
    translation: {
      app: {
        title: "Agente Oaktree",
        subtitle: "Inteligencia de Inversión",
        exchanging_token: "Intercambiando token de Google...",
        verifying_session: "Verificando sesión...",
      },
      login: {
        description: "Acceda a análisis de ciclos de mercado premium, evaluaciones de riesgo y síntesis de noticias inspiradas en la filosofía de inversión de Howard Marks.",
        access_denied: "Acceso Denegado",
        sign_in: "Iniciar sesión con Google",
        authorized_only: "Solo direcciones de correo electrónico autorizadas.",
      },
      header: {
        intelligence_active: "Inteligencia Activa",
        notifications: "Notificaciones",
        mark_all_read: "Marcar todas como leídas",
        no_notifications: "No hay notificaciones aún",
        just_now: "Ahora mismo",
        mins_ago: "Hace {{count}}m",
        hours_ago: "Hace {{count}}h",
        days_ago: "Hace {{count}}d",
        light_mode: "Modo Claro",
        dark_mode: "Modo Oscuro",
        settings: "Ajustes",
        sign_out: "Cerrar sesión",
        operator: "Operador",
        pro_account: "Cuenta Pro",
        menu: "Menú",
        expand_sidebar: "Expandir barra lateral",
        collapse_sidebar: "Contraer barra lateral",
      },
      sidebar: {
        command_center: "Centro de Comando",
        dashboard: "Tablero",
        market_intelligence: "Inteligencia de Mercado",
        watchlist: "Lista de Vigilancia",
        news_sources: "Fuentes de Noticias",
        agent_chat: "Chat del Agente",
        db_agent: "Agente de Base de Datos",
        about_oaktree: "Acerca de Oaktree",
        oaktree_command: "Comando Oaktree",
      },
      about: {
        title: "Acerca del Agente Oaktree",
        description: "Inspirado en la filosofía de inversión de Howard Marks (Oaktree Capital), este agente va más allá de los datos brutos. Sintetiza las noticias en narrativas coherivas, centrándose en los ciclos de mercado, la evaluación de riesgos y el valor a largo plazo.",
        footer: "Desarrollado por Cloudflare Workers, AI (Llama 3) y Renderizado de Navegador.",
      }
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    }
  });

export default i18n;
