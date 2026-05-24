import rateLimit from "express-rate-limit";

export const reviewRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests, please wait."
});
