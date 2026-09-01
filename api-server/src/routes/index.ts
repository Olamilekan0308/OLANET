import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import olanetAIRouter from "./olanet-ai";
import supportAIRouter from "./support-ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(olanetAIRouter);
router.use(supportAIRouter);

export default router;
