import { Router, Request, Response } from "express";
import client from "prom-client";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  res.set("Content-Type", client.register.contentType);
  const metrics = await client.register.metrics();
  res.send(metrics);
});

export default router;