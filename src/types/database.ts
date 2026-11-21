
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"diff": Json | null,"entity": string,"entity_id": string | null,"id": string,"tenant_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"diff"?: Json | null,"entity": string,"entity_id"?: string | null,"id"?: string,"tenant_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"diff"?: Json | null,"entity"?: string,"entity_id"?: string | null,"id"?: string,"tenant_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"banners": {
                  Row: {
                    "created_at": string,"ends_at": string | null,"heading": string | null,"id": string,"image_key": string,"link": string | null,"position": number,"starts_at": string | null,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"ends_at"?: string | null,"heading"?: string | null,"id"?: string,"image_key": string,"link"?: string | null,"position"?: number,"starts_at"?: string | null,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"ends_at"?: string | null,"heading"?: string | null,"id"?: string,"image_key"?: string,"link"?: string | null,"position"?: number,"starts_at"?: string | null,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "banners_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "created_at": string,"id": string,"image_key": string | null,"is_active": boolean,"name": string,"parent_id": string | null,"position": number,"slug": string,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"image_key"?: string | null,"is_active"?: boolean,"name": string,"parent_id"?: string | null,"position"?: number,"slug": string,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"image_key"?: string | null,"is_active"?: boolean,"name"?: string,"parent_id"?: string | null,"position"?: number,"slug"?: string,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "categories_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "categories_tenant_id_parent_id_fkey"
      columns: ["tenant_id","parent_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"order_items": {
                  Row: {
                    "created_at": string,"id": string,"name_snapshot": string,"options_snapshot": NonNullable<Json>,"order_id": string,"qty": number,"tenant_id": string,"unit_price_paise": number | null,"variant_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name_snapshot": string,"options_snapshot"?: NonNullable<Json>,"order_id": string,"qty": number,"tenant_id": string,"unit_price_paise"?: number | null,"variant_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name_snapshot"?: string,"options_snapshot"?: NonNullable<Json>,"order_id"?: string,"qty"?: number,"tenant_id"?: string,"unit_price_paise"?: number | null,"variant_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_tenant_id_order_id_fkey"
      columns: ["tenant_id","order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "order_items_tenant_id_variant_id_fkey"
      columns: ["tenant_id","variant_id"]
isOneToOne: false
      referencedRelation: "product_variants"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "address": NonNullable<Json>,"channel": Database["public"]['Enums']["order_channel"],"created_at": string,"customer_name": string,"customer_phone": string,"id": string,"notes": string | null,"order_number": number,"status": Database["public"]['Enums']["order_status"],"subtotal_paise": number,"tenant_id": string,"total_paise": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address": NonNullable<Json>,"channel"?: Database["public"]['Enums']["order_channel"],"created_at"?: string,"customer_name": string,"customer_phone": string,"id"?: string,"notes"?: string | null,"order_number"?: number,"status"?: Database["public"]['Enums']["order_status"],"subtotal_paise": number,"tenant_id": string,"total_paise": number,"updated_at"?: string
                  }
                  Update: {
                    "address"?: NonNullable<Json>,"channel"?: Database["public"]['Enums']["order_channel"],"created_at"?: string,"customer_name"?: string,"customer_phone"?: string,"id"?: string,"notes"?: string | null,"order_number"?: number,"status"?: Database["public"]['Enums']["order_status"],"subtotal_paise"?: number,"tenant_id"?: string,"total_paise"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"plans": {
                  Row: {
                    "created_at": string,"id": string,"is_active": boolean,"limits": NonNullable<Json>,"monthly_fee_paise": number,"name": string,"setup_fee_paise": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"limits"?: NonNullable<Json>,"monthly_fee_paise"?: number,"name": string,"setup_fee_paise"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"limits"?: NonNullable<Json>,"monthly_fee_paise"?: number,"name"?: string,"setup_fee_paise"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"product_categories": {
                  Row: {
                    "category_id": string,"product_id": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id": string,"product_id": string,"tenant_id": string
                  }
                  Update: {
                    "category_id"?: string,"product_id"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_categories_tenant_id_category_id_fkey"
      columns: ["tenant_id","category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "product_categories_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_categories_tenant_id_product_id_fkey"
      columns: ["tenant_id","product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"product_images": {
                  Row: {
                    "alt": string | null,"created_at": string,"height": number | null,"id": string,"position": number,"product_id": string,"r2_key": string,"tenant_id": string,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "alt"?: string | null,"created_at"?: string,"height"?: number | null,"id"?: string,"position"?: number,"product_id": string,"r2_key": string,"tenant_id": string,"width"?: number | null
                  }
                  Update: {
                    "alt"?: string | null,"created_at"?: string,"height"?: number | null,"id"?: string,"position"?: number,"product_id"?: string,"r2_key"?: string,"tenant_id"?: string,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_images_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_images_tenant_id_product_id_fkey"
      columns: ["tenant_id","product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"product_variants": {
                  Row: {
                    "created_at": string,"id": string,"options": NonNullable<Json>,"price_paise": number | null,"product_id": string,"sku": string | null,"stock_qty": number,"tenant_id": string,"track_inventory": boolean,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"options"?: NonNullable<Json>,"price_paise"?: number | null,"product_id": string,"sku"?: string | null,"stock_qty"?: number,"tenant_id": string,"track_inventory"?: boolean,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"options"?: NonNullable<Json>,"price_paise"?: number | null,"product_id"?: string,"sku"?: string | null,"stock_qty"?: number,"tenant_id"?: string,"track_inventory"?: boolean,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_variants_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_variants_tenant_id_product_id_fkey"
      columns: ["tenant_id","product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"products": {
                  Row: {
                    "attributes": NonNullable<Json>,"compare_at_paise": number | null,"created_at": string,"description": string | null,"id": string,"is_featured": boolean,"name": string,"price_mode": Database["public"]['Enums']["price_mode"],"price_paise": number | null,"seo": NonNullable<Json>,"slug": string,"status": Database["public"]['Enums']["product_status"],"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attributes"?: NonNullable<Json>,"compare_at_paise"?: number | null,"created_at"?: string,"description"?: string | null,"id"?: string,"is_featured"?: boolean,"name": string,"price_mode"?: Database["public"]['Enums']["price_mode"],"price_paise"?: number | null,"seo"?: NonNullable<Json>,"slug": string,"status"?: Database["public"]['Enums']["product_status"],"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "attributes"?: NonNullable<Json>,"compare_at_paise"?: number | null,"created_at"?: string,"description"?: string | null,"id"?: string,"is_featured"?: boolean,"name"?: string,"price_mode"?: Database["public"]['Enums']["price_mode"],"price_paise"?: number | null,"seo"?: NonNullable<Json>,"slug"?: string,"status"?: Database["public"]['Enums']["product_status"],"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"full_name": string | null,"is_super_admin": boolean,"phone": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"full_name"?: string | null,"is_super_admin"?: boolean,"phone"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"full_name"?: string | null,"is_super_admin"?: boolean,"phone"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"subscriptions": {
                  Row: {
                    "created_at": string,"current_period_end": string | null,"id": string,"plan_id": string,"status": Database["public"]['Enums']["subscription_status"],"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"current_period_end"?: string | null,"id"?: string,"plan_id": string,"status"?: Database["public"]['Enums']["subscription_status"],"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"current_period_end"?: string | null,"id"?: string,"plan_id"?: string,"status"?: Database["public"]['Enums']["subscription_status"],"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscriptions_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscriptions_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"templates": {
                  Row: {
                    "created_at": string,"is_active": boolean,"key": string,"min_plan_id": string | null,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"is_active"?: boolean,"key": string,"min_plan_id"?: string | null,"name": string
                  }
                  Update: {
                    "created_at"?: string,"is_active"?: boolean,"key"?: string,"min_plan_id"?: string | null,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "templates_min_plan_id_fkey"
      columns: ["min_plan_id"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["id"]
    }
                  ]
                },"tenant_domains": {
                  Row: {
                    "created_at": string,"hostname": string,"id": string,"is_primary": boolean,"kind": Database["public"]['Enums']["domain_kind"],"tenant_id": string,"verified_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"hostname": string,"id"?: string,"is_primary"?: boolean,"kind": Database["public"]['Enums']["domain_kind"],"tenant_id": string,"verified_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"hostname"?: string,"id"?: string,"is_primary"?: boolean,"kind"?: Database["public"]['Enums']["domain_kind"],"tenant_id"?: string,"verified_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tenant_domains_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"tenant_members": {
                  Row: {
                    "created_at": string,"role": Database["public"]['Enums']["member_role"],"tenant_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"role"?: Database["public"]['Enums']["member_role"],"tenant_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"role"?: Database["public"]['Enums']["member_role"],"tenant_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tenant_members_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tenant_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"tenant_themes": {
                  Row: {
                    "draft": NonNullable<Json>,"published": Json | null,"published_at": string | null,"template_key": string,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "draft"?: NonNullable<Json>,"published"?: Json | null,"published_at"?: string | null,"template_key": string,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "draft"?: NonNullable<Json>,"published"?: Json | null,"published_at"?: string | null,"template_key"?: string,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tenant_themes_template_key_fkey"
      columns: ["template_key"]
isOneToOne: false
      referencedRelation: "templates"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "tenant_themes_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: true
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"tenants": {
                  Row: {
                    "business_type": string,"created_at": string,"currency": string,"id": string,"name": string,"slug": string,"status": Database["public"]['Enums']["tenant_status"],"updated_at": string,"whatsapp_number": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_type"?: string,"created_at"?: string,"currency"?: string,"id"?: string,"name": string,"slug": string,"status"?: Database["public"]['Enums']["tenant_status"],"updated_at"?: string,"whatsapp_number": string
                  }
                  Update: {
                    "business_type"?: string,"created_at"?: string,"currency"?: string,"id"?: string,"name"?: string,"slug"?: string,"status"?: Database["public"]['Enums']["tenant_status"],"updated_at"?: string,"whatsapp_number"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "can_manage_tenant":
{ Args: { "tid": string }; Returns: boolean
                           },
"is_live_product":
{ Args: { "pid": string }; Returns: boolean
                           },
"is_live_tenant":
{ Args: { "tid": string }; Returns: boolean
                           },
"is_super_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_tenant_member":
{ Args: { "tid": string }; Returns: boolean
                           },
"reorder_categories":
{ Args: { "ordered_ids": (string)[],"tid": string }; Returns: undefined
                           }
          }
          Enums: {
            "domain_kind": "subdomain"|"custom","member_role": "owner"|"staff","order_channel": "whatsapp"|"razorpay","order_status": "pending"|"confirmed"|"packed"|"shipped"|"delivered"|"cancelled","price_mode": "fixed"|"on_request","product_status": "draft"|"active"|"archived","subscription_status": "active"|"past_due"|"cancelled","tenant_status": "onboarding"|"active"|"suspended"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "domain_kind": ["subdomain", "custom"],"member_role": ["owner", "staff"],"order_channel": ["whatsapp", "razorpay"],"order_status": ["pending", "confirmed", "packed", "shipped", "delivered", "cancelled"],"price_mode": ["fixed", "on_request"],"product_status": ["draft", "active", "archived"],"subscription_status": ["active", "past_due", "cancelled"],"tenant_status": ["onboarding", "active", "suspended"]
          }
        }
} as const
