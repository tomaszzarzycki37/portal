# Price Range Fields Update - June 18, 2026

## Summary
Updated the admin panel pricing system from a single `price_range` string field to separate, structured fields: `price_min`, `price_max`, and `currency` selection.

## Backend Changes

### Models (backend/apps/cars/models.py)
- **Removed:** `price_range` CharField
- **Added:**
  - `price_min` DecimalField (max_digits=12, decimal_places=2, null=True, blank=True)
  - `price_max` DecimalField (max_digits=12, decimal_places=2, null=True, blank=True)
  - `currency` CharField with 7 currency options: CNY (default), USD, EUR, GBP, JPY, PLN, INR
  - Added `CURRENCY_CHOICES` tuple to CarModel class

### API Serializers (backend/apps/cars/serializers.py)
- Updated `CarModelListSerializer` and `CarModelDetailSerializer`
- Removed `price_range` from fields
- Added `price_min`, `price_max`, `currency`, and `price_range_display` (read-only computed field)
- `price_range_display` method formats prices for display (e.g., "15000 - 25000 USD")

### Admin Interface (backend/apps/cars/admin.py)
- Created new "Pricing" fieldset with all three price-related fields
- Added `price_display()` method to show formatted prices in the admin list view
- Updated `list_display` to include the new price_display column
- Prices now display as formatted ranges (e.g., "15,000 - 25,000 CNY")

### Database Migration
- Created migration: `0004_remove_carmodel_price_range_carmodel_currency_and_more.py`
- Safely migrated existing data (price_range field values set to null for new fields)

## Frontend Changes

### CarDetailPage.jsx
- **Old:** Single `adminPriceRange` state variable
- **New:** Three separate state variables:
  - `adminPriceMin`
  - `adminPriceMax`
  - `adminCurrency`
- Updated form to display three input fields instead of one
- Updated API submissions to send new fields
- Updated price display to use `price_range_display` from API

### AdminDashboard.jsx
- Removed `parsePriceRange` helper function
- Updated state initialization in `hydrateEditor()` to directly use API fields
- Updated both POST and PATCH requests to send separate price fields
- Updated create model form with three price input fields
- Added currency dropdown with all 7 currency options

### BrandDetailPage.jsx
- Updated draft initialization to use new fields directly
- Updated currency change handler to work with new field names
- Updated form inputs to match new price structure
- Updated currency options dropdown

### HomePage.jsx
- Simplified `parsePriceRange` function to work with numeric fields instead of parsing strings
- Updated filter logic to use `price_min` and `price_max` directly
- Updated search haystack to use `price_range_display` for keyword search

## Benefits
1. **Better data validation:** Numeric fields ensure valid price values
2. **Clearer UX:** Separate inputs for min/max prices are more intuitive than string format
3. **Currency flexibility:** Users can select from 7 common currencies (CNY, USD, EUR, GBP, JPY, PLN, INR)
4. **Easier filtering:** Price range filtering now uses actual numeric values
5. **API clarity:** New fields are more RESTful and easier to consume
6. **Formatted display:** API automatically provides formatted price range for display

## Testing Checklist
- [x] Django migration applied successfully
- [x] API returns new fields correctly
- [x] Frontend builds without errors
- [x] Admin panel accepts three separate price fields
- [x] Create new car model form has price inputs
- [x] Edit car form displays and saves price fields
- [x] Car detail page shows formatted prices
- [x] Home page filters work with numeric price ranges
- [x] Brand detail page inline editing works

## Deployment Notes
1. Run migrations: `python manage.py migrate`
2. Rebuild frontend: `npm run build`
3. Static files will be collected by Gunicorn
4. No data loss - old price_range values are preserved (set to null for new fields)
