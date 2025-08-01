import {
	Inject,
	Injectable,
	OnModuleDestroy,
	OnModuleInit,
	Logger,
} from "@nestjs/common";
import type { Redis as RedisClientType, RedisKey } from "ioredis";

@Injectable()
export class RedisService implements OnModuleDestroy, OnModuleInit {
	private readonly logger = new Logger(RedisService.name);
	constructor(
		@Inject("REDIS_CLIENT") private readonly redisClient: RedisClientType,
	) {}

	async onModuleInit() {
		try {
			await this.redisClient.ping();
			this.logger.log("Successfully connected to Redis and pinged.");
		} catch (error) {
			this.logger.error("Failed to connect to Redis or ping failed:", error);
		}
	}

	async onModuleDestroy() {
		await this.redisClient.quit();
		this.logger.log("Disconnected from Redis.");
	}

	async get(key: RedisKey): Promise<string | null> {
		try {
			return await this.redisClient.get(key);
		} catch (error) {
			this.logger.error(`Redis GET error for key ${String(key)}:`, error);
			throw error;
		}
	}

	async scan(pattern: string, count?: number): Promise<string[]> {
		try {
			const keys: string[] = [];
			let cursor = "0";

			do {
				const [nextCursor, batchKeys] = await this.redisClient.scan(
					cursor,
					"MATCH",
					pattern,
					"COUNT",
					count || 100,
				);
				cursor = nextCursor;
				keys.push(...batchKeys);
			} while (cursor !== "0");

			return keys;
		} catch (error) {
			this.logger.error(`Redis SCAN error for pattern ${pattern}:`, error);
			throw error;
		}
	}

	/**
	 * Setzt einen Wert für einen Schlüssel.
	 * Verwendet die Array-Syntax für optionale Argumente für bessere Kompatibilität mit ioredis-Überladungen.
	 * @param key Der Schlüssel.
	 * @param value Der zu setzende Wert.
	 * @param ttlSeconds Optionale Ablaufzeit in Sekunden.
	 * @param mode Optional: 'NX' (nur setzen, wenn nicht existiert) oder 'XX' (nur setzen, wenn existiert).
	 * @returns 'OK' bei Erfolg, null wenn NX/XX Bedingung nicht erfüllt wurde, oder wirft einen Fehler.
	 */
	async set(
		key: RedisKey,
		value: string | number | Buffer,
		ttlSeconds?: number,
		mode?: "NX" | "XX",
	): Promise<string | null> {
		try {
			const args: (string | number)[] = [];
			if (ttlSeconds !== undefined && ttlSeconds > 0) {
				args.push("EX", ttlSeconds);
			}
			if (mode) {
				args.push(mode);
			}

			if (args.length > 0) {
				// biome-ignore lint/suspicious/noExplicitAny: <explanation>
				return await this.redisClient.set(key, value, ...(args as any));
				// oder spezifischere Aufrufe machen
			}
			return await this.redisClient.set(key, value);
		} catch (error) {
			this.logger.error(`Redis SET error for key ${String(key)}:`, error);
			throw error;
		}
	}

	/**
	 * Setzt einen Wert für einen Schlüssel mit einer Ablaufzeit in Sekunden (entspricht SETEX).
	 * @param key Der Schlüssel.
	 * @param ttlSeconds Ablaufzeit in Sekunden.
	 * @param value Der zu setzende Wert.
	 * @returns 'OK' bei Erfolg oder wirft einen Fehler.
	 */
	async setex(
		key: RedisKey,
		ttlSeconds: number,
		value: string | number | Buffer,
	): Promise<string> {
		try {
			return await this.redisClient.setex(key, ttlSeconds, value);
		} catch (error) {
			this.logger.error(`Redis SETEX error for key ${String(key)}:`, error);
			throw error;
		}
	}

	async del(keys: RedisKey | RedisKey[]): Promise<number> {
		try {
			const keysToDelete = Array.isArray(keys) ? keys : [keys];
			if (keysToDelete.length === 0) return 0;
			return await this.redisClient.del(...keysToDelete);
		} catch (error) {
			this.logger.error(`Redis DEL error for keys ${String(keys)}:`, error);
			throw error;
		}
	}

	async exists(keys: RedisKey | RedisKey[]): Promise<number> {
		try {
			const keysToCheck = Array.isArray(keys) ? keys : [keys];
			if (keysToCheck.length === 0) return 0;
			return await this.redisClient.exists(...keysToCheck);
		} catch (error) {
			this.logger.error(
				`Redis EXISTS error for keys ${String(keys)}:`,
				error,
			);
			throw error;
		}
	}

	async incr(key: RedisKey): Promise<number> {
		try {
			return await this.redisClient.incr(key);
		} catch (error) {
			this.logger.error(`Redis INCR error for key ${String(key)}:`, error);
			throw error;
		}
	}

	async decr(key: RedisKey): Promise<number> {
		try {
			return await this.redisClient.decr(key);
		} catch (error) {
			this.logger.error(`Redis DECR error for key ${String(key)}:`, error);
			throw error;
		}
	}

	/**
	 * Setzt die Ablaufzeit für einen Schlüssel in Sekunden.
	 * @param key Der Schlüssel.
	 * @param ttlSeconds Die Ablaufzeit in Sekunden.
	 * @returns Die Anzahl der Felder, deren Timeout gesetzt wurde (0 oder 1).
	 */
	async expire(key: RedisKey, ttlSeconds: number): Promise<number> {
		try {
			return await this.redisClient.expire(key, ttlSeconds);
		} catch (error) {
			this.logger.error(`Redis EXPIRE error for key ${String(key)}:`, error);
			throw error;
		}
	}

	async ttl(key: RedisKey): Promise<number> {
		try {
			return await this.redisClient.ttl(key);
		} catch (error) {
			this.logger.error(`Redis TTL error for key ${String(key)}:`, error);
			throw error;
		}
	}

	/**
	 * ACHTUNG: Potenziell performancelastig in Produktion bei großen Datenmengen!
	 * Findet alle Schlüssel, die einem bestimmten Muster entsprechen.
	 * @param pattern Das Muster (z.B. 'user:*'). Parameter auf string geändert.
	 * @returns Ein Array der passenden Schlüssel.
	 */
	async keys(pattern: string): Promise<string[]> {
		try {
			this.logger.warn(
				`Redis KEYS command used with pattern "${pattern}". Use with caution in production.`,
			);
			return await this.redisClient.keys(pattern);
		} catch (error) {
			this.logger.error(`Redis KEYS error for pattern ${pattern}:`, error);
			throw error;
		}
	}

	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	async getJson<T = any>(key: RedisKey): Promise<T | null> {
		const data = await this.get(key);
		if (!data) return null;
		try {
			return JSON.parse(data) as T;
		} catch (error) {
			this.logger.error(
				`Failed to parse JSON for key ${String(key)}:`,
				error,
			);
			return null;
		}
	}

	async setJson(
		key: RedisKey,
		value: object,
		ttlSeconds?: number,
		mode?: "NX" | "XX",
	): Promise<string | null> {
		try {
			const stringValue = JSON.stringify(value);
			return await this.set(key, stringValue, ttlSeconds, mode);
		} catch (error) {
			this.logger.error(
				`Failed to stringify JSON for key ${String(key)}:`,
				error,
			);
			throw new Error(
				"Failed to stringify JSON for Redis set operation.",
			);
		}
	}
}
