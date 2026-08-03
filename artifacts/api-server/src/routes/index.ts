import { Router, type IRouter } from "express";
import healthRouter from "./health";
import calendarRouter from "./calendar";
import geocodeRouter from "./geocode";
import visitorsRouter from "./visitors";

const router: IRouter = Router();

router.use(healthRouter);
router.use(calendarRouter);
router.use(geocodeRouter);
router.use(visitorsRouter);

export default router;
