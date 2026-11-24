-- ==============================================================================
-- SANJANA MOBILES - DATABASE MODULE 03
-- File: database/sanjana-mobiles/03_sanjana_inventory.sql
-- Description: Inventory Management, Real-time Stock Quantities, Atomic Stock
--              Reservations, Stored Procedures, and Overselling Prevention.
-- Execution: Run third in Supabase SQL Editor.
-- ==============================================================================

-- 1. INVENTORY TABLE
CREATE TABLE IF NOT EXISTS public.inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL UNIQUE REFERENCES public.products(id) ON DELETE CASCADE,
    available_quantity INTEGER NOT NULL DEFAULT 0 CHECK (available_quantity >= 0),
    reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
    low_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_inventory_prod ON public.inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_avail ON public.inventory(available_quantity);

-- 2. STOCK MOVEMENTS (Immutable Audit Log of all additions, reductions & sales)
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    previous_quantity INTEGER NOT NULL,
    quantity_changed INTEGER NOT NULL,
    new_quantity INTEGER NOT NULL,
    movement_type TEXT NOT NULL CHECK (movement_type IN (
        'restock',
        'adjustment',
        'sale',
        'return',
        'reservation_hold',
        'reservation_release',
        'reservation_commit'
    )),
    reason TEXT NOT NULL,
    admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_prod ON public.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON public.stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON public.stock_movements(created_at DESC);

-- 3. STOCK RESERVATIONS (Concurrency Lock during active checkout)
CREATE TABLE IF NOT EXISTS public.stock_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    expires_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'converted', 'expired', 'cancelled')),
    order_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_stock_reservations_prod ON public.stock_reservations(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_status_exp ON public.stock_reservations(status, expires_at);

-- 4. AUTOMATIC INVENTORY CREATION TRIGGER FOR NEW PRODUCTS
CREATE OR REPLACE FUNCTION public.handle_new_product_inventory()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.inventory (product_id, available_quantity, reserved_quantity, low_stock_threshold)
    VALUES (NEW.id, 10, 0, 5)
    ON CONFLICT (product_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_init_inventory ON public.products;
CREATE TRIGGER trg_products_init_inventory
    AFTER INSERT ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_product_inventory();

-- 5. ATOMIC STORED PROCEDURE: RESERVE STOCK (Prevents overselling with SELECT FOR UPDATE)
CREATE OR REPLACE FUNCTION public.reserve_product_stock(
    p_product_id UUID,
    p_quantity INTEGER,
    p_user_id UUID DEFAULT NULL,
    p_duration_minutes INTEGER DEFAULT 15
)
RETURNS UUID AS $$
DECLARE
    v_available INTEGER;
    v_reservation_id UUID;
    v_expires_at TIMESTAMPTZ;
    v_is_active BOOLEAN;
BEGIN
    -- 1. Ensure product is active
    SELECT is_active INTO v_is_active FROM public.products WHERE id = p_product_id;
    IF NOT FOUND OR NOT v_is_active THEN
        RAISE EXCEPTION 'Product is inactive or does not exist.';
    END IF;

    -- 2. Lock inventory row exclusively to prevent race conditions
    SELECT available_quantity INTO v_available
    FROM public.inventory
    WHERE product_id = p_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Inventory record not found for product.';
    END IF;

    IF v_available < p_quantity THEN
        RAISE EXCEPTION 'Insufficient stock available. Requested: %, Available: %', p_quantity, v_available;
    END IF;

    v_expires_at := timezone('utc'::text, now()) + (p_duration_minutes || ' minutes')::INTERVAL;

    -- 3. Deduct available, increment reserved atomically
    UPDATE public.inventory
    SET available_quantity = available_quantity - p_quantity,
        reserved_quantity = reserved_quantity + p_quantity,
        updated_at = timezone('utc'::text, now())
    WHERE product_id = p_product_id;

    -- 4. Create reservation row
    INSERT INTO public.stock_reservations (
        product_id, user_id, quantity, expires_at, status
    ) VALUES (
        p_product_id, p_user_id, p_quantity, v_expires_at, 'active'
    ) RETURNING id INTO v_reservation_id;

    -- 5. Record movement in audit ledger
    INSERT INTO public.stock_movements (
        product_id, previous_quantity, quantity_changed, new_quantity,
        movement_type, reason
    ) VALUES (
        p_product_id, v_available, -p_quantity, v_available - p_quantity,
        'reservation_hold', 'Checkout hold for reservation ' || v_reservation_id
    );

    RETURN v_reservation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. ATOMIC STORED PROCEDURE: RELEASE EXPIRED RESERVATIONS
CREATE OR REPLACE FUNCTION public.release_expired_reservations()
RETURNS INTEGER AS $$
DECLARE
    r RECORD;
    v_count INTEGER := 0;
    v_prev_avail INTEGER;
BEGIN
    FOR r IN
        SELECT id, product_id, quantity
        FROM public.stock_reservations
        WHERE status = 'active' AND expires_at < timezone('utc'::text, now())
        FOR UPDATE
    LOOP
        -- Lock inventory row
        SELECT available_quantity INTO v_prev_avail
        FROM public.inventory
        WHERE product_id = r.product_id
        FOR UPDATE;

        IF FOUND THEN
            -- Restore available stock
            UPDATE public.inventory
            SET available_quantity = available_quantity + r.quantity,
                reserved_quantity = GREATEST(0, reserved_quantity - r.quantity),
                updated_at = timezone('utc'::text, now())
            WHERE product_id = r.product_id;

            -- Mark reservation as expired
            UPDATE public.stock_reservations
            SET status = 'expired'
            WHERE id = r.id;

            -- Record restoration in audit ledger
            INSERT INTO public.stock_movements (
                product_id, previous_quantity, quantity_changed, new_quantity,
                movement_type, reason
            ) VALUES (
                r.product_id, v_prev_avail, r.quantity, v_prev_avail + r.quantity,
                'reservation_release', 'Auto-released expired reservation ' || r.id
            );

            v_count := v_count + 1;
        END IF;
    END LOOP;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. ATOMIC STORED PROCEDURE: ADJUST STOCK (Manual Admin Restock/Correction)
CREATE OR REPLACE FUNCTION public.adjust_inventory_stock(
    p_product_id UUID,
    p_quantity_delta INTEGER,
    p_movement_type TEXT,
    p_reason TEXT,
    p_admin_id UUID DEFAULT NULL
)
RETURNS TABLE (
    product_id UUID,
    previous_quantity INTEGER,
    quantity_changed INTEGER,
    new_quantity INTEGER,
    movement_id UUID
) AS $$
DECLARE
    v_prev INTEGER;
    v_new INTEGER;
    v_mov_id UUID;
BEGIN
    -- Lock inventory row
    SELECT available_quantity INTO v_prev
    FROM public.inventory
    WHERE public.inventory.product_id = p_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Inventory record not found for product.';
    END IF;

    v_new := v_prev + p_quantity_delta;

    IF v_new < 0 THEN
        RAISE EXCEPTION 'Stock cannot become negative. Current: %, Delta: %', v_prev, p_quantity_delta;
    END IF;

    -- Update inventory
    UPDATE public.inventory
    SET available_quantity = v_new,
        updated_at = timezone('utc'::text, now())
    WHERE public.inventory.product_id = p_product_id;

    -- Record movement
    INSERT INTO public.stock_movements (
        product_id, previous_quantity, quantity_changed, new_quantity,
        movement_type, reason, admin_id
    ) VALUES (
        p_product_id, v_prev, p_quantity_delta, v_new,
        p_movement_type, p_reason, p_admin_id
    ) RETURNING id INTO v_mov_id;

    RETURN QUERY SELECT p_product_id, v_prev, p_quantity_delta, v_new, v_mov_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
