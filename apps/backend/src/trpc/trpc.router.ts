import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ModuleRef, ModulesContainer } from "@nestjs/core";
import { AnyTRPCRouter, TRPCError } from "@trpc/server";
import { ZodType, z } from "zod";
import {
	TRPC_PROCEDURE_KEY,
	TRPC_ROUTER_KEY,
	TrpcProcedureOptions,
} from "./decorators";

import {
	type InnerTRPCContext,
	ZENSTACK_GENERATED_ROUTER,
	createTRPCRouter,
	mergeRouters,
	protectedProcedure,
	publicProcedure,
} from "@mono/database";

@Injectable()
export class MainTrpcRouterFactory implements OnModuleInit {
	private appRouterInstance!: AnyTRPCRouter;
	private readonly logger = new Logger(MainTrpcRouterFactory.name);

	constructor(
		private readonly moduleRef: ModuleRef,
		private readonly modulesContainer: ModulesContainer,
		@Inject(ZENSTACK_GENERATED_ROUTER)
		private readonly generatedRouter: AnyTRPCRouter,
	) {}

	onModuleInit() {
		this.appRouterInstance = this._buildAppRouter();
		if (Object.keys(this.appRouterInstance._def.procedures).length > 0) {
			this.logger.debug(
				`✅ Backend tRPC Router built with procedures: ${Object.keys(this.appRouterInstance._def.procedures).join(", ")}`,
			);
		} else {
			this.logger.warn(
				"⚠️ Backend tRPC Router built, but no procedures were found/registered!",
			);
		}
	}

	public getAppRouter(): AnyTRPCRouter {
		if (!this.appRouterInstance) {
			this.logger.warn(
				"AppRouter not yet built, building now (should have happened in onModuleInit).",
			);
			this.appRouterInstance = this._buildAppRouter();
		}
		return this.appRouterInstance;
	}

	private _buildAppRouter(): AnyTRPCRouter {
		const proceduresToBuildGrouped: Record<
			string,
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			Record<string, any>
		> = {};

		const modules = [...this.modulesContainer.values()];
		for (const nestModule of modules) {
			const providers = [...nestModule.providers.values()];
			for (const wrapper of providers) {
				const metatype = wrapper.metatype;
				if (
					!metatype ||
					typeof metatype !== "function" ||
					!wrapper.instance
				) {
					continue;
				}
				const routerMetadata = Reflect.getMetadata(
					TRPC_ROUTER_KEY,
					metatype,
				);
				if (!routerMetadata) {
					continue;
				}

				const routerInstance = wrapper.instance;
				const domain = routerMetadata.domain as string | undefined;
				const procedureDefinitionsFromMetadata =
					Reflect.getMetadata(TRPC_PROCEDURE_KEY, metatype) || [];

				const domainKey = domain || "__ROOT__";
				if (!proceduresToBuildGrouped[domainKey]) {
					proceduresToBuildGrouped[domainKey] = {};
				}

				for (const procDefFromMeta of procedureDefinitionsFromMetadata) {
					const methodName = procDefFromMeta.methodName as string;
					const options =
						procDefFromMeta.options as TrpcProcedureOptions<
							// biome-ignore lint/suspicious/noExplicitAny: <explanation>
							ZodType<any, any, any> | undefined, // Korrigiert, um undefined zu erlauben
							// biome-ignore lint/suspicious/noExplicitAny: <explanation>
							ZodType<any, any, any> | undefined
						>;
					const implementation =
						// biome-ignore lint/complexity/noBannedTypes: <explanation>
						procDefFromMeta.implementation as Function;

					if (typeof implementation !== "function") {
						continue;
					}

					let procedureBuilder = options.isProtected
						? protectedProcedure
						: publicProcedure;

					if (options.inputType) {
						procedureBuilder = procedureBuilder.input(
							options.inputType,
						);
					}
					if (options.outputType) {
						procedureBuilder = procedureBuilder.output(
							options.outputType,
						);
					}

					const boundImplementation =
						implementation.bind(routerInstance);

					const resolver = async (procedureHandlerOpts: {
						input: unknown;
						ctx: InnerTRPCContext;
						meta?: unknown;
					}) => {
						try {
							return await boundImplementation({
								input: procedureHandlerOpts.input,
								ctx: procedureHandlerOpts.ctx,
							});
						} catch (error) {
							if (error instanceof TRPCError) throw error;
							const procedurePath = `${domainKey !== "__ROOT__" ? `${domainKey}.` : ""}${methodName}`;
							this.logger.error(
								`Error in tRPC procedure ${procedurePath}:`,
								error,
							);
							throw new TRPCError({
								code: "INTERNAL_SERVER_ERROR",
								message: `An unexpected error occurred in ${procedurePath}.`,
								cause: error,
							});
						}
					};

					// biome-ignore lint/suspicious/noImplicitAnyLet: <explanation>
					let finalProcedure;
					if (options.type === "query") {
						finalProcedure = procedureBuilder.query(resolver);
					} else if (options.type === "mutation") {
						finalProcedure = procedureBuilder.mutation(resolver);
					} else {
						continue;
					}

					if (proceduresToBuildGrouped[domainKey][methodName]) {
						this.logger.warn(
							`Procedure collision: ${domainKey}.${methodName} from class ${metatype.name} is overwriting a previously defined procedure for this domain.`,
						);
					}
					proceduresToBuildGrouped[domainKey][methodName] =
						finalProcedure;
				}
			}
		}

		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		const finalRouterDefinition: Record<string, any> = {};
		for (const domainKey in proceduresToBuildGrouped) {
			const proceduresInDomain = proceduresToBuildGrouped[domainKey];
			if (Object.keys(proceduresInDomain).length === 0) {
				if (domainKey !== "__ROOT__") {
					this.logger.warn(
						`Domain '${domainKey}' has no procedures defined after processing all providers, skipping.`,
					);
				}
				continue;
			}

			if (domainKey === "__ROOT__") {
				Object.assign(finalRouterDefinition, proceduresInDomain);
			} else {
				finalRouterDefinition[domainKey] =
					createTRPCRouter(proceduresInDomain);
				this.logger.log(
					`Created domain router '${domainKey}' with procedures: ${Object.keys(proceduresInDomain).join(", ")}`,
				);
			}
		}

		if (
			Object.keys(finalRouterDefinition).length === 0 &&
			Object.keys(proceduresToBuildGrouped.__ROOT__ || {}).length === 0
		) {
			this.logger.warn(
				"No root procedures or domain routers were built. The appRouter will be empty.",
			);
		}

		const customRouter = createTRPCRouter(finalRouterDefinition);

		const finalAppRouter = mergeRouters(this.generatedRouter, customRouter);

		return finalAppRouter;
	}
}
