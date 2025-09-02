import { firefox } from 'playwright-core';
 import { launchServer } from "camoufox-js";

 console.log("[INIT] Starting Camoufox server...");

 // Resource management
 let server = null;
 const activeSessions = new Set();
 const MAX_CONCURRENT_SESSIONS = 3; // Limit concurrent browser sessions
 const SESSION_TIMEOUT = 120000; // 2 minutes timeout per session
 const requestQueue = [];
 let isProcessingQueue = false;

 // Graceful shutdown handler
 const gracefulShutdown = async (signal) => {
     console.log(`[SHUTDOWN] Received ${signal}, starting graceful shutdown...`);

     try {
         // Close all active sessions
         for (const session of activeSessions) {
             try {
                 if (session.browser && !session.browser.isConnected()) {
                     await session.browser.close();
                 }
             } catch (e) {
                 console.error("[SHUTDOWN] Error closing browser session:", e.message);
             }
         }
         activeSessions.clear();

         // Close server
         if (server) {
             await server.close();
             console.log("[SHUTDOWN] Server closed successfully");
         }
     } catch (e) {
         console.error("[SHUTDOWN] Error during shutdown:", e.message);
     }

     process.exit(0);
 };

 // Register shutdown handlers
 process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
 process.on('SIGINT', () => gracefulShutdown('SIGINT'));
 process.on('uncaughtException', (error) => {
     console.error('[ERROR] Uncaught Exception:', error);
     gracefulShutdown('uncaughtException');
 });
 process.on('unhandledRejection', (reason, promise) => {
     console.error('[ERROR] Unhandled Rejection at:', promise, 'reason:', reason);
 });

 // Memory monitoring
 const monitorMemory = () => {
     const used = process.memoryUsage();
     const memoryUsageMB = Math.round(used.rss / 1024 / 1024);
     console.log(`[MEMORY] RSS: ${memoryUsageMB}MB, Active sessions: ${activeSessions.size}`);

     // Force garbage collection if memory usage is high
     if (memoryUsageMB > 800 && global.gc) {
         console.log("[MEMORY] High memory usage detected, forcing garbage collection");
         global.gc();
     }

     // Clean up stale sessions
     const now = Date.now();
     for (const session of activeSessions) {
         if (now - session.startTime > SESSION_TIMEOUT) {
             console.log("[CLEANUP] Removing stale session");
             try {
                 if (session.browser) {
                     session.browser.close().catch(() => {});
                 }
             } catch (e) {}
             activeSessions.delete(session);
         }
     }
 };

 // Monitor memory every 30 seconds
 setInterval(monitorMemory, 30000);

 // Session management
 const createSession = () => {
     const session = {
         id: Math.random().toString(36).substr(2, 9),
         startTime: Date.now(),
         browser: null
     };

     activeSessions.add(session);

     // Auto-cleanup after timeout
     setTimeout(() => {
         if (activeSessions.has(session)) {
             console.log(`[CLEANUP] Auto-removing session ${session.id} after timeout`);
             try {
                 if (session.browser) {
                     session.browser.close().catch(() => {});
                 }
             } catch (e) {}
             activeSessions.delete(session);
         }
     }, SESSION_TIMEOUT);

     return session;
 };

 // Request queue processing
 const processQueue = async () => {
     if (isProcessingQueue || requestQueue.length === 0) {
         return;
     }

     isProcessingQueue = true;

     while (requestQueue.length > 0 && activeSessions.size < MAX_CONCURRENT_SESSIONS) {
         const { req, res, resolve } = requestQueue.shift();

         try {
             const success = await handleRequest(req, res);
             resolve(success);
         } catch (e) {
             console.error("[QUEUE] Error processing request:", e.message);
             resolve(false);
         }
     }

     isProcessingQueue = false;

     // Continue processing if there are more requests
     if (requestQueue.length > 0) {
         setTimeout(processQueue, 100);
     }
 };

 // Enhanced request handler
 const handleRequest = async (req, res) => {
     try {
         const url = new URL(req.url, `http://${req.headers.host}`);
         const targetUrl = url.searchParams.get("url");

         if (targetUrl) {
             const PROXY_PREFIX = "https://x_x_x--2c2d74526d0d11f089f10224a6c84d84.web.val.run/?url=";
             const proxiedUrl = PROXY_PREFIX + encodeURIComponent(targetUrl);

             res.writeHead(302, {
                 Location: proxiedUrl,
                 "Cache-Control": "no-store",
                 "Connection": "close" // Ensure connection closes
             });
             res.end();
             return true;
         }

         return false;
     } catch (e) {
         console.error("[REQUEST] Error handling request:", e.message);
         try {
             if (!res.headersSent) {
                 res.writeHead(500, { "Content-Type": "text/plain" });
                 res.end("Internal Server Error");
             }
         } catch (resError) {
             console.error("[REQUEST] Error sending error response:", resError.message);
         }
         return false;
     }
 };

 // Queue-based request handler
 const queuedRequestHandler = async (req, res) => {
     // Check if we're over capacity
     if (requestQueue.length > 50) { // Prevent memory overload
         console.warn("[QUEUE] Request queue full, rejecting request");
         try {
             res.writeHead(503, { "Content-Type": "text/plain" });
             res.end("Service Temporarily Unavailable");
         } catch (e) {}
         return false;
     }

     return new Promise((resolve) => {
         requestQueue.push({ req, res, resolve });
         processQueue();
     });
 };

 // Server restart function
 const restartServer = async () => {
     console.log("[RESTART] Attempting to restart server...");

     try {
         if (server) {
             await server.close();
             server = null;
         }

         // Wait a bit before restart
         await new Promise(resolve => setTimeout(resolve, 2000));

         await startServer();
     } catch (e) {
         console.error("[RESTART] Failed to restart server:", e.message);
         // Try again after 10 seconds
         setTimeout(restartServer, 10000);
     }
 };

 // Start server function
 const startServer = async () => {
     try {
         server = await launchServer({
             stealth: true,
             headless: true,
             port: 1234,
             ws_path: "/hello",
             host: "0.0.0.0",
             timeout: 60000, // Reduced timeout
             args: [
                 "--no-sandbox",
                 "--disable-setuid-sandbox",
                 "--disable-dev-shm-usage",
                 "--disable-gpu",
                 "--disable-extensions",
                 "--single-process",
                 "--no-zygote",
                 "--memory-pressure-off", // Disable memory pressure notifications
                 "--max_old_space_size=512", // Limit memory usage
                 "--disable-background-timer-throttling",
                 "--disable-backgrounding-occluded-windows",
                 "--disable-renderer-backgrounding"
             ],
             logger: {
                 isEnabled: () => false,
                                     log: (name, severity, message) => {
                                         if (severity === "error") {
                                             console.error(`[${name}] ${message}`);
                                         }
                                     }
             },
             requestHandler: queuedRequestHandler
         });

         console.log("[INIT] Camoufox server is running:", server.wsEndpoint());

         // Health check
         setInterval(() => {
             if (!server || !server.wsEndpoint()) {
                 console.error("[HEALTH] Server appears to be down, restarting...");
                 restartServer();
             }
         }, 30000);

     } catch (e) {
         console.error("[ERROR] Failed to launch server:", e);
         console.log("[ERROR] Retrying in 10 seconds...");
         setTimeout(startServer, 10000);
     }
 };

 // Start the server
 (async () => {
     await startServer();
 })();

