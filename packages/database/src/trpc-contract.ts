// AUTOGENERATED FILE - DO NOT EDIT MANUALLY

import { createRouter as createGeneratedRouter } from './generated/routers';

import { z } from 'zod';
import type { TRPCContext } from '.';
import { createTRPCRouter, publicProcedure, protectedProcedure, mergeRouters } from './trpc';
// Local Dependencies (Types, Enums, Schemas)
const MessageOutputSchema = z.string();

const SetMessageInputSchema = z.object({
	message: z.string(),
});

const SecretMessageOutputSchema = z.string();

const UserSchema = z.object({
	id: z.string(),
	name: z.string(),
	email: z.string(),
});

export const customAppRouter = createTRPCRouter({
  cExample: createTRPCRouter({
    getMessage: publicProcedure
      .input(z.undefined())
      .output(MessageOutputSchema)
      .query(({ input, ctx }) => {
        return "PLACEHOLDER_STRING";
      }),
    setMessage: publicProcedure
      .input(SetMessageInputSchema)
      .output(MessageOutputSchema)
      .mutation(({ input, ctx }) => {
        return "PLACEHOLDER_STRING";
      }),
    getSecretMessage: protectedProcedure
      .input(z.undefined())
      .output(SecretMessageOutputSchema)
      .query(({ input, ctx }) => {
        return "PLACEHOLDER_STRING";
      }),
    getCurrentUser: publicProcedure
      .input(z.undefined())
      .output(UserSchema)
      .query(({ input, ctx }) => {
        return { "id": "PLACEHOLDER_STRING", "name": "PLACEHOLDER_STRING", "email": "PLACEHOLDER_STRING" };
      }),
    getManuallyTypedMessage: publicProcedure
      .input(z.undefined())
      .output(z.string())
      .query(({ input, ctx }) => {
        return "PLACEHOLDER_STRING";
      }),
  }),
});

const generatedRouter = createGeneratedRouter();

export const appRouter = mergeRouters(generatedRouter, customAppRouter);

export type AppRouter = typeof appRouter;
