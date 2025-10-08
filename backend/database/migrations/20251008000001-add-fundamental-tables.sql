-- ==========================================
-- Migration: Add Fundamental Data and Economic Events Tables
-- For Phase 2 MVP - Fundamental + Event Integration
-- Created: 2025-10-08
-- ==========================================

BEGIN;

-- ==========================================
-- 1. FUNDAMENTAL DATA TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS fundamental_data (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    country VARCHAR(10) NOT NULL,
    indicator VARCHAR(50) NOT NULL,
    value DECIMAL(15, 6) NOT NULL,
    source VARCHAR(50) DEFAULT 'FRED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE fundamental_data IS 'Economic indicators: GDP, CPI, interest rates, unemployment, etc.';
COMMENT ON COLUMN fundamental_data.date IS 'Data date (YYYY-MM-DD)';
COMMENT ON COLUMN fundamental_data.country IS 'Country code: US, EU, GB, JP, AU, CA, CH, NZ';
COMMENT ON COLUMN fundamental_data.indicator IS 'Indicator name: interest_rate, gdp, cpi, unemployment, inflation, pmi, trade_balance';
COMMENT ON COLUMN fundamental_data.value IS 'Indicator value';
COMMENT ON COLUMN fundamental_data.source IS 'Data source: FRED, TradingEconomics, Manual';

-- Indexes for fundamental_data
CREATE UNIQUE INDEX IF NOT EXISTS idx_fundamental_date_country_indicator
    ON fundamental_data (date, country, indicator);

CREATE INDEX IF NOT EXISTS idx_fundamental_country_indicator
    ON fundamental_data (country, indicator);

CREATE INDEX IF NOT EXISTS idx_fundamental_date
    ON fundamental_data (date);

-- ==========================================
-- 2. ECONOMIC EVENTS TABLE
-- ==========================================
CREATE TYPE impact_level_enum AS ENUM ('high', 'medium', 'low');

CREATE TABLE IF NOT EXISTS economic_events (
    id SERIAL PRIMARY KEY,
    event_date TIMESTAMP NOT NULL,
    currency VARCHAR(10) NOT NULL,
    event_name VARCHAR(200) NOT NULL,
    impact_level impact_level_enum NOT NULL DEFAULT 'medium',
    forecast_value DECIMAL(15, 6),
    actual_value DECIMAL(15, 6),
    previous_value DECIMAL(15, 6),
    source VARCHAR(50) DEFAULT 'ForexFactory',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE economic_events IS 'Economic calendar events: NFP, Fed decisions, CPI releases, etc.';
COMMENT ON COLUMN economic_events.event_date IS 'Event datetime (UTC)';
COMMENT ON COLUMN economic_events.currency IS 'Affected currency: USD, EUR, GBP, JPY, AUD, CAD, CHF, NZD';
COMMENT ON COLUMN economic_events.event_name IS 'Event name: Fed Rate Decision, Non-Farm Payrolls, CPI, etc.';
COMMENT ON COLUMN economic_events.impact_level IS 'Expected market impact level';
COMMENT ON COLUMN economic_events.forecast_value IS 'Forecasted/expected value';
COMMENT ON COLUMN economic_events.actual_value IS 'Actual released value (filled after event)';
COMMENT ON COLUMN economic_events.previous_value IS 'Previous period value';
COMMENT ON COLUMN economic_events.source IS 'Data source: ForexFactory, TradingEconomics, Manual';

-- Indexes for economic_events
CREATE INDEX IF NOT EXISTS idx_events_date
    ON economic_events (event_date);

CREATE INDEX IF NOT EXISTS idx_events_currency_date
    ON economic_events (currency, event_date);

CREATE INDEX IF NOT EXISTS idx_events_impact
    ON economic_events (impact_level);

CREATE INDEX IF NOT EXISTS idx_events_currency_impact_date
    ON economic_events (currency, impact_level, event_date);

-- ==========================================
-- 3. INTEREST RATES TABLE (Optimized)
-- ==========================================
CREATE TABLE IF NOT EXISTS interest_rates (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    fed_rate DECIMAL(6, 4),
    ecb_rate DECIMAL(6, 4),
    boe_rate DECIMAL(6, 4),
    boj_rate DECIMAL(6, 4),
    rba_rate DECIMAL(6, 4),
    boc_rate DECIMAL(6, 4),
    snb_rate DECIMAL(6, 4),
    rbnz_rate DECIMAL(6, 4),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE interest_rates IS 'Optimized table for central bank interest rates';
COMMENT ON COLUMN interest_rates.date IS 'Date of interest rates';
COMMENT ON COLUMN interest_rates.fed_rate IS 'US Federal Reserve rate (%)';
COMMENT ON COLUMN interest_rates.ecb_rate IS 'European Central Bank rate (%)';
COMMENT ON COLUMN interest_rates.boe_rate IS 'Bank of England rate (%)';
COMMENT ON COLUMN interest_rates.boj_rate IS 'Bank of Japan rate (%)';
COMMENT ON COLUMN interest_rates.rba_rate IS 'Reserve Bank of Australia rate (%)';
COMMENT ON COLUMN interest_rates.boc_rate IS 'Bank of Canada rate (%)';
COMMENT ON COLUMN interest_rates.snb_rate IS 'Swiss National Bank rate (%)';
COMMENT ON COLUMN interest_rates.rbnz_rate IS 'Reserve Bank of New Zealand rate (%)';

-- Index for interest_rates
CREATE UNIQUE INDEX IF NOT EXISTS idx_interest_rates_date
    ON interest_rates (date);

-- ==========================================
-- AUTO-UPDATE TIMESTAMPS
-- ==========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for auto-updating updated_at
CREATE TRIGGER update_fundamental_data_updated_at
    BEFORE UPDATE ON fundamental_data
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_economic_events_updated_at
    BEFORE UPDATE ON economic_events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_interest_rates_updated_at
    BEFORE UPDATE ON interest_rates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- ==========================================
-- VERIFICATION
-- ==========================================
SELECT
    'fundamental_data' as table_name,
    COUNT(*) as row_count
FROM fundamental_data
UNION ALL
SELECT
    'economic_events',
    COUNT(*)
FROM economic_events
UNION ALL
SELECT
    'interest_rates',
    COUNT(*)
FROM interest_rates;

-- Show table info
\dt fundamental_data
\dt economic_events
\dt interest_rates

-- Success message
SELECT '✅ Fundamental data tables created successfully' as status;
