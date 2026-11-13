import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    base: '/community_project/',
    plugins: [
      tailwindcss(),
      {
        name: 'html-rewrite-middleware',
        configureServer(server) {
          server.middlewares.use((req, _res, next) => {
            if (req.url) {
              const url = req.url.split('?')[0];
              const htmlPages = [
                '/login',
                '/donor-register',
                '/receiver-register',
                '/donor-dashboard',
                '/receiver-dashboard',
                '/find-donors',
                '/about',
                '/contact',
              ];
              if (htmlPages.includes(url)) {
                req.url = req.url.replace(url, url + '.html');
              }
            }
            next();
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          login: path.resolve(__dirname, 'login.html'),
          donorRegister: path.resolve(__dirname, 'donor-register.html'),
          receiverRegister: path.resolve(__dirname, 'receiver-register.html'),
          donorDashboard: path.resolve(__dirname, 'donor-dashboard.html'),
          receiverDashboard: path.resolve(__dirname, 'receiver-dashboard.html'),
          findDonors: path.resolve(__dirname, 'find-donors.html'),
          about: path.resolve(__dirname, 'about.html'),
          contact: path.resolve(__dirname, 'contact.html'),
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
