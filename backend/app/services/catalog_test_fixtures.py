# Test Fixtures for Sanjana Mobiles Unit Tests
# These fixtures are used solely during test execution (e.g. pytest).
# They are never loaded into production runtime memory.

from typing import Dict, List

FIXTURE_PRODUCTS = {
    # --- prod-01: Maintains 890.0 price for test_phase6_7 suite compatibility ---
    "prod-01": {
        "id": "prod-01",
        "title": "Sanjana Smart Mini 5G Pocket Phone",
        "slug": "sanjana-smart-mini-5g-pocket-phone",
        "description": "Ultra-compact flagship Android smartphone featuring a 4.0-inch AMOLED display, dual SIM 5G connectivity, and 64GB storage. Ideal for minimalists and as a premium secondary phone.",
        "price": 890.00,
        "sale_price": None,
        "original_price": 1099.00,
        "discount_percent": 19,
        "sku": "SNJ-MOB-001",
        "brand": "Sanjana",
        "model": "Pocket 5G",
        "category_ids": ["cat-1"],
        "subcategory_id": "sub-1-1",
        "images": [
            "https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&q=80&w=900",
            "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80&w=900"
        ],
        "image_details": [
            {"id": "img-01a", "image_url": "https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&q=80&w=900", "is_primary": True, "display_order": 1}
        ],
        "primary_image": "https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&q=80&w=900",
        "is_active": True,
        "is_featured": True,
        "is_best_seller": True,
        "is_new_arrival": True,
        "warranty": "1 Year Official Brand Warranty",
        "compatibility": ["5G Dual SIM", "VoLTE", "All Indian Telecom Networks"],
        "specifications": {
            "Display": "4.0 inch OLED 90Hz",
            "RAM": "4GB LPDDR4X",
            "Storage": "64GB UFS 2.2",
            "Battery": "2800 mAh with 18W Fast Charging",
            "OS": "Android 14 (Pure Edition)"
        },
        "materials": "Aircraft Aluminum & Ceramic Back",
        "dimensions": "10.8cm x 5.2cm x 0.85cm",
        "tags": ["Compact", "5G", "Dual SIM", "Best Seller"],
        "rating": 4.9,
        "reviews_count": 48,
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z"
    },

    # --- prod-02: Price 380, sale_price 320 for test_phase6_7 suite compatibility ---
    "prod-02": {
        "id": "prod-02",
        "title": "Anker 65W GaN II Dual-Port Fast Charger",
        "slug": "anker-65w-gan-ii-dual-port-fast-charger",
        "description": "Ultra-efficient gallium nitride (GaN) wall adapter with USB-C Power Delivery and USB-A PowerIQ 3.0 ports. Charges laptops, iPhones, and Android smartphones up to 3x faster with intelligent temperature regulation.",
        "price": 380.00,
        "sale_price": 320.00,
        "original_price": 450.00,
        "discount_percent": 16,
        "sku": "SNJ-CHG-002",
        "brand": "Anker",
        "model": "PowerPort III 65W",
        "category_ids": ["cat-2"],
        "subcategory_id": "sub-2-1",
        "images": [
            "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&q=80&w=900",
            "https://images.unsplash.com/photo-1540932239986-30128078f3c5?auto=format&fit=crop&q=80&w=900"
        ],
        "image_details": [
            {"id": "img-02a", "image_url": "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&q=80&w=900", "is_primary": True, "display_order": 1}
        ],
        "primary_image": "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&q=80&w=900",
        "is_active": True,
        "is_featured": True,
        "is_best_seller": True,
        "is_new_arrival": False,
        "warranty": "18 Months Anker India Warranty",
        "compatibility": ["iPhone 15/14/13", "Samsung S24/S23 Ultra", "OnePlus", "MacBook Air", "iPad Pro"],
        "specifications": {
            "Wattage": "65W Max Output",
            "Ports": "1x USB-C (65W PD), 1x USB-A (22.5W)",
            "Technology": "GaN II Fast Charging",
            "Protection": "ActiveShield 2.0 Temperature Monitor"
        },
        "materials": "Fireproof Polycarbonate",
        "dimensions": "5.4cm x 4.2cm x 3.8cm",
        "tags": ["Fast Charger", "65W", "GaN", "Type-C", "iPhone Charger"],
        "rating": 4.9,
        "reviews_count": 82,
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z"
    },

    # --- prod-03: Audio Category ---
    "prod-03": {
        "id": "prod-03",
        "title": "boAt Airdopes 141 ANC True Wireless Earbuds",
        "slug": "boat-airdopes-141-anc-true-wireless-earbuds",
        "description": "True wireless earbuds featuring 32dB Active Noise Cancellation, quad microphones with ENx call noise isolation, and 42 hours of total playback with Beast Mode 50ms ultra-low latency.",
        "price": 1499.00,
        "sale_price": 1199.00,
        "original_price": 2490.00,
        "discount_percent": 52,
        "sku": "SNJ-AUD-003",
        "brand": "boAt",
        "model": "Airdopes 141 ANC",
        "category_ids": ["cat-3"],
        "subcategory_id": "sub-3-1",
        "images": [
            "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&q=80&w=900",
            "https://images.unsplash.com/photo-1572536147248-ac59a8abfa4b?auto=format&fit=crop&q=80&w=900"
        ],
        "image_details": [
            {"id": "img-03a", "image_url": "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&q=80&w=900", "is_primary": True, "display_order": 1}
        ],
        "primary_image": "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&q=80&w=900",
        "is_active": True,
        "is_featured": True,
        "is_best_seller": True,
        "is_new_arrival": True,
        "warranty": "1 Year Official Brand Warranty",
        "compatibility": ["Android", "iOS", "Windows", "All Bluetooth Devices"],
        "specifications": {
            "Bluetooth": "v5.3 Fast Pairing",
            "Playtime": "Up to 42 Hours with Case",
            "Driver Size": "10mm Titanium Acoustic Drivers",
            "Water Resistance": "IPX5 Sweat & Splash Guard",
            "Fast Charge": "10 mins charge = 120 mins playback"
        },
        "materials": "Matte Finish ABS",
        "dimensions": "6.2cm x 4.8cm x 2.4cm",
        "tags": ["TWS", "Earbuds", "ANC", "Wireless", "boAt"],
        "rating": 4.8,
        "reviews_count": 134,
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z"
    },

    # --- prod-04: Price 78.0 for test_phase6_7 suite compatibility ---
    "prod-04": {
        "id": "prod-04",
        "title": "Spigen Rugged Armor Case & Diffuser Grip",
        "slug": "spigen-rugged-armor-case-diffuser-grip",
        "description": "Signature matte black shockproof protective case with diffuser heat ventilation and Air Cushion Technology on all four corners. Tactile buttons and raised camera bevel prevent scratches.",
        "price": 78.00,
        "sale_price": None,
        "original_price": 99.00,
        "discount_percent": 21,
        "sku": "SNJ-PROT-004",
        "brand": "Spigen",
        "model": "Rugged Armor Classic",
        "category_ids": ["cat-4"],
        "images": [
            "https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?auto=format&fit=crop&q=80&w=900",
            "https://images.unsplash.com/photo-1584006682522-dc17d6c0d9ac?auto=format&fit=crop&q=80&w=900"
        ],
        "image_details": [
            {"id": "img-04a", "image_url": "https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?auto=format&fit=crop&q=80&w=900", "is_primary": True, "display_order": 1}
        ],
        "primary_image": "https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?auto=format&fit=crop&q=80&w=900",
        "is_active": True,
        "is_featured": True,
        "is_best_seller": True,
        "is_new_arrival": False,
        "warranty": "6 Months Manufacturer Warranty",
        "compatibility": ["iPhone 15", "iPhone 15 Pro", "Samsung Galaxy S24"],
        "specifications": {
            "Material": "Shock-Absorbing Flexible TPU",
            "Drop Rating": "MIL-STD 810G-516.6 Certified",
            "Bevel": "1.2mm Raised Screen & Camera Lip",
            "Wireless Charging": "Fully Compatible"
        },
        "materials": "Flexible Thermoplastic Polyurethane (TPU)",
        "dimensions": "15.0cm x 7.5cm x 1.1cm",
        "tags": ["Back Cover", "Shockproof", "Carbon Fiber", "Case", "Protection"],
        "rating": 4.9,
        "reviews_count": 210,
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z"
    },

    # --- prod-05: Available stock = 0 for test_phase6_7 out-of-stock suite compatibility ---
    "prod-05": {
        "id": "prod-05",
        "title": "Portronics Modesk 360 Heavy Metal Phone Stand",
        "slug": "portronics-modesk-360-heavy-metal-phone-stand",
        "description": "Ergonomic 360-degree rotating desk phone stand built from solid aerospace-grade aluminum alloy. Dual hinges allow adjustable viewing angles and fold completely flat for mobile portability.",
        "price": 499.00,
        "sale_price": 399.00,
        "original_price": 799.00,
        "discount_percent": 50,
        "sku": "SNJ-STND-005",
        "brand": "Portronics",
        "model": "Modesk 360",
        "category_ids": ["cat-5"],
        "images": [
            "https://images.unsplash.com/photo-1586105251261-72a756497a11?auto=format&fit=crop&q=80&w=900"
        ],
        "image_details": [
            {"id": "img-05a", "image_url": "https://images.unsplash.com/photo-1586105251261-72a756497a11?auto=format&fit=crop&q=80&w=900", "is_primary": True, "display_order": 1}
        ],
        "primary_image": "https://images.unsplash.com/photo-1586105251261-72a756497a11?auto=format&fit=crop&q=80&w=900",
        "is_active": True,
        "is_featured": False,
        "is_best_seller": False,
        "is_new_arrival": False,
        "warranty": "1 Year Portronics Warranty",
        "compatibility": ["Universal 4.0 - 12.9 inch Phones & Tablets"],
        "specifications": {
            "Material": "Aviation Grade Solid Aluminum",
            "Rotation": "360-Degree Click Swivel Base",
            "Anti-Slip": "Silicone Cushion Pads",
            "Cable Slot": "Reserved Bottom Charging Port Opening"
        },
        "materials": "Sandblasted Aluminum Alloy",
        "dimensions": "12.0cm x 9.5cm x 14.5cm",
        "tags": ["Desk Stand", "Metal", "360 Rotation", "Holder"],
        "rating": 4.7,
        "reviews_count": 35,
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z"
    },

    # --- Additional Mobile Products across Categories ---
    "prod-06": {
        "id": "prod-06",
        "title": "Apple iPhone 15 Pro 128GB Natural Titanium",
        "slug": "apple-iphone-15-pro-128gb-natural-titanium",
        "description": "Forged in aerospace-grade titanium with the breakthrough A17 Pro chip, customizable Action button, and 48MP main camera system with 3x optical zoom. Complete with USB-C connector supporting USB 3 transfer speeds.",
        "price": 129900.00,
        "sale_price": 124900.00,
        "original_price": 134900.00,
        "discount_percent": 7,
        "sku": "SNJ-IPH-006",
        "brand": "Apple",
        "model": "iPhone 15 Pro",
        "category_ids": ["cat-1"],
        "subcategory_id": "sub-1-2",
        "images": [
            "https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&q=80&w=900"
        ],
        "image_details": [
            {"id": "img-06a", "image_url": "https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&q=80&w=900", "is_primary": True, "display_order": 1}
        ],
        "primary_image": "https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&q=80&w=900",
        "is_active": True,
        "is_featured": True,
        "is_best_seller": True,
        "is_new_arrival": True,
        "warranty": "1 Year Official Apple India Warranty",
        "compatibility": ["5G Global Bands", "MagSafe", "Qi2 Wireless Charging"],
        "specifications": {
            "Processor": "A17 Pro chip (6-core CPU)",
            "Display": "6.1 inch Super Retina XDR OLED ProMotion 120Hz",
            "Storage": "128GB NVMe",
            "Camera": "48MP Main + 12MP Ultra Wide + 12MP 3x Telephoto",
            "Connector": "USB-C (USB 3 speeds up to 10Gbps)"
        },
        "materials": "Grade 5 Titanium & Ceramic Shield Front",
        "dimensions": "14.6cm x 7.0cm x 0.82cm",
        "tags": ["Apple", "iPhone", "Titanium", "Flagship", "5G"],
        "rating": 5.0,
        "reviews_count": 92,
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z"
    },
    "prod-07": {
        "id": "prod-07",
        "title": "Samsung Galaxy S24 Ultra 5G 256GB Titanium Gray",
        "slug": "samsung-galaxy-s24-ultra-5g-256gb-titanium-gray",
        "description": "The ultimate Galaxy AI flagship with integrated S Pen, Snapdragon 8 Gen 3 for Galaxy, and 200MP quad-telephoto camera system with titanium exterior chassis and Corning Gorilla Armor anti-reflective glass.",
        "price": 129999.00,
        "sale_price": 119999.00,
        "original_price": 134999.00,
        "discount_percent": 11,
        "sku": "SNJ-SAM-007",
        "brand": "Samsung",
        "model": "Galaxy S24 Ultra",
        "category_ids": ["cat-1"],
        "subcategory_id": "sub-1-1",
        "images": [
            "https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&q=80&w=900"
        ],
        "image_details": [
            {"id": "img-07a", "image_url": "https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&q=80&w=900", "is_primary": True, "display_order": 1}
        ],
        "primary_image": "https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&q=80&w=900",
        "is_active": True,
        "is_featured": True,
        "is_best_seller": True,
        "is_new_arrival": True,
        "warranty": "1 Year Samsung India Warranty",
        "compatibility": ["5G Dual SIM", "Galaxy AI", "Fast Wireless Charging 2.0"],
        "specifications": {
            "Processor": "Snapdragon 8 Gen 3 for Galaxy",
            "Display": "6.8 inch QHD+ Dynamic AMOLED 2X 120Hz",
            "RAM/ROM": "12GB RAM + 256GB Storage",
            "Camera": "200MP + 50MP 5x + 10MP 3x + 12MP Ultra-wide",
            "Battery": "5000 mAh with 45W Super Fast Charging"
        },
        "materials": "Titanium Shield Frame & Gorilla Glass Armor",
        "dimensions": "16.2cm x 7.9cm x 0.86cm",
        "tags": ["Samsung", "Galaxy AI", "S Pen", "Flagship", "200MP"],
        "rating": 4.9,
        "reviews_count": 78,
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z"
    },
    "prod-08": {
        "id": "prod-08",
        "title": "OnePlus 12R 5G 16GB RAM 256GB Cool Blue",
        "slug": "oneplus-12r-5g-16gb-ram-256gb-cool-blue",
        "description": "Smooth Beyond Belief performance powered by Snapdragon 8 Gen 2, 5500 mAh battery with 100W SUPERVOOC charging, and 4th Gen LTPO 120Hz ProXDR display with Aqua Touch technology.",
        "price": 45999.00,
        "sale_price": 42999.00,
        "original_price": 49999.00,
        "discount_percent": 14,
        "sku": "SNJ-OP-008",
        "brand": "OnePlus",
        "model": "OnePlus 12R",
        "category_ids": ["cat-1"],
        "subcategory_id": "sub-1-1",
        "images": [
            "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80&w=900"
        ],
        "image_details": [
            {"id": "img-08a", "image_url": "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80&w=900", "is_primary": True, "display_order": 1}
        ],
        "primary_image": "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80&w=900",
        "is_active": True,
        "is_featured": True,
        "is_best_seller": True,
        "is_new_arrival": True,
        "warranty": "1 Year OnePlus Official Warranty",
        "compatibility": ["5G Dual SIM", "100W SuperVOOC Charger in Box"],
        "specifications": {
            "Processor": "Qualcomm Snapdragon 8 Gen 2",
            "Display": "6.78 inch 1.5K 120Hz AMOLED LTPO4",
            "RAM/Storage": "16GB LPDDR5X + 256GB UFS 3.1",
            "Battery": "5500 mAh with 100W SuperVOOC (1-100% in 26 mins)",
            "Camera": "50MP Sony IMX890 with OIS"
        },
        "materials": "Matte Anti-Glare Glass & Aluminum Frame",
        "dimensions": "16.3cm x 7.5cm x 0.88cm",
        "tags": ["OnePlus", "100W", "12R", "Snapdragon", "5G"],
        "rating": 4.8,
        "reviews_count": 64,
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z"
    },
    "prod-09": {
        "id": "prod-09",
        "title": "Anker PowerLine III Flow 100W USB-C Cable (6ft/1.8m)",
        "slug": "anker-powerline-iii-flow-100w-usb-c-cable-6ft",
        "description": "Super-soft, tangle-free silicone braided 100W fast charging cable with 25,000-bend lifespan. Supports high-speed data transfer and 100W Power Delivery for high-end laptops, tablets, and phones.",
        "price": 1499.00,
        "sale_price": 1099.00,
        "original_price": 1999.00,
        "discount_percent": 45,
        "sku": "SNJ-CBL-009",
        "brand": "Anker",
        "model": "Flow 100W Type-C",
        "category_ids": ["cat-2"],
        "subcategory_id": "sub-2-1",
        "images": [
            "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&q=80&w=900"
        ],
        "image_details": [
            {"id": "img-09a", "image_url": "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&q=80&w=900", "is_primary": True, "display_order": 1}
        ],
        "primary_image": "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&q=80&w=900",
        "is_active": True,
        "is_featured": True,
        "is_best_seller": True,
        "is_new_arrival": False,
        "warranty": "18 Months Anker Warranty",
        "compatibility": ["All USB-C Smartphones", "MacBook", "iPad", "Samsung Super Fast Charging"],
        "specifications": {
            "Connector Type": "USB-C to USB-C",
            "Power Capacity": "100W (20V / 5A) Power Delivery",
            "Cable Length": "1.8 meters (6 feet)",
            "Data Speed": "480 Mbps USB 2.0"
        },
        "materials": "Food-grade Silicone Coating & Graphene Core",
        "dimensions": "1.8m Length",
        "tags": ["Cable", "Type-C", "100W", "Fast Charging", "Anker"],
        "rating": 4.9,
        "reviews_count": 115,
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z"
    },
    "prod-10": {
        "id": "prod-10",
        "title": "Apple 20W USB-C Power Adapter (Original)",
        "slug": "apple-20w-usb-c-power-adapter-original",
        "description": "Genuine Apple 20W USB-C Power Adapter offers fast, efficient charging at home, in the office, or on the go. Charges iPhone 15/14 from 0 to 50% in approximately 30 minutes.",
        "price": 1900.00,
        "sale_price": 1699.00,
        "original_price": 1900.00,
        "discount_percent": 10,
        "sku": "SNJ-APP-010",
        "brand": "Apple",
        "model": "20W Adapter",
        "category_ids": ["cat-2"],
        "images": [
            "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&q=80&w=900"
        ],
        "image_details": [
            {"id": "img-10a", "image_url": "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&q=80&w=900", "is_primary": True, "display_order": 1}
        ],
        "primary_image": "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&q=80&w=900",
        "is_active": True,
        "is_featured": True,
        "is_best_seller": True,
        "is_new_arrival": False,
        "warranty": "1 Year Apple India Warranty",
        "compatibility": ["iPhone 15/14/13/12/11", "iPad Pro", "Apple Watch"],
        "specifications": {
            "Wattage": "20W Output",
            "Port": "USB-C Female",
            "Input": "100-240V AC 50-60Hz",
            "Certification": "BIS Certified Official Apple Accessory"
        },
        "materials": "Apple Gloss White Polycarbonate",
        "dimensions": "4.5cm x 4.5cm x 2.8cm",
        "tags": ["Apple", "20W", "Original", "Charger", "iPhone"],
        "rating": 5.0,
        "reviews_count": 180,
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z"
    },
    "prod-11": {
        "id": "prod-11",
        "title": "OnePlus Bullets Wireless Z2 Bluetooth Neckband",
        "slug": "oneplus-bullets-wireless-z2-bluetooth-neckband",
        "description": "Magnetic neckband earphones featuring 12.4mm bass drivers, anti-distortion sound technology, AI call noise cancellation, and 30 hours of battery life with 10-minute Warp Charge.",
        "price": 2299.00,
        "sale_price": 1499.00,
        "original_price": 2299.00,
        "discount_percent": 35,
        "sku": "SNJ-AUD-011",
        "brand": "OnePlus",
        "model": "Bullets Wireless Z2",
        "category_ids": ["cat-3"],
        "images": [
            "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&q=80&w=900"
        ],
        "image_details": [
            {"id": "img-11a", "image_url": "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&q=80&w=900", "is_primary": True, "display_order": 1}
        ],
        "primary_image": "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&q=80&w=900",
        "is_active": True,
        "is_featured": True,
        "is_best_seller": True,
        "is_new_arrival": False,
        "warranty": "1 Year OnePlus Warranty",
        "compatibility": ["Universal Bluetooth Phones & Laptops"],
        "specifications": {
            "Drivers": "12.4mm Deep Bass Drivers",
            "Battery Life": "30 Hours Playback",
            "Fast Charge": "10 Mins Charge = 20 Hours Playback",
            "Water Resistance": "IP55 Water & Sweat Resistance",
            "Magnetic Control": "Magnetic Snap Pause & Resume"
        },
        "materials": "Skin-Friendly Silicone & Metal Earbuds",
        "dimensions": "37.5cm Neckband",
        "tags": ["Neckband", "OnePlus", "Wireless", "Fast Charge"],
        "rating": 4.8,
        "reviews_count": 94,
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z"
    },
    "prod-12": {
        "id": "prod-12",
        "title": "Xiaomi 20000mAh 50W Fast Charging Power Bank",
        "slug": "xiaomi-20000mah-50w-fast-charging-power-bank",
        "description": "Massive 20,000mAh capacity power bank capable of 50W MAX flash charging through USB-C. Easily charges 3 devices simultaneously and delivers enough power to charge laptops and MacBooks.",
        "price": 3999.00,
        "sale_price": 2799.00,
        "original_price": 4499.00,
        "discount_percent": 38,
        "sku": "SNJ-PWR-012",
        "brand": "Xiaomi",
        "model": "Mi Power Bank 50W",
        "category_ids": ["cat-6"],
        "images": [
            "https://images.unsplash.com/photo-1609592807664-42b7814408df?auto=format&fit=crop&q=80&w=900"
        ],
        "image_details": [
            {"id": "img-12a", "image_url": "https://images.unsplash.com/photo-1609592807664-42b7814408df?auto=format&fit=crop&q=80&w=900", "is_primary": True, "display_order": 1}
        ],
        "primary_image": "https://images.unsplash.com/photo-1609592807664-42b7814408df?auto=format&fit=crop&q=80&w=900",
        "is_active": True,
        "is_featured": True,
        "is_best_seller": True,
        "is_new_arrival": True,
        "warranty": "6 Months Xiaomi Warranty",
        "compatibility": ["iPhone", "Samsung", "OnePlus", "MacBook Air", "Type-C Laptops"],
        "specifications": {
            "Capacity": "20000 mAh 74Wh Li-Polymer",
            "Max Output": "50W MAX via USB-C Port",
            "Ports": "1x USB-C (50W), 2x USB-A (18W)",
            "Protection": "12-Layer Circuit & Surge Protection"
        },
        "materials": "Ceramic-feel Matte Finish Shell",
        "dimensions": "15.3cm x 7.3cm x 2.7cm",
        "tags": ["Power Bank", "20000mAh", "50W", "Fast Charging", "Xiaomi"],
        "rating": 4.9,
        "reviews_count": 87,
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z"
    },
    "prod-13": {
        "id": "prod-13",
        "title": "SanDisk Ultra 128GB MicroSDXC Memory Card Class 10",
        "slug": "sandisk-ultra-128gb-microsdxc-memory-card-class-10",
        "description": "High-capacity 128GB A1-rated MicroSD card with read speeds up to 140MB/s for fast photo, video, and app loading on Android smartphones, action cameras, and tablets.",
        "price": 1299.00,
        "sale_price": 799.00,
        "original_price": 1800.00,
        "discount_percent": 56,
        "sku": "SNJ-STR-013",
        "brand": "SanDisk",
        "model": "Ultra 128GB A1",
        "category_ids": ["cat-7"],
        "images": [
            "https://images.unsplash.com/photo-1628155930542-3c7a64e2c833?auto=format&fit=crop&q=80&w=900"
        ],
        "image_details": [
            {"id": "img-13a", "image_url": "https://images.unsplash.com/photo-1628155930542-3c7a64e2c833?auto=format&fit=crop&q=80&w=900", "is_primary": True, "display_order": 1}
        ],
        "primary_image": "https://images.unsplash.com/photo-1628155930542-3c7a64e2c833?auto=format&fit=crop&q=80&w=900",
        "is_active": True,
        "is_featured": False,
        "is_best_seller": True,
        "is_new_arrival": False,
        "warranty": "10-Year SanDisk India Warranty",
        "compatibility": ["All MicroSD Supported Phones, Cameras & Drones"],
        "specifications": {
            "Capacity": "128 GB",
            "Read Speed": "Up to 140 MB/s",
            "Performance Class": "Class 10, U1, A1 App Performance",
            "Durability": "Waterproof, Temperature-proof, X-ray proof"
        },
        "materials": "Silicon Microchip",
        "dimensions": "15mm x 11mm x 1.0mm",
        "tags": ["Memory Card", "SanDisk", "128GB", "Storage", "MicroSD"],
        "rating": 4.9,
        "reviews_count": 142,
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z"
    },
    "prod-14": {
        "id": "prod-14",
        "title": "Noise ColorFit Pro 5 Smartwatch with AMOLED Display",
        "slug": "noise-colorfit-pro-5-smartwatch-with-amoled-display",
        "description": "Premium 1.85-inch AMOLED display smartwatch with Bluetooth calling, functional crown navigation, 100+ sports modes, 24/7 heart rate, SpO2 monitoring, and emergency SOS calling.",
        "price": 5999.00,
        "sale_price": 3499.00,
        "original_price": 7999.00,
        "discount_percent": 56,
        "sku": "SNJ-GDG-014",
        "brand": "Noise",
        "model": "ColorFit Pro 5",
        "category_ids": ["cat-8"],
        "images": [
            "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=900"
        ],
        "image_details": [
            {"id": "img-14a", "image_url": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=900", "is_primary": True, "display_order": 1}
        ],
        "primary_image": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=900",
        "is_active": True,
        "is_featured": True,
        "is_best_seller": True,
        "is_new_arrival": True,
        "warranty": "1 Year Noise India Warranty",
        "compatibility": ["Android 9.0+ & iOS 11.0+ Phones"],
        "specifications": {
            "Display": "1.85 inch AMOLED 390x450, 1000 Nits Brightness",
            "Battery Life": "Up to 7 Days Normal Use",
            "Calling": "Tru Sync Bluetooth Calling with Mic & Speaker",
            "Health": "Heart Rate, SpO2, Sleep Tracker, Stress Analysis",
            "Water Resistance": "IP68 Water & Dust Resistant"
        },
        "materials": "Zinc Alloy Metallic Frame & Silicone Strap",
        "dimensions": "4.5cm x 3.8cm x 1.1cm",
        "tags": ["Smartwatch", "AMOLED", "Bluetooth Calling", "Noise", "Gadgets"],
        "rating": 4.8,
        "reviews_count": 89,
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z"
    },
    "prod-15": {
        "id": "prod-15",
        "title": "Portronics 7-in-1 Mobile & Earphone Cleaning Kit",
        "slug": "portronics-7-in-1-mobile-earphone-cleaning-kit",
        "description": "All-in-one multi-functional cleaning kit containing a high-density soft brush, earbud cleaning pen with silicone nib, keyboard key puller, screen spray bottle, and washable microfiber polishing cloth.",
        "price": 499.00,
        "sale_price": 299.00,
        "original_price": 699.00,
        "discount_percent": 57,
        "sku": "SNJ-ACC-015",
        "brand": "Portronics",
        "model": "CleanKey 7-in-1",
        "category_ids": ["cat-9"],
        "images": [
            "https://images.unsplash.com/photo-1616401784845-180882ba9ba8?auto=format&fit=crop&q=80&w=900"
        ],
        "image_details": [
            {"id": "img-15a", "image_url": "https://images.unsplash.com/photo-1616401784845-180882ba9ba8?auto=format&fit=crop&q=80&w=900", "is_primary": True, "display_order": 1}
        ],
        "primary_image": "https://images.unsplash.com/photo-1616401784845-180882ba9ba8?auto=format&fit=crop&q=80&w=900",
        "is_active": True,
        "is_featured": False,
        "is_best_seller": True,
        "is_new_arrival": True,
        "warranty": "6 Months Replacement Warranty",
        "compatibility": ["All Mobile Screens, Earbuds, Laptops, Keyboards"],
        "specifications": {
            "Components": "7 Tools in Compact Cylindrical Casing",
            "Spray Bottle": "Refillable Screen Cleaning Solution Container",
            "Pen Tip": "Fine Silicone Nib for Earbud Sound Holes",
            "Brush": "High-Density Soft Bristles for Charging Ports"
        },
        "materials": "Eco-friendly ABS & Microfiber",
        "dimensions": "12.3cm x 4.4cm x 2.8cm",
        "tags": ["Cleaning Kit", "Mobile Cleaner", "Earbuds", "Accessories"],
        "rating": 4.9,
        "reviews_count": 52,
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z"
    }
}

# 3. Inventory mapping: product_id -> { available_quantity, reserved_quantity, low_stock_threshold }
FIXTURE_INVENTORY = {
    "prod-01": {"available_quantity": 4, "reserved_quantity": 0, "low_stock_threshold": 5, "updated_at": "2026-01-10T10:00:00Z"},
    "prod-02": {"available_quantity": 12, "reserved_quantity": 0, "low_stock_threshold": 5, "updated_at": "2026-01-12T10:00:00Z"},
    "prod-03": {"available_quantity": 2, "reserved_quantity": 0, "low_stock_threshold": 5, "updated_at": "2026-01-15T10:00:00Z"},
    "prod-04": {"available_quantity": 42, "reserved_quantity": 0, "low_stock_threshold": 5, "updated_at": "2026-01-18T10:00:00Z"},
    "prod-05": {"available_quantity": 0, "reserved_quantity": 0, "low_stock_threshold": 5, "updated_at": "2026-01-20T10:00:00Z"},
    "prod-06": {"available_quantity": 8, "reserved_quantity": 0, "low_stock_threshold": 3, "updated_at": "2026-01-22T10:00:00Z"},
    "prod-07": {"available_quantity": 6, "reserved_quantity": 0, "low_stock_threshold": 3, "updated_at": "2026-01-22T10:00:00Z"},
    "prod-08": {"available_quantity": 15, "reserved_quantity": 0, "low_stock_threshold": 5, "updated_at": "2026-01-22T10:00:00Z"},
    "prod-09": {"available_quantity": 30, "reserved_quantity": 0, "low_stock_threshold": 10, "updated_at": "2026-01-22T10:00:00Z"},
    "prod-10": {"available_quantity": 25, "reserved_quantity": 0, "low_stock_threshold": 8, "updated_at": "2026-01-22T10:00:00Z"},
    "prod-11": {"available_quantity": 18, "reserved_quantity": 0, "low_stock_threshold": 5, "updated_at": "2026-01-22T10:00:00Z"},
    "prod-12": {"available_quantity": 14, "reserved_quantity": 0, "low_stock_threshold": 5, "updated_at": "2026-01-22T10:00:00Z"},
    "prod-13": {"available_quantity": 40, "reserved_quantity": 0, "low_stock_threshold": 10, "updated_at": "2026-01-22T10:00:00Z"},
    "prod-14": {"available_quantity": 16, "reserved_quantity": 0, "low_stock_threshold": 5, "updated_at": "2026-01-22T10:00:00Z"},
    "prod-15": {"available_quantity": 50, "reserved_quantity": 0, "low_stock_threshold": 15, "updated_at": "2026-01-22T10:00:00Z"},
}

# 4. Stock Movements audit log
FIXTURE_MOVEMENTS = [
    {
        "id": "mov-001",
        "product_id": "prod-01",
        "previous_quantity": 0,
        "quantity_changed": 4,
        "new_quantity": 4,
        "movement_type": "restock",
        "reason": "Initial stock entry",
        "admin_id": "admin-user-id-001",
        "created_at": "2026-01-10T10:00:00Z"
    },
    {
        "id": "mov-002",
        "product_id": "prod-02",
        "previous_quantity": 0,
        "quantity_changed": 12,
        "new_quantity": 12,
        "movement_type": "restock",
        "reason": "Initial stock entry",
        "admin_id": "admin-user-id-001",
        "created_at": "2026-01-12T10:00:00Z"
    }
]

