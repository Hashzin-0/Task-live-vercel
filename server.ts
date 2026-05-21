import express from "express";
import { createServer } from "http";
import next from "next";
import { parse } from "url";
import { GoogleGenAI } from "@google/genai";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    const expressApp = express();
    const server = createServer(expressApp);

    expressApp.use(express.json());

    expressApp.post("/api/token", async (_req, res) => {
      try {
        const ai = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
          httpOptions: { apiVersion: "v1alpha" },
        });

        const now = new Date();
        const expireTime = new Date(now.getTime() + 30 * 60 * 1000);

        const token = await ai.authTokens.create({
          config: {
            uses: 1,
            expireTime: expireTime.toISOString(),
            newSessionExpireTime: new Date(
              now.getTime() + 60 * 1000,
            ).toISOString(),
          },
        });

        res.json({ token: token.name, expires_at: expireTime.toISOString() });
      } catch (error) {
        console.error("Error generating ephemeral token:", error);
        res.status(500).json({ error: "Failed to generate token" });
      }
    });

    expressApp.all(/.*/, (req, res) => {
      const parsedUrl = parse(req.url!, true);
      handle(req, res, parsedUrl);
    });

    server.listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
  })
  .catch((err) => {
    console.error("Error starting server:", err);
    process.exit(1);
  });
