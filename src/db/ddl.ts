// ตาราง Postgres ที่สร้างจาก schema.ts (ได้จาก `npx drizzle-kit generate`) ถ้าแก้ schema.ts ให้ generate ใหม่แล้วแทนข้อความด้านล่าง
export const DDL = `
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "locations" (
	"code" text PRIMARY KEY NOT NULL,
	"zone" text NOT NULL,
	"rack" text NOT NULL,
	"bay" integer NOT NULL,
	"pallet" integer NOT NULL,
	"level" integer NOT NULL
);

CREATE TABLE "movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"location_code" text NOT NULL,
	"to_location_code" text,
	"customer_id" integer,
	"product_id" integer,
	"qty" integer,
	"note" text DEFAULT '' NOT NULL,
	"withdrawal_id" integer,
	"user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"unit" text DEFAULT 'ลัง' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_sku_unique" UNIQUE("sku")
);

CREATE TABLE "reservations" (
	"id" serial PRIMARY KEY NOT NULL,
	"location_code" text NOT NULL,
	"customer_id" integer NOT NULL,
	"eta" date,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reservations_location_code_unique" UNIQUE("location_code")
);

CREATE TABLE "stock" (
	"id" serial PRIMARY KEY NOT NULL,
	"location_code" text NOT NULL,
	"product_id" integer NOT NULL,
	"qty" integer NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"received_by" integer
);

CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'staff' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);

CREATE TABLE "withdrawals" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "movements" ADD CONSTRAINT "movements_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "movements" ADD CONSTRAINT "movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "movements" ADD CONSTRAINT "movements_withdrawal_id_withdrawals_id_fk" FOREIGN KEY ("withdrawal_id") REFERENCES "public"."withdrawals"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "movements" ADD CONSTRAINT "movements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "products" ADD CONSTRAINT "products_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_location_code_locations_code_fk" FOREIGN KEY ("location_code") REFERENCES "public"."locations"("code") ON DELETE no action ON UPDATE no action;
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "stock" ADD CONSTRAINT "stock_location_code_locations_code_fk" FOREIGN KEY ("location_code") REFERENCES "public"."locations"("code") ON DELETE no action ON UPDATE no action;
ALTER TABLE "stock" ADD CONSTRAINT "stock_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "stock" ADD CONSTRAINT "stock_received_by_users_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
CREATE UNIQUE INDEX "stock_location_product" ON "stock" USING btree ("location_code","product_id");`;
