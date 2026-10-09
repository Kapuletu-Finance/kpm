CREATE TABLE "organization_branding" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"display_name" text,
	"tagline" text,
	"logo_url" text,
	"contact_email" text,
	"contact_phone" text,
	"address" text,
	"website" text,
	"registration_number" text,
	"primary_color" text DEFAULT '#097255' NOT NULL,
	"template" text DEFAULT 'classic' NOT NULL,
	"footer_text" text,
	"confidentiality_notice" text,
	"show_kpm_attribution" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "organization_branding_template_check" CHECK (template = ANY (ARRAY['classic'::text, 'modern'::text, 'minimal'::text])),
	CONSTRAINT "organization_branding_color_check" CHECK (primary_color ~ '^#[0-9a-fA-F]{6}$')
);
--> statement-breakpoint
ALTER TABLE "organization_branding" ADD CONSTRAINT "organization_branding_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;