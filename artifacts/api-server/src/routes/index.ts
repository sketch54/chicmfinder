import { Router, type IRouter } from "express";
import healthRouter from "./health";
import calendarRouter from "./calendar";
import geocodeRouter from "./geocode";

const router: IRouter = Router();

router.use(healthRouter);
router.use(calendarRouter);
router.use(geocodeRouter);

export default router;
