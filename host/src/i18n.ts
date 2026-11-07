import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      app: {
        title: "Oaktree Platform",
        subtitle: "Unified Intelligence for Investment & Finance",
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
        intelligence_active: "Wealth Intelligence",
        notifications: "Notifications",
        mark_all_read: "Mark all as read",
        clear_read: "Clear read",
        no_notifications: "No notifications yet",
        just_now: "Just now",
        mins_ago: "{{count}}m ago",
        hours_ago: "{{count}}h ago",
        days_ago: "{{count}}d ago",
        light_mode: "Light Mode",
        dark_mode: "Dark Mode",
        settings: "Settings",
        install_app: "Install App",
        app_installed: "App Installed",
        sign_out: "Sign Out",
        operator: "Operator",
        pro_account: "Pro Account",
        menu: "Menu",
        expand_sidebar: "Expand Sidebar",
        collapse_sidebar: "Collapse Sidebar",
        show_sidebar: "Show Sidebar",
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
        hide_sidebar: "Hide Sidebar",
      },
      about: {
        title: "About Oaktree Platform",
        description: "Inspired by the investment philosophy of Howard Marks (Oaktree Capital), this agent goes beyond raw data. It synthesizes news into cohesive narratives, focusing on market cycles, risk assessment, and long-term value.",
        footer: "Powered by Cloudflare Workers, AI (Llama 3), and Browser Rendering.",
      },
      not_found: {
        title: "Page Not Found",
        description: "The page you're looking for doesn't exist or has been moved. Check the URL and try again.",
        go_home: "Go to Dashboard",
      }
    }
  },
  es: {
    translation: {
      app: {
        title: "Plataforma Oaktree",
        subtitle: "Inteligencia Unificada de Inversión y Finanzas",
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
        intelligence_active: "Inteligencia Patrimonial",
        notifications: "Notificaciones",
        mark_all_read: "Marcar todas como leídas",
        clear_read: "Borrar leídas",
        no_notifications: "No hay notificaciones aún",
        just_now: "Ahora mismo",
        mins_ago: "Hace {{count}}m",
        hours_ago: "Hace {{count}}h",
        days_ago: "Hace {{count}}d",
        light_mode: "Modo Claro",
        dark_mode: "Modo Oscuro",
        settings: "Ajustes",
        install_app: "Instalar App",
        app_installed: "App Instalada",
        sign_out: "Cerrar sesión",
        operator: "Operador",
        pro_account: "Cuenta Pro",
        menu: "Menú",
        expand_sidebar: "Expandir barra lateral",
        collapse_sidebar: "Contraer barra lateral",
        show_sidebar: "Mostrar barra lateral",
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
        hide_sidebar: "Ocultar barra lateral",
      },
      about: {
        title: "Acerca de la Plataforma Oaktree",
        description: "Inspirado en la filosofía de inversión de Howard Marks (Oaktree Capital), este agente va más allá de los datos brutos. Sintetiza las noticias en narrativas coherivas, centrándose en los ciclos de mercado, la evaluación de riesgos y el valor a largo plazo.",
        footer: "Desarrollado por Cloudflare Workers, AI (Llama 3) y Renderizado de Navegador.",
      },
      not_found: {
        title: "Página No Encontrada",
        description: "La page que buscas no existe o ha sido movida. Verifica la URL e intenta de nuevo.",
        go_home: "Ir al Panel",
      }
    }
  },
  th: {
    translation: {
      app: {
        title: "Oaktree Platform",
        subtitle: "ระบบข่าวกรองการลงทุนและการเงินครบวงจร",
        exchanging_token: "กำลังแลกเปลี่ยนโทเคน Google...",
        verifying_session: "กำลังตรวจสอบเซสชัน...",
      },
      login: {
        description: "เข้าถึงการวิเคราะห์รอบวัฏจักรตลาด การประเมินความเสี่ยง และสังเคราะห์ข่าวตามปรัชญาของ Howard Marks",
        access_denied: "ปฏิเสธการเข้าถึง",
        sign_in: "เข้าสู่ระบบด้วย Google",
        authorized_only: "เฉพาะอีเมลที่ได้รับอนุญาตเท่านั้น",
      },
      header: {
        intelligence_active: "ระบบข่าวกรองความมั่งคั่ง",
        notifications: "การแจ้งเตือน",
        mark_all_read: "อ่านทั้งหมดแล้ว",
        clear_read: "ล้างรายการที่อ่านแล้ว",
        no_notifications: "ยังไม่มีการแจ้งเตือน",
        just_now: "เมื่อสักครู่",
        mins_ago: "{{count}} นาทีที่แล้ว",
        hours_ago: "{{count}} ชม. ที่แล้ว",
        days_ago: "{{count}} วันที่แล้ว",
        light_mode: "โหมดสว่าง",
        dark_mode: "โหมดมืด",
        settings: "การตั้งค่า",
        install_app: "ติดตั้งแอป (PWA)",
        app_installed: "ติดตั้งแอปแล้ว",
        sign_out: "ออกจากระบบ",
        operator: "ผู้ใช้งาน",
        pro_account: "บัญชี Pro",
        menu: "เมนู",
        expand_sidebar: "ขยายแถบข้าง",
        collapse_sidebar: "ย่อแถบข้าง",
        show_sidebar: "แสดงแถบข้าง",
      },
      sidebar: {
        command_center: "ศูนย์บัญชาการ",
        dashboard: "แดชบอร์ด",
        market_intelligence: "ข่าวกรองตลาด",
        watchlist: "รายการเฝ้าดู",
        news_sources: "แหล่งข่าว",
        agent_chat: "แชทกับ AI Agent",
        db_agent: "Agent ฐานข้อมูล",
        about_oaktree: "เกี่ยวกับ Oaktree",
        oaktree_command: "คำสั่ง Oaktree",
        hide_sidebar: "ซ่อนแถบข้าง",
      },
      about: {
        title: "เกี่ยวกับ Oaktree Platform",
        description: "ได้รับแรงบันดาลใจจากปรัชญาการลงทุนของ Howard Marks (Oaktree Capital) มุ่งเน้นการวิเคราะห์รอบวัฏจักรตลาด การควบคุมความเสี่ยง และมูลค่าระยะยาว",
        footer: "ขับเคลื่อนโดย Cloudflare Workers, AI และ Browser Rendering",
      },
      not_found: {
        title: "ไม่พบหน้าที่ต้องการ",
        description: "หน้าที่คุณกำลังค้นหาไม่มีอยู่หรือถูกย้ายแล้ว",
        go_home: "กลับไปแดชบอร์ด",
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
