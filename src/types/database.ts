// Phase 1: HAND-WRITTEN to match the schema in docs/PLAN.md, in the same
// shape `supabase gen types` produces. Phase 2 replaces this file with the
// generated one (`npm run db:types`); code should only use the `Tables`,
// `TablesInsert`, `TablesUpdate` and `Enums` helpers so that swap is a no-op.
// Only the tables the storefront reads are included for now.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      tenants: Table<{
        id: string;
        slug: string;
        name: string;
        status: Database['public']['Enums']['tenant_status'];
        business_type: string;
        whatsapp_number: string;
        currency: string;
        created_at: string;
      }>;
      tenant_domains: Table<{
        id: string;
        tenant_id: string;
        hostname: string;
        kind: Database['public']['Enums']['domain_kind'];
        is_primary: boolean;
        verified_at: string | null;
      }>;
      tenant_themes: Table<{
        tenant_id: string;
        template_key: string;
        draft: Json;
        published: Json;
        published_at: string | null;
      }>;
      categories: Table<{
        id: string;
        tenant_id: string;
        parent_id: string | null;
        name: string;
        slug: string;
        position: number;
        image_key: string | null;
        is_active: boolean;
      }>;
      products: Table<{
        id: string;
        tenant_id: string;
        name: string;
        slug: string;
        description: string | null;
        price_mode: Database['public']['Enums']['price_mode'];
        price_paise: number | null;
        compare_at_paise: number | null;
        status: Database['public']['Enums']['product_status'];
        attributes: Json;
        is_featured: boolean;
        seo: Json;
        created_at: string;
        updated_at: string;
      }>;
      product_categories: Table<{
        product_id: string;
        category_id: string;
        tenant_id: string;
      }>;
      product_variants: Table<{
        id: string;
        tenant_id: string;
        product_id: string;
        sku: string | null;
        options: Json;
        price_paise: number | null;
        stock_qty: number;
        track_inventory: boolean;
      }>;
      product_images: Table<{
        id: string;
        tenant_id: string;
        product_id: string;
        r2_key: string;
        alt: string | null;
        position: number;
        width: number | null;
        height: number | null;
      }>;
      banners: Table<{
        id: string;
        tenant_id: string;
        image_key: string;
        heading: string | null;
        link: string | null;
        position: number;
        starts_at: string | null;
        ends_at: string | null;
      }>;
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      tenant_status: 'onboarding' | 'active' | 'suspended';
      domain_kind: 'subdomain' | 'custom';
      price_mode: 'fixed' | 'on_request';
      product_status: 'draft' | 'active' | 'archived';
    };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicSchema = Database['public'];

export type Tables<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Row'];
export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Update'];
export type Enums<T extends keyof PublicSchema['Enums']> =
  PublicSchema['Enums'][T];
