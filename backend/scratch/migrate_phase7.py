import sys
import psycopg2

def main():
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

    print("Connecting to Supabase Postgres database...")
    try:
        conn = psycopg2.connect(
            host="aws-1-ap-southeast-2.pooler.supabase.com",
            port=5432,
            user="postgres.updldhzjuuxctkhehjjl",
            password="Madhu@101976",
            database="postgres"
        )
        conn.autocommit = True
        cursor = conn.cursor()
        
        print("1. Altering item_prices source constraints...")
        # Dynamically find and drop any check constraint on the source column
        drop_constraint_sql = """
        DO $$
        DECLARE
            r record;
        BEGIN
            FOR r IN
                SELECT constraint_name
                FROM information_schema.constraint_column_usage
                WHERE table_name = 'item_prices' AND column_name = 'source'
            LOOP
                EXECUTE 'ALTER TABLE public.item_prices DROP CONSTRAINT ' || quote_ident(r.constraint_name);
            END LOOP;
        END;
        $$;
        """
        cursor.execute(drop_constraint_sql)
        
        # Add new check constraint and column
        alter_prices_sql = """
        ALTER TABLE public.item_prices ADD CONSTRAINT item_prices_source_check CHECK (source in ('amazon', 'flipkart', 'official', 'other', 'manual'));
        ALTER TABLE public.item_prices ADD COLUMN IF NOT EXISTS is_user_verified boolean DEFAULT false NOT NULL;
        """
        cursor.execute(alter_prices_sql)
        print("  ✓ item_prices schema updated successfully.")
        
        print("2. Creating item_attachments table...")
        create_attachments_sql = """
        CREATE TABLE IF NOT EXISTS public.item_attachments (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            item_id uuid REFERENCES public.wishlist_items(id) ON DELETE CASCADE NOT NULL,
            storage_path text NOT NULL,
            created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
        );
        """
        cursor.execute(create_attachments_sql)
        print("  ✓ item_attachments table created successfully.")
        
        print("3. Enabling RLS on item_attachments...")
        rls_attachments_sql = """
        ALTER TABLE public.item_attachments ENABLE ROW LEVEL SECURITY;
        """
        cursor.execute(rls_attachments_sql)
        
        # Drop policy if exists to make script re-runnable
        cursor.execute("DROP POLICY IF EXISTS \"Allow users to manage attachments of their own items\" ON public.item_attachments;")
        
        policy_attachments_sql = """
        CREATE POLICY "Allow users to manage attachments of their own items" ON public.item_attachments
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM public.wishlist_items
                    WHERE wishlist_items.id = item_attachments.item_id
                    AND wishlist_items.user_id = auth.uid()
                )
            );
        """
        cursor.execute(policy_attachments_sql)
        print("  ✓ RLS enabled and policies applied on item_attachments.")
        
        print("4. Creating storage bucket (item-attachments)...")
        # Insert bucket record into storage.buckets if not exists
        create_bucket_sql = """
        INSERT INTO storage.buckets (id, name, public)
        VALUES ('item-attachments', 'item-attachments', true)
        ON CONFLICT (id) DO NOTHING;
        """
        cursor.execute(create_bucket_sql)
        print("  ✓ item-attachments storage bucket registered.")
        
        print("5. Creating RLS policies for storage objects in item-attachments...")
        # Drop existing storage policies if they exist
        storage_policies = [
            "Allow users to upload attachments for their own items",
            "Allow users to view attachments for their own items",
            "Allow users to delete attachments for their own items"
        ]
        for p in storage_policies:
            cursor.execute(f"DROP POLICY IF EXISTS \"{p}\" ON storage.objects;")
            
        # Create storage upload/view/delete policies
        storage_policies_sql = """
        CREATE POLICY "Allow users to upload attachments for their own items" ON storage.objects
            FOR INSERT WITH CHECK (
                bucket_id = 'item-attachments'
                AND (
                    EXISTS (
                        SELECT 1 FROM public.wishlist_items
                        WHERE wishlist_items.id = (storage.foldername(name))[1]::uuid
                        AND wishlist_items.user_id = auth.uid()
                    )
                )
            );
            
        CREATE POLICY "Allow users to view attachments for their own items" ON storage.objects
            FOR SELECT USING (
                bucket_id = 'item-attachments'
                AND (
                    EXISTS (
                        SELECT 1 FROM public.wishlist_items
                        WHERE wishlist_items.id = (storage.foldername(name))[1]::uuid
                        AND wishlist_items.user_id = auth.uid()
                    )
                )
            );
            
        CREATE POLICY "Allow users to delete attachments for their own items" ON storage.objects
            FOR DELETE USING (
                bucket_id = 'item-attachments'
                AND (
                    EXISTS (
                        SELECT 1 FROM public.wishlist_items
                        WHERE wishlist_items.id = (storage.foldername(name))[1]::uuid
                        AND wishlist_items.user_id = auth.uid()
                    )
                )
            );
        """
        cursor.execute(storage_policies_sql)
        print("  ✓ Storage RLS policies configured successfully.")
        
        cursor.close()
        conn.close()
        print("\nMIGRATION COMPLETED SUCCESSFULLY! All schema updates applied.")
        
    except Exception as e:
        print(f"Migration error: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
