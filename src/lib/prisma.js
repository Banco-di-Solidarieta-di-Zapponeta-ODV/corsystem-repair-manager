import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

if (typeof BigInt.prototype.toJSON !== "function") {
  Object.defineProperty(BigInt.prototype, "toJSON", {
    value() {
      const number = Number(this);
      return Number.isSafeInteger(number) ? number : this.toString();
    },
    configurable: true
  });
}

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
